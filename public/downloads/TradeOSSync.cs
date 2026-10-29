// ============================================================================
// TradeOS Sync — add-on de NinjaTrader 8
//
// Envía a TradeOS cada posición cerrada (de flat a flat) en cuanto se cierra:
//   - los trades emparejados FIFO por ejecución, igual que el Trade Performance
//     de NinjaTrader (así un CSV importado después no duplica nada),
//   - el stop inicial de la posición (primera orden stop de salida que aparece
//     mientras está abierta; si luego la mueves, se queda la inicial → R real),
//   - MAE / MFE en USD a partir de los ticks mientras la posición está abierta,
//   - una captura del chart del instrumento (PNG, max 1920 px; el servidor la
//     recodifica a WebP).
//
// Instalación
//   1. Copia este fichero a Documents\NinjaTrader 8\bin\Custom\AddOns\
//   2. NinjaTrader → New → NinjaScript Editor → F5 (compilar).
//   3. Guarda tradeos.json (descargado desde TradeOS → Settings) en
//      Documents\NinjaTrader 8\
//   4. Reinicia NinjaTrader. En New → NinjaScript Output verás
//      "TradeOS: connected".
//   Opcional: añade "screenshots": false a tradeos.json para no capturar el chart.
//
// Los envíos pasan por una cola en disco (Documents\NinjaTrader 8\tradeos\outbox)
// y se reintentan si no hay red. El servidor es idempotente: reenviar un trade
// no lo duplica.
//
// Modelo de hilos (v2)
//   La v1 hacía trabajo dentro de los handlers de NinjaTrader (bloquear
//   account.Orders, crear/soltar MarketData) con un lock propio cogido, y eso
//   hacía deadlock con el hilo de la ATM/adapter en Rithmic. En la v2:
//   - Los handlers (ExecutionUpdate, OrderUpdate, AccountStatusUpdate) SOLO
//     copian datos a una cola sin locks y despiertan al hilo worker. Nunca
//     llaman a la API de NinjaTrader ni esperan a nada, y nunca lanzan
//     excepciones hacia NinjaTrader.
//   - El handler de ticks solo actualiza máximo/mínimo bajo un lock "hoja"
//     (dentro no se llama a nada), así que no puede formar un ciclo.
//   - Todo el estado lo posee el hilo worker. Las llamadas a NinjaTrader
//     (suscribirse, leer Executions/Positions, crear MarketData) se hacen desde
//     el worker sin ningún lock propio cogido: si NinjaTrader tarda, solo
//     espera el worker; ningún hilo de NinjaTrader espera nunca al add-on.
//   - La captura del chart va por InvokeAsync con timeout, en otro hilo.
//
// Orden de las ejecuciones (v2.1)
//   Al reconectar Rithmic/APEX, NinjaTrader puede reenviar el historial del día
//   como ExecutionUpdate "en vivo", con IDs nuevos y de la más nueva a la más
//   antigua. Aplicadas así, la recompra de un short abre un long y la venta de
//   entrada lo cierra: un long falso con la salida antes que la entrada. Desde
//   la v2.1:
//   - Una ejecución en vivo con más de StaleExecutionSeconds de antigüedad no se
//     aplica: se pide un replay de la cuenta, que las ordena por hora.
//   - En un replay se ignora lo anterior a la última ejecución ya aplicada en
//     esa cuenta + instrumento, y en ese mismo instante, las copias (mismo
//     lado, cantidad y precio) de ejecuciones aplicadas antes de ese replay. Dos
//     parciales idénticos del mismo replay sí cuentan los dos.
//   - Nunca se envía un trade con la salida antes que la entrada.
// ============================================================================

#region Using declarations
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using NinjaTrader.Cbi;
using NinjaTrader.Data;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Chart;
using NinjaTrader.Gui.Tools;
#endregion

namespace NinjaTrader.NinjaScript.AddOns
{
	public class TradeOSSync : AddOnBase
	{
		private const string Version              = "2.1.0";
		private const int    StaleExecutionSeconds = 120;  // más antigua que esto en vivo → historial reenviado
		private const int    MaxScreenshotWidth   = 1920;
		private const int    ScreenshotDelayMs    = 1500;  // deja que el chart pinte la ejecución de salida
		private const int    UiProbeTimeoutMs     = 2000;
		private const int    UiCaptureTimeoutMs   = 5000;
		private const int    RetryIntervalMs      = 20000;
		private const int    WorkerJoinTimeoutMs  = 1000;

		// ── Compartido entre hilos ──────────────────────────────────────────────
		// Cola sin locks: los handlers de NinjaTrader solo hacen Enqueue + Set.
		private readonly ConcurrentQueue<object> events = new ConcurrentQueue<object>();
		private readonly AutoResetEvent wake = new AutoResetEvent(false);
		private volatile bool running;
		private int handlerErrors;

		// Suscripciones: las crea el worker y las deshace Stop(). `subsGate` es un
		// lock hoja: con él cogido nunca se llama a NinjaTrader.
		private readonly object subsGate = new object();
		private readonly HashSet<Account> subscribedAccounts = new HashSet<Account>();
		private readonly Dictionary<string, PriceFeed> feeds = new Dictionary<string, PriceFeed>();

		// ── Solo del hilo worker ────────────────────────────────────────────────
		private readonly Dictionary<string, PositionState> positions = new Dictionary<string, PositionState>();
		private readonly HashSet<string> seenExecutions = new HashSet<string>();
		private readonly HashSet<Account> pendingResync = new HashSet<Account>();
		private int replayGen;  // 0 = en vivo; cada replay de cuenta tiene el suyo
		private readonly Dictionary<string, Dictionary<Order, LiveStop>> liveStops = new Dictionary<string, Dictionary<Order, LiveStop>>();
		private long stopSeq;
		private int handlerErrorsLogged;

		private bool started;
		private Thread worker;
		private string ingestUrl;
		private string token;
		private bool screenshots = true;
		private string outboxDir;
		private string failedDir;
		private Timer senderTimer;
		private int sending;
		private bool authErrorLogged;

		// ── Eventos (copias inmutables de lo que manda NinjaTrader) ─────────────

		private class StartEvent { }

		private class AccountEvent
		{
			public Account Account;
		}

		private class ExecutionEvent
		{
			public Account    Account;
			public Instrument Instrument;
			public string     AccountName;
			public string     InstrumentName;
			public string     ExecutionId;
			public int        Side;  // +1 compra, -1 venta
			public int        Quantity;
			public double     Price;
			public DateTime   Time;
			public double     Commission;
			public double     PointValue;
			public bool       Replay;
			public int        Gen;
		}

		private class OrderEvent
		{
			public Order      Order;
			public Instrument Instrument;
			public string     AccountName;
			public string     InstrumentName;
			public bool       IsStop;
			public bool       Live;
			public int        ExitsSide;  // +1 cierra largos (venta), -1 cierra cortos (compra)
			public double     StopPrice;
		}

		// ── Modelo ──────────────────────────────────────────────────────────────

		private class Lot
		{
			public int      Quantity;
			public double   Price;
			public DateTime TimeUtc;
			public double   CommissionPerContract;
			public double   High;
			public double   Low;
			public bool     ExtremesKnown;  // false si viene de un replay o no hay datos de mercado
			public bool     Phantom;        // abierto antes de las ejecuciones conocidas: no se envía
		}

		private class ClosedTrade
		{
			public string   Direction;
			public int      Contracts;
			public double   EntryPrice;
			public double   ExitPrice;
			public DateTime EntryTimeUtc;
			public DateTime ExitTimeUtc;
			public double   Pnl;
			public double   Commission;
			public double?  Mae;
			public double?  Mfe;
		}

		private class PositionState
		{
			public string    AccountName;
			public string    InstrumentName;
			public int       Side;  // +1 long, -1 short, 0 flat
			public List<Lot> Lots   = new List<Lot>();
			public List<ClosedTrade> Closed = new List<ClosedTrade>();
			public double?   InitialStop;
			public DateTime? LastTime;  // hora (de NinjaTrader) de la última ejecución aplicada
			public List<KeyValuePair<string, int>> AtLastTime = new List<KeyValuePair<string, int>>();  // (huella, gen) aplicadas en LastTime
		}

		private class ClosedPosition
		{
			public string    AccountName;
			public string    InstrumentName;
			public List<ClosedTrade> Trades;
			public double?   InitialStop;
		}

		private class LiveStop
		{
			public long   Seq;
			public int    ExitsSide;
			public double Price;
		}

		// Máximo/mínimo de los ticks desde la última lectura. El handler corre en el
		// hilo de datos de NinjaTrader; el lock es hoja (dentro no se llama a nada).
		private class PriceFeed
		{
			private readonly object gate = new object();
			private double high;
			private double low;
			private bool   hasData;

			public MarketData Data;
			public volatile bool Subscribed;

			public void OnUpdate(object sender, MarketDataEventArgs e)
			{
				try
				{
					if (e.MarketDataType != MarketDataType.Last) return;
					double price = e.Price;
					lock (gate)
					{
						if (!hasData) { high = price; low = price; hasData = true; }
						else if (price > high) high = price;
						else if (price < low)  low  = price;
					}
				}
				catch (Exception) { }
			}

			public bool Harvest(out double h, out double l)
			{
				lock (gate)
				{
					h = high;
					l = low;
					bool had = hasData;
					hasData = false;
					return had;
				}
			}
		}

		private sealed class RefComparer<T> : IEqualityComparer<T> where T : class
		{
			public static readonly RefComparer<T> Instance = new RefComparer<T>();
			public bool Equals(T a, T b) { return ReferenceEquals(a, b); }
			public int GetHashCode(T o) { return RuntimeHelpers.GetHashCode(o); }
		}

		// ── Ciclo de vida ───────────────────────────────────────────────────────

		protected override void OnStateChange()
		{
			if (State == State.SetDefaults)
			{
				Name        = "TradeOSSync";
				Description = "Sincroniza trades, stop inicial y captura del chart con TradeOS.";
			}
			else if (State == State.Configure || State == State.Active)
			{
				Start();
			}
			else if (State == State.Terminated)
			{
				Stop();
			}
		}

		private void Start()
		{
			if (started) return;
			started = true;

			ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

			string root = Path.Combine(NinjaTrader.Core.Globals.UserDataDir, "tradeos");
			outboxDir = Path.Combine(root, "outbox");
			failedDir = Path.Combine(root, "failed");
			Directory.CreateDirectory(outboxDir);
			Directory.CreateDirectory(failedDir);

			if (!LoadConfig())
				return;

			running = true;
			worker = new Thread(WorkerLoop)
			{
				IsBackground = true,
				Name         = "TradeOSSync",
				Priority     = ThreadPriority.BelowNormal,
			};
			worker.Start();

			Account.AccountStatusUpdate += OnAccountStatusUpdate;
			Push(new StartEvent());

			senderTimer = new Timer(delegate { ProcessOutbox(); }, null, 2000, RetryIntervalMs);
		}

		private void Stop()
		{
			if (!started) return;
			started = false;

			// Los handlers miran `running` y dejan de encolar al instante.
			running = false;
			wake.Set();

			// Ningún lock propio cogido mientras se desuscribe de NinjaTrader.
			try { Account.AccountStatusUpdate -= OnAccountStatusUpdate; } catch (Exception) { }

			if (worker != null && !worker.Join(WorkerJoinTimeoutMs))
				Log("el worker no terminó a tiempo; se cierra igualmente.");
			worker = null;

			List<Account>   accounts;
			List<PriceFeed> feedList;
			lock (subsGate)
			{
				accounts = subscribedAccounts.ToList();
				feedList = feeds.Values.ToList();
				subscribedAccounts.Clear();
				feeds.Clear();
			}

			foreach (Account account in accounts)
			{
				try
				{
					account.ExecutionUpdate -= OnExecutionUpdate;
					account.OrderUpdate     -= OnOrderUpdate;
				}
				catch (Exception) { }
			}

			foreach (PriceFeed feed in feedList)
				Unsubscribe(feed);

			if (senderTimer != null)
			{
				senderTimer.Dispose();
				senderTimer = null;
			}
		}

		private bool LoadConfig()
		{
			string path = Path.Combine(NinjaTrader.Core.Globals.UserDataDir, "tradeos.json");
			if (!File.Exists(path))
			{
				Log("no se encuentra " + path + " — descárgalo desde TradeOS → Settings → NinjaTrader sync.");
				return false;
			}

			string json = File.ReadAllText(path);
			Match url = Regex.Match(json, "\"url\"\\s*:\\s*\"([^\"]+)\"");
			Match tok = Regex.Match(json, "\"token\"\\s*:\\s*\"(tos_[A-Za-z0-9_-]+)\"");
			if (!url.Success || !tok.Success)
			{
				Log("tradeos.json no es válido (faltan url o token).");
				return false;
			}

			ingestUrl   = url.Groups[1].Value;
			token       = tok.Groups[1].Value;
			screenshots = !Regex.IsMatch(json, "\"screenshots\"\\s*:\\s*false");
			return true;
		}

		// ── Handlers de NinjaTrader: copiar, encolar y volver ───────────────────

		private void Push(object evt)
		{
			events.Enqueue(evt);
			wake.Set();
		}

		private void OnAccountStatusUpdate(object sender, AccountStatusEventArgs e)
		{
			try
			{
				if (running && e.Status == ConnectionStatus.Connected && e.Account != null)
					Push(new AccountEvent { Account = e.Account });
			}
			catch (Exception) { Interlocked.Increment(ref handlerErrors); }
		}

		private void OnExecutionUpdate(object sender, ExecutionEventArgs e)
		{
			try
			{
				if (!running) return;
				ExecutionEvent x = SnapshotExecution(e.Execution, false);
				if (x != null) Push(x);
			}
			catch (Exception) { Interlocked.Increment(ref handlerErrors); }
		}

		private void OnOrderUpdate(object sender, OrderEventArgs e)
		{
			try
			{
				if (!running) return;
				OrderEvent x = SnapshotOrder(e.Order);
				if (x != null) Push(x);
			}
			catch (Exception) { Interlocked.Increment(ref handlerErrors); }
		}

		private static ExecutionEvent SnapshotExecution(Execution ex, bool replay)
		{
			if (ex == null || ex.Instrument == null || ex.Account == null || ex.Quantity <= 0) return null;

			int side = ex.MarketPosition == MarketPosition.Long ? 1
			         : ex.MarketPosition == MarketPosition.Short ? -1 : 0;
			if (side == 0) return null;

			return new ExecutionEvent
			{
				Account        = ex.Account,
				Instrument     = ex.Instrument,
				AccountName    = ex.Account.Name,
				InstrumentName = ex.Instrument.FullName,
				ExecutionId    = ex.ExecutionId,
				Side           = side,
				Quantity       = ex.Quantity,
				Price          = ex.Price,
				Time           = ex.Time,
				Commission     = ex.Commission,
				PointValue     = ex.Instrument.MasterInstrument.PointValue,
				Replay         = replay,
			};
		}

		private static OrderEvent SnapshotOrder(Order order)
		{
			if (order == null || order.Instrument == null || order.Account == null) return null;

			OrderState  state  = order.OrderState;
			OrderAction action = order.OrderAction;

			return new OrderEvent
			{
				Order          = order,
				Instrument     = order.Instrument,
				AccountName    = order.Account.Name,
				InstrumentName = order.Instrument.FullName,
				IsStop         = order.OrderType == OrderType.StopMarket || order.OrderType == OrderType.StopLimit,
				Live           = state == OrderState.Submitted
				              || state == OrderState.Accepted
				              || state == OrderState.Working
				              || state == OrderState.TriggerPending
				              || state == OrderState.ChangePending
				              || state == OrderState.ChangeSubmitted,
				ExitsSide      = action == OrderAction.Sell || action == OrderAction.SellShort ? 1
				               : action == OrderAction.Buy  || action == OrderAction.BuyToCover ? -1 : 0,
				StopPrice      = order.StopPrice,
			};
		}

		// ── Hilo worker ─────────────────────────────────────────────────────────

		private void WorkerLoop()
		{
			while (running)
			{
				wake.WaitOne(1000);

				object evt;
				while (running && events.TryDequeue(out evt))
				{
					try
					{
						if      (evt is ExecutionEvent) HandleExecution((ExecutionEvent)evt);
						else if (evt is OrderEvent)     HandleOrder((OrderEvent)evt);
						else if (evt is AccountEvent)   Subscribe(((AccountEvent)evt).Account);
						else if (evt is StartEvent)     SubscribeAll();
					}
					catch (Exception err)
					{
						Log("error interno: " + err.Message);
					}
				}

				int errors = Volatile.Read(ref handlerErrors);
				if (errors != handlerErrorsLogged)
				{
					Log((errors - handlerErrorsLogged) + " error(es) leyendo eventos de NinjaTrader (ignorados).");
					handlerErrorsLogged = errors;
				}
			}
		}

		// ── Cuentas ─────────────────────────────────────────────────────────────

		private void SubscribeAll()
		{
			List<Account> accounts;
			lock (Account.All)
				accounts = Account.All.ToList();
			foreach (Account account in accounts)
				Subscribe(account);

			Log("v" + Version + " connected (" + accounts.Count + " accounts) → " + ingestUrl);
		}

		// También se llama al reconectar una cuenta: el replay recupera las
		// ejecuciones que hubo mientras estaba desconectada (las ya vistas se ignoran).
		private void Subscribe(Account account)
		{
			if (!running) return;
			pendingResync.Remove(account);

			bool isNew;
			lock (subsGate)
				isNew = subscribedAccounts.Add(account);

			if (isNew)
			{
				account.ExecutionUpdate += OnExecutionUpdate;
				account.OrderUpdate     += OnOrderUpdate;
			}

			// Replay de las ejecuciones de la sesión: reconstruye posiciones abiertas
			// y reenvía las cerradas por si NinjaTrader se cerró antes de enviarlas
			// (el servidor ignora las que ya tiene).
			List<Execution> executions;
			lock (account.Executions)
				executions = account.Executions.ToList();
			List<Position> current;
			lock (account.Positions)
				current = account.Positions.ToList();

			List<ExecutionEvent> replay = executions
				.Select(x => SnapshotExecution(x, true))
				.Where(x => x != null)
				.OrderBy(x => x.Time)
				.ToList();

			SeedPreexistingPositions(account.Name, replay, current);

			int gen = ++replayGen;
			foreach (ExecutionEvent x in replay)
			{
				x.Gen = gen;
				HandleExecution(x);
			}
		}

		// Si la posición actual no cuadra con las ejecuciones conocidas (p. ej. se
		// abrió ayer y Account.Executions solo trae la sesión de hoy), la diferencia
		// se siembra como un lote "fantasma". Sin esto, la salida de esa posición se
		// leería como una entrada en sentido contrario y saldrían trades falsos.
		private void SeedPreexistingPositions(string accountName, List<ExecutionEvent> executions, List<Position> current)
		{
			var knownNet = new Dictionary<string, int>();
			foreach (ExecutionEvent x in executions)
			{
				if (seenExecutions.Contains(x.AccountName + "|" + x.ExecutionId)) continue;
				knownNet[x.InstrumentName] = (knownNet.ContainsKey(x.InstrumentName) ? knownNet[x.InstrumentName] : 0) + x.Side * x.Quantity;
			}

			var actualNet = new Dictionary<string, int>();
			foreach (Position pos in current)
			{
				if (pos.Instrument == null) continue;
				actualNet[pos.Instrument.FullName] = pos.MarketPosition == MarketPosition.Long ? pos.Quantity
				                                   : pos.MarketPosition == MarketPosition.Short ? -pos.Quantity : 0;
			}

			foreach (string instrument in knownNet.Keys.Union(actualNet.Keys).ToList())
			{
				string key = Key(accountName, instrument);
				if (positions.ContainsKey(key)) continue;  // ya lo seguimos (reconexión)

				int actual = actualNet.ContainsKey(instrument) ? actualNet[instrument] : 0;
				int known  = knownNet.ContainsKey(instrument)  ? knownNet[instrument]  : 0;
				int start  = actual - known;
				if (start == 0) continue;

				var p = new PositionState { AccountName = accountName, InstrumentName = instrument, Side = Math.Sign(start) };
				p.Lots.Add(new Lot { Quantity = Math.Abs(start), Phantom = true });
				positions[key] = p;
				Log(accountName + " " + instrument + ": posición previa de " + start + " contratos, sus trades no se envían.");
			}
		}

		// ── Ejecuciones → trades ────────────────────────────────────────────────

		private void HandleExecution(ExecutionEvent x)
		{
			string seenKey = x.AccountName + "|" + x.ExecutionId;
			if (seenExecutions.Contains(seenKey)) return;

			// Historial reenviado como evento en vivo (ver cabecera): no se aplica
			// fuera de orden; el replay de la cuenta lo ordena y descarta copias.
			if (!x.Replay && DateTime.UtcNow - ToUtc(x.Time) > TimeSpan.FromSeconds(StaleExecutionSeconds))
			{
				if (pendingResync.Add(x.Account))
				{
					Log(x.AccountName + ": ejecuciones antiguas recibidas en vivo (reconexión); se resincroniza la cuenta.");
					Push(new AccountEvent { Account = x.Account });
				}
				return;
			}

			string key = Key(x.AccountName, x.InstrumentName);
			PositionState p;
			if (!positions.TryGetValue(key, out p))
			{
				p = new PositionState { AccountName = x.AccountName, InstrumentName = x.InstrumentName };
				positions[key] = p;
			}

			// Replay: lo anterior a la última ejecución aplicada ya está cubierto, y
			// en ese mismo instante lo que repite una aplicada antes de este replay
			// es una copia con ID nuevo (ver cabecera).
			seenExecutions.Add(seenKey);
			string fill = x.Side + "|" + x.Quantity + "|" + x.Price.ToString("R", CultureInfo.InvariantCulture);
			if (x.Replay && p.LastTime.HasValue)
			{
				if (x.Time < p.LastTime.Value) return;
				if (x.Time == p.LastTime.Value && p.AtLastTime.Any(f => f.Key == fill && f.Value != x.Gen)) return;
			}
			if (!p.LastTime.HasValue || x.Time > p.LastTime.Value)
			{
				p.LastTime = x.Time;
				p.AtLastTime.Clear();
			}
			p.AtLastTime.Add(new KeyValuePair<string, int>(fill, x.Gen));

			PriceFeed feed = x.Replay ? null : EnsureFeed(x.Instrument);
			ApplyTicks(x.InstrumentName);  // los ticks hasta ahora son de los lotes ya abiertos

			DateTime timeUtc         = ToUtc(x.Time);
			double   commPerContract = x.Commission / x.Quantity;
			int      remaining       = x.Quantity;
			ClosedPosition closed    = null;

			// Cierre (total o parcial): FIFO contra los lotes abiertos.
			if (p.Side != 0 && p.Side != x.Side)
			{
				while (remaining > 0 && p.Lots.Count > 0)
				{
					Lot lot = p.Lots[0];
					int qty = Math.Min(lot.Quantity, remaining);
					if (!lot.Phantom)
					{
						if (timeUtc < lot.TimeUtc)
							Log(x.AccountName + " " + x.InstrumentName + ": trade descartado, la salida (" + timeUtc.ToString("u") + ") es anterior a la entrada.");
						else
							p.Closed.Add(BuildTrade(p.Side, lot, qty, x.Price, timeUtc, commPerContract, x.PointValue));
					}

					lot.Quantity -= qty;
					remaining    -= qty;
					if (lot.Quantity == 0) p.Lots.RemoveAt(0);
				}

				if (p.Lots.Count == 0)
				{
					closed = new ClosedPosition
					{
						AccountName    = p.AccountName,
						InstrumentName = p.InstrumentName,
						Trades         = p.Closed,
						InitialStop    = p.InitialStop,
					};
					p.Closed      = new List<ClosedTrade>();
					p.InitialStop = null;
					p.Side        = 0;
				}
			}

			// Apertura, scale-in o la parte que sobra de un giro.
			if (remaining > 0)
			{
				bool opening = p.Side == 0;
				p.Side = x.Side;
				p.Lots.Add(new Lot
				{
					Quantity              = remaining,
					Price                 = x.Price,
					TimeUtc               = timeUtc,
					CommissionPerContract = commPerContract,
					High                  = x.Price,
					Low                   = x.Price,
					ExtremesKnown         = feed != null && feed.Subscribed,
				});

				// El stop de una ATM puede llegar antes que la ejecución de entrada.
				if (opening)
					p.InitialStop = FirstLiveStop(key, x.Side);
			}

			if (closed != null && closed.Trades.Count > 0)
				EnqueuePosition(closed, !x.Replay && screenshots);
		}

		private static ClosedTrade BuildTrade(int side, Lot lot, int qty, double exitPrice,
			DateTime exitTimeUtc, double exitCommPerContract, double pointValue)
		{
			double? mae = null;
			double? mfe = null;
			if (lot.ExtremesKnown)
			{
				double high = Math.Max(lot.High, exitPrice);
				double low  = Math.Min(lot.Low, exitPrice);
				double adversePts   = side > 0 ? lot.Price - low  : high - lot.Price;
				double favorablePts = side > 0 ? high - lot.Price : lot.Price - low;
				mae = Math.Round(Math.Max(0, adversePts)   * qty * pointValue, 2);
				mfe = Math.Round(Math.Max(0, favorablePts) * qty * pointValue, 2);
			}

			return new ClosedTrade
			{
				Direction    = side > 0 ? "long" : "short",
				Contracts    = qty,
				EntryPrice   = lot.Price,
				ExitPrice    = exitPrice,
				EntryTimeUtc = lot.TimeUtc,
				ExitTimeUtc  = exitTimeUtc,
				Pnl          = Math.Round((exitPrice - lot.Price) * side * qty * pointValue, 2),
				Commission   = Math.Round((lot.CommissionPerContract + exitCommPerContract) * qty, 2),
				Mae          = mae,
				Mfe          = mfe,
			};
		}

		private static string Key(string accountName, string instrumentName)
		{
			return accountName + "|" + instrumentName;
		}

		// NinjaTrader da los tiempos en su zona horaria (Tools → Options → General).
		private static DateTime ToUtc(DateTime t)
		{
			try
			{
				return TimeZoneInfo.ConvertTimeToUtc(
					DateTime.SpecifyKind(t, DateTimeKind.Unspecified),
					NinjaTrader.Core.Globals.GeneralOptions.TimeZoneInfo);
			}
			catch (ArgumentException)
			{
				return t.ToUniversalTime();  // hora inválida/ambigua en el cambio de horario
			}
		}

		// ── Stop inicial ────────────────────────────────────────────────────────
		// Se sigue solo con los eventos OrderUpdate (sin leer account.Orders): el
		// worker guarda las órdenes stop vivas por cuenta+instrumento.

		private void HandleOrder(OrderEvent x)
		{
			if (x.Live) EnsureFeed(x.Instrument);  // datos de mercado antes de que entre la ejecución

			string key = Key(x.AccountName, x.InstrumentName);
			Dictionary<Order, LiveStop> stops;
			if (!liveStops.TryGetValue(key, out stops))
			{
				stops = new Dictionary<Order, LiveStop>(RefComparer<Order>.Instance);
				liveStops[key] = stops;
			}

			bool liveStop = x.IsStop && x.Live && x.ExitsSide != 0 && x.StopPrice > 0;
			if (!liveStop)
			{
				stops.Remove(x.Order);
				return;
			}

			LiveStop s;
			if (!stops.TryGetValue(x.Order, out s))
			{
				s = new LiveStop { Seq = ++stopSeq, ExitsSide = x.ExitsSide };
				stops[x.Order] = s;
			}
			s.Price = x.StopPrice;

			PositionState p;
			if (positions.TryGetValue(key, out p) && p.Side != 0 && p.Side == x.ExitsSide && p.InitialStop == null)
				p.InitialStop = x.StopPrice;
		}

		private double? FirstLiveStop(string key, int side)
		{
			Dictionary<Order, LiveStop> stops;
			if (!liveStops.TryGetValue(key, out stops)) return null;

			LiveStop first = null;
			foreach (LiveStop s in stops.Values)
				if (s.ExitsSide == side && (first == null || s.Seq < first.Seq))
					first = s;
			return first != null ? first.Price : (double?)null;
		}

		// ── MAE / MFE ───────────────────────────────────────────────────────────
		// Una suscripción por instrumento durante toda la vida del add-on: nada de
		// crear/soltar MarketData en cada trade.

		private PriceFeed EnsureFeed(Instrument instrument)
		{
			PriceFeed feed;
			lock (subsGate)
			{
				if (feeds.TryGetValue(instrument.FullName, out feed)) return feed;
				feed = new PriceFeed();
				feeds[instrument.FullName] = feed;
			}

			try
			{
				feed.Data = new MarketData(instrument);
				feed.Data.Update += feed.OnUpdate;
				feed.Subscribed = true;
			}
			catch (Exception err)
			{
				Log("sin datos de mercado para " + instrument.FullName + " (MAE/MFE vacíos): " + err.Message);
			}

			if (!running) Unsubscribe(feed);  // Stop() llegó mientras nos suscribíamos
			return feed;
		}

		private static void Unsubscribe(PriceFeed feed)
		{
			feed.Subscribed = false;
			MarketData data = feed.Data;
			feed.Data = null;
			if (data == null) return;
			try { data.Update -= feed.OnUpdate; } catch (Exception) { }
		}

		private void ApplyTicks(string instrumentName)
		{
			PriceFeed feed;
			lock (subsGate)
				feeds.TryGetValue(instrumentName, out feed);
			if (feed == null) return;

			double high, low;
			if (!feed.Harvest(out high, out low)) return;

			// El feed es por instrumento: se reparte entre todas las cuentas.
			foreach (PositionState p in positions.Values)
			{
				if (p.Side == 0 || p.InstrumentName != instrumentName) continue;
				foreach (Lot lot in p.Lots)
				{
					if (!lot.ExtremesKnown) continue;
					if (high > lot.High) lot.High = high;
					if (low  < lot.Low)  lot.Low  = low;
				}
			}
		}

		// ── Cola de envío ───────────────────────────────────────────────────────

		private void EnqueuePosition(ClosedPosition p, bool withScreenshot)
		{
			string json = BuildPayload(p);
			string id   = DateTime.UtcNow.Ticks.ToString("D20") + "-" + Guid.NewGuid().ToString("N").Substring(0, 8);

			Task.Run(async () =>
			{
				try
				{
					if (withScreenshot)
					{
						await Task.Delay(ScreenshotDelayMs);
						byte[] png = CaptureChart(p.InstrumentName);
						if (png != null)
							File.WriteAllBytes(Path.Combine(outboxDir, id + ".png"), png);
					}

					// .json al final y con rename: el sender nunca ve un item a medias.
					string tmp = Path.Combine(outboxDir, id + ".tmp");
					File.WriteAllText(tmp, json, new UTF8Encoding(false));
					File.Move(tmp, Path.Combine(outboxDir, id + ".json"));
				}
				catch (Exception err)
				{
					Log("no se pudo encolar el trade: " + err.Message);
				}

				ProcessOutbox();
			});
		}

		private void ProcessOutbox()
		{
			if (Interlocked.Exchange(ref sending, 1) == 1) return;
			try
			{
				foreach (string jsonPath in Directory.GetFiles(outboxDir, "*.json").OrderBy(f => f))
				{
					string pngPath = Path.ChangeExtension(jsonPath, ".png");
					byte[] png     = File.Exists(pngPath) ? File.ReadAllBytes(pngPath) : null;

					int status = Send(File.ReadAllText(jsonPath, Encoding.UTF8), png);

					if (status >= 200 && status < 300)
					{
						authErrorLogged = false;
						File.Delete(jsonPath);
						if (png != null) File.Delete(pngPath);
					}
					else if (status == 401)
					{
						if (!authErrorLogged) Log("token inválido o revocado — genera uno nuevo en TradeOS → Settings.");
						authErrorLogged = true;
						return;  // se reintenta en el siguiente ciclo, por si se cambia el config
					}
					else if (status >= 400 && status < 500 && status != 408 && status != 429)
					{
						// Payload rechazado: no tiene sentido reintentarlo.
						Log("trade rechazado (HTTP " + status + "), movido a " + failedDir);
						File.Move(jsonPath, Path.Combine(failedDir, Path.GetFileName(jsonPath)));
						if (png != null) File.Move(pngPath, Path.Combine(failedDir, Path.GetFileName(pngPath)));
					}
					else
					{
						return;  // sin red / 5xx: reintento en el siguiente ciclo
					}
				}
			}
			catch (Exception err)
			{
				Log("error procesando la cola: " + err.Message);
			}
			finally
			{
				Interlocked.Exchange(ref sending, 0);
			}
		}

		/// <returns>HTTP status, o 0 si no hubo respuesta.</returns>
		private int Send(string payloadJson, byte[] png)
		{
			string boundary = "----tradeos" + Guid.NewGuid().ToString("N");
			var body = new MemoryStream();

			WriteAscii(body, "--" + boundary + "\r\n"
				+ "Content-Disposition: form-data; name=\"payload\"\r\n"
				+ "Content-Type: application/json; charset=utf-8\r\n\r\n");
			byte[] payloadBytes = Encoding.UTF8.GetBytes(payloadJson);
			body.Write(payloadBytes, 0, payloadBytes.Length);
			WriteAscii(body, "\r\n");

			if (png != null)
			{
				WriteAscii(body, "--" + boundary + "\r\n"
					+ "Content-Disposition: form-data; name=\"screenshot\"; filename=\"chart.png\"\r\n"
					+ "Content-Type: image/png\r\n\r\n");
				body.Write(png, 0, png.Length);
				WriteAscii(body, "\r\n");
			}
			WriteAscii(body, "--" + boundary + "--\r\n");

			try
			{
				var req = (HttpWebRequest)WebRequest.Create(ingestUrl);
				req.Method        = "POST";
				req.Timeout       = 30000;
				req.ContentType   = "multipart/form-data; boundary=" + boundary;
				req.ContentLength = body.Length;
				req.Headers["Authorization"] = "Bearer " + token;
				req.UserAgent     = "TradeOSSync/" + Version;

				using (Stream stream = req.GetRequestStream())
					body.WriteTo(stream);

				using (var res = (HttpWebResponse)req.GetResponse())
					return (int)res.StatusCode;
			}
			catch (WebException err)
			{
				var res = err.Response as HttpWebResponse;
				if (res == null) return 0;
				using (res) return (int)res.StatusCode;
			}
		}

		private static void WriteAscii(Stream s, string text)
		{
			byte[] bytes = Encoding.ASCII.GetBytes(text);
			s.Write(bytes, 0, bytes.Length);
		}

		// ── Captura del chart ───────────────────────────────────────────────────
		// Cada chart tiene su propio hilo de UI. Nunca se espera sin límite: si un
		// chart está ocupado, se salta y el trade se envía sin captura.

		private byte[] CaptureChart(string instrumentName)
		{
			List<Chart> charts;
			try
			{
				charts = NinjaTrader.Core.Globals.AllWindows.Cast<object>().OfType<Chart>().ToList();
			}
			catch (InvalidOperationException)
			{
				return null;  // se abrió/cerró una ventana mientras se recorría; sin captura
			}

			// Preferimos la ventana activa si hay varias con el mismo instrumento.
			Chart best      = null;
			int   bestScore = 0;
			foreach (Chart chart in charts)
			{
				Chart c = chart;
				int score = OnUi(c, () =>
				{
					ChartControl control = c.ActiveChartControl;
					if (control == null || control.Instrument == null) return 0;
					if (c.WindowState == WindowState.Minimized) return 0;
					if (control.Instrument.FullName != instrumentName) return 0;
					return c.IsActive ? 2 : 1;
				}, 0, UiProbeTimeoutMs);

				if (score > bestScore)
				{
					best      = c;
					bestScore = score;
				}
			}

			if (best == null) return null;

			Chart target = best;
			return OnUi<byte[]>(target, () =>
			{
				RenderTargetBitmap shot = target.GetScreenshot(ShareScreenshotType.Chart);
				if (shot == null) return null;

				BitmapSource source = shot;
				if (shot.PixelWidth > MaxScreenshotWidth)
				{
					double scale = (double)MaxScreenshotWidth / shot.PixelWidth;
					source = new TransformedBitmap(shot, new ScaleTransform(scale, scale));
				}

				var encoder = new PngBitmapEncoder();
				encoder.Frames.Add(BitmapFrame.Create(source));
				using (var ms = new MemoryStream())
				{
					encoder.Save(ms);
					return ms.ToArray();
				}
			}, null, UiCaptureTimeoutMs);
		}

		private static T OnUi<T>(Window window, Func<T> fn, T fallback, int timeoutMs)
		{
			try
			{
				DispatcherOperation<T> op = window.Dispatcher.InvokeAsync(fn, DispatcherPriority.Background);
				if (op.Task.Wait(timeoutMs))
					return op.Result;
				op.Abort();  // si no ha empezado, que no llegue a ejecutarse
				return fallback;
			}
			catch (Exception)
			{
				return fallback;
			}
		}

		// ── JSON ────────────────────────────────────────────────────────────────

		private static string BuildPayload(ClosedPosition p)
		{
			var sb = new StringBuilder();
			sb.Append("{\"addonVersion\":").Append(Str(Version));
			sb.Append(",\"account\":").Append(Str(p.AccountName));
			sb.Append(",\"instrument\":").Append(Str(p.InstrumentName));
			sb.Append(",\"trades\":[");

			for (int i = 0; i < p.Trades.Count; i++)
			{
				ClosedTrade t = p.Trades[i];
				if (i > 0) sb.Append(',');
				sb.Append("{\"direction\":").Append(Str(t.Direction));
				sb.Append(",\"contracts\":").Append(t.Contracts.ToString(CultureInfo.InvariantCulture));
				sb.Append(",\"entryPrice\":").Append(Num(t.EntryPrice));
				sb.Append(",\"exitPrice\":").Append(Num(t.ExitPrice));
				sb.Append(",\"entryTime\":").Append(Str(Iso(t.EntryTimeUtc)));
				sb.Append(",\"exitTime\":").Append(Str(Iso(t.ExitTimeUtc)));
				sb.Append(",\"pnl\":").Append(Num(t.Pnl));
				sb.Append(",\"commission\":").Append(Num(t.Commission));
				sb.Append(",\"mae\":").Append(t.Mae.HasValue ? Num(t.Mae.Value) : "null");
				sb.Append(",\"mfe\":").Append(t.Mfe.HasValue ? Num(t.Mfe.Value) : "null");
				sb.Append(",\"stopPrice\":").Append(p.InitialStop.HasValue ? Num(p.InitialStop.Value) : "null");
				sb.Append('}');
			}

			sb.Append("]}");
			return sb.ToString();
		}

		// Cultura invariante: con Windows en español, 1.5 se escribiría "1,5".
		private static string Num(double v)
		{
			return v.ToString("R", CultureInfo.InvariantCulture);
		}

		private static string Iso(DateTime utc)
		{
			return utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
		}

		private static string Str(string s)
		{
			var sb = new StringBuilder("\"");
			foreach (char c in s)
			{
				if (c == '"' || c == '\\') sb.Append('\\').Append(c);
				else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
				else sb.Append(c);
			}
			return sb.Append('"').ToString();
		}

		private static void Log(string message)
		{
			NinjaTrader.Code.Output.Process("TradeOS: " + message, PrintTo.OutputTab1);
		}
	}
}
