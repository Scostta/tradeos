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
//
// Los envíos pasan por una cola en disco (Documents\NinjaTrader 8\tradeos\outbox)
// y se reintentan si no hay red. El servidor es idempotente: reenviar un trade
// no lo duplica.
// ============================================================================

#region Using declarations
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
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
		private const string Version            = "1.0.0";
		private const int    MaxScreenshotWidth = 1920;
		private const int    ScreenshotDelayMs  = 1500;  // deja que el chart pinte la ejecución de salida
		private const int    RetryIntervalMs    = 20000;

		private readonly object sync = new object();
		private readonly Dictionary<string, PositionState> positions = new Dictionary<string, PositionState>();
		private readonly HashSet<string> seenExecutions = new HashSet<string>();
		private readonly HashSet<Account> subscribedAccounts = new HashSet<Account>();

		private bool started;
		private string ingestUrl;
		private string token;
		private string outboxDir;
		private string failedDir;
		private Timer senderTimer;
		private int sending;
		private bool authErrorLogged;

		// ── Modelo ──────────────────────────────────────────────────────────────

		private class Lot
		{
			public int      Quantity;
			public double   Price;
			public DateTime TimeUtc;
			public double   CommissionPerContract;
			public double   High;
			public double   Low;
			public bool     ExtremesKnown;  // false si viene de un replay (sin ticks desde la entrada)
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
			public Account     Account;
			public Instrument  Instrument;
			public int         Side;  // +1 long, -1 short, 0 flat
			public List<Lot>   Lots   = new List<Lot>();
			public List<ClosedTrade> Closed = new List<ClosedTrade>();
			public double?     InitialStop;
			public MarketData  MarketData;
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

			Account.AccountStatusUpdate += OnAccountStatusUpdate;

			List<Account> accounts;
			lock (Account.All)
				accounts = Account.All.ToList();
			foreach (Account account in accounts)
				Subscribe(account);

			senderTimer = new Timer(delegate { ProcessOutbox(); }, null, 2000, RetryIntervalMs);
			Log("connected (" + accounts.Count + " accounts) → " + ingestUrl);
		}

		private void Stop()
		{
			if (!started) return;
			started = false;

			Account.AccountStatusUpdate -= OnAccountStatusUpdate;

			lock (sync)
			{
				foreach (Account account in subscribedAccounts)
				{
					account.ExecutionUpdate -= OnExecutionUpdate;
					account.OrderUpdate     -= OnOrderUpdate;
				}
				subscribedAccounts.Clear();

				foreach (PositionState p in positions.Values)
					StopMarketData(p);
				positions.Clear();
			}

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

			ingestUrl = url.Groups[1].Value;
			token     = tok.Groups[1].Value;
			return true;
		}

		// ── Cuentas ─────────────────────────────────────────────────────────────

		private void OnAccountStatusUpdate(object sender, AccountStatusEventArgs e)
		{
			if (e.Status == ConnectionStatus.Connected)
				Subscribe(e.Account);
		}

		private void Subscribe(Account account)
		{
			lock (sync)
			{
				if (!subscribedAccounts.Add(account)) return;
				account.ExecutionUpdate += OnExecutionUpdate;
				account.OrderUpdate     += OnOrderUpdate;
			}

			// Replay de las ejecuciones de la sesión: reconstruye posiciones abiertas
			// y reenvía las cerradas por si NinjaTrader se cerró antes de enviarlas
			// (el servidor ignora las que ya tiene).
			List<Execution> executions;
			lock (account.Executions)
				executions = account.Executions.OrderBy(x => x.Time).ToList();

			SeedPreexistingPositions(account, executions);

			foreach (Execution execution in executions)
				HandleExecution(execution, true);
		}

		// Si la posición actual no cuadra con las ejecuciones conocidas (p. ej. se
		// abrió ayer y Account.Executions solo trae la sesión de hoy), la diferencia
		// se siembra como un lote "fantasma". Sin esto, la salida de esa posición se
		// leería como una entrada en sentido contrario y saldrían trades falsos.
		private void SeedPreexistingPositions(Account account, List<Execution> executions)
		{
			var instruments = new Dictionary<string, Instrument>();
			var knownNet    = new Dictionary<string, int>();
			foreach (Execution ex in executions)
			{
				if (ex.Instrument == null) continue;
				string name = ex.Instrument.FullName;
				int signed  = ex.MarketPosition == MarketPosition.Long ? ex.Quantity
				            : ex.MarketPosition == MarketPosition.Short ? -ex.Quantity : 0;
				instruments[name] = ex.Instrument;
				knownNet[name]    = (knownNet.ContainsKey(name) ? knownNet[name] : 0) + signed;
			}

			var actualNet = new Dictionary<string, int>();
			List<Position> current;
			lock (account.Positions)
				current = account.Positions.ToList();
			foreach (Position pos in current)
			{
				if (pos.Instrument == null) continue;
				string name = pos.Instrument.FullName;
				int signed  = pos.MarketPosition == MarketPosition.Long ? pos.Quantity
				            : pos.MarketPosition == MarketPosition.Short ? -pos.Quantity : 0;
				instruments[name] = pos.Instrument;
				actualNet[name]   = signed;
			}

			lock (sync)
			{
				foreach (KeyValuePair<string, Instrument> entry in instruments)
				{
					int actual = actualNet.ContainsKey(entry.Key) ? actualNet[entry.Key] : 0;
					int known  = knownNet.ContainsKey(entry.Key)  ? knownNet[entry.Key]  : 0;
					int start  = actual - known;
					if (start == 0) continue;

					string key = account.Name + "|" + entry.Key;
					if (positions.ContainsKey(key)) continue;

					var p = new PositionState { Account = account, Instrument = entry.Value, Side = Math.Sign(start) };
					p.Lots.Add(new Lot { Quantity = Math.Abs(start), Phantom = true });
					positions[key] = p;
					Log(account.Name + " " + entry.Key + ": posición previa de " + start + " contratos, sus trades no se envían.");
				}
			}
		}

		// ── Ejecuciones → trades ────────────────────────────────────────────────

		private void OnExecutionUpdate(object sender, ExecutionEventArgs e)
		{
			if (e.Execution != null)
				HandleExecution(e.Execution, false);
		}

		private void HandleExecution(Execution ex, bool replay)
		{
			if (ex.Instrument == null || ex.Account == null || ex.Quantity <= 0) return;

			int side = ex.MarketPosition == MarketPosition.Long ? 1
			         : ex.MarketPosition == MarketPosition.Short ? -1 : 0;
			if (side == 0) return;

			PositionState closedPosition = null;
			PositionState opened = null;

			lock (sync)
			{
				if (!seenExecutions.Add(ex.Account.Name + "|" + ex.ExecutionId)) return;

				string key = ex.Account.Name + "|" + ex.Instrument.FullName;
				PositionState p;
				if (!positions.TryGetValue(key, out p))
				{
					p = new PositionState { Account = ex.Account, Instrument = ex.Instrument };
					positions[key] = p;
				}

				DateTime timeUtc       = ToUtc(ex.Time);
				double   commPerContract = ex.Commission / ex.Quantity;
				int      remaining     = ex.Quantity;

				// Cierre (total o parcial): FIFO contra los lotes abiertos.
				if (p.Side != 0 && p.Side != side)
				{
					double pointValue = ex.Instrument.MasterInstrument.PointValue;

					while (remaining > 0 && p.Lots.Count > 0)
					{
						Lot lot = p.Lots[0];
						int qty = Math.Min(lot.Quantity, remaining);
						if (!lot.Phantom)
							p.Closed.Add(BuildTrade(p.Side, lot, qty, ex.Price, timeUtc, commPerContract, pointValue));

						lot.Quantity -= qty;
						remaining    -= qty;
						if (lot.Quantity == 0) p.Lots.RemoveAt(0);
					}

					if (p.Lots.Count == 0)
					{
						closedPosition = new PositionState
						{
							Account     = p.Account,
							Instrument  = p.Instrument,
							Closed      = p.Closed,
							InitialStop = p.InitialStop,
						};
						p.Closed      = new List<ClosedTrade>();
						p.InitialStop = null;
						p.Side        = 0;
						StopMarketData(p);
					}
				}

				// Apertura, scale-in o la parte que sobra de un giro.
				if (remaining > 0)
				{
					bool opening = p.Side == 0;
					p.Side = side;
					p.Lots.Add(new Lot
					{
						Quantity              = remaining,
						Price                 = ex.Price,
						TimeUtc               = timeUtc,
						CommissionPerContract = commPerContract,
						High                  = ex.Price,
						Low                   = ex.Price,
						ExtremesKnown         = !replay,
					});

					if (opening)
					{
						if (!replay) StartMarketData(p);
						opened = p;
					}
				}
			}

			// Fuera del lock: FindWorkingStop bloquea account.Orders, y NinjaTrader
			// puede lanzar OrderUpdate (que coge `sync`) con ese lock tomado.
			if (opened != null)
				FindWorkingStop(opened);

			if (closedPosition != null && closedPosition.Closed.Count > 0)
				EnqueuePosition(closedPosition, !replay);
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
				double adversePts  = side > 0 ? lot.Price - low  : high - lot.Price;
				double favorablePts = side > 0 ? high - lot.Price : lot.Price - low;
				mae = Math.Round(Math.Max(0, adversePts)  * qty * pointValue, 2);
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

		private void OnOrderUpdate(object sender, OrderEventArgs e)
		{
			Order order = e.Order;
			if (order == null || order.Instrument == null || order.Account == null) return;

			lock (sync)
			{
				PositionState p;
				if (!positions.TryGetValue(order.Account.Name + "|" + order.Instrument.FullName, out p)) return;
				if (p.Side != 0 && p.InitialStop == null && IsProtectiveStop(order, p.Side))
					p.InitialStop = order.StopPrice;
			}
		}

		// El stop de una ATM puede llegar antes que la ejecución de entrada.
		private void FindWorkingStop(PositionState p)
		{
			List<Order> orders;
			lock (p.Account.Orders)
				orders = p.Account.Orders.ToList();

			lock (sync)
			{
				if (p.Side == 0 || p.InitialStop != null) return;
				foreach (Order order in orders)
				{
					if (order.Instrument == null || order.Instrument.FullName != p.Instrument.FullName) continue;
					if (IsProtectiveStop(order, p.Side))
					{
						p.InitialStop = order.StopPrice;
						return;
					}
				}
			}
		}

		private static bool IsProtectiveStop(Order order, int side)
		{
			bool isStop = order.OrderType == OrderType.StopMarket || order.OrderType == OrderType.StopLimit;
			bool live   = order.OrderState == OrderState.Submitted
			           || order.OrderState == OrderState.Accepted
			           || order.OrderState == OrderState.Working;
			bool exitSide = side > 0
				? order.OrderAction == OrderAction.Sell || order.OrderAction == OrderAction.SellShort
				: order.OrderAction == OrderAction.Buy  || order.OrderAction == OrderAction.BuyToCover;
			return isStop && live && exitSide && order.StopPrice > 0;
		}

		// ── MAE / MFE ───────────────────────────────────────────────────────────

		private void StartMarketData(PositionState p)
		{
			if (p.MarketData != null) return;
			p.MarketData = new MarketData(p.Instrument);
			p.MarketData.Update += OnMarketData;
		}

		private void StopMarketData(PositionState p)
		{
			if (p.MarketData == null) return;
			p.MarketData.Update -= OnMarketData;
			p.MarketData = null;
		}

		private void OnMarketData(object sender, MarketDataEventArgs e)
		{
			if (e.MarketDataType != MarketDataType.Last || e.Instrument == null) return;

			lock (sync)
			{
				foreach (PositionState p in positions.Values)
				{
					if (p.Side == 0 || p.Instrument.FullName != e.Instrument.FullName) continue;
					foreach (Lot lot in p.Lots)
					{
						if (e.Price > lot.High) lot.High = e.Price;
						if (e.Price < lot.Low)  lot.Low  = e.Price;
					}
				}
			}
		}

		// ── Cola de envío ───────────────────────────────────────────────────────

		private void EnqueuePosition(PositionState p, bool withScreenshot)
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
						byte[] png = CaptureChart(p.Instrument);
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

					int status = Post(File.ReadAllText(jsonPath, Encoding.UTF8), png);

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
		private int Post(string payloadJson, byte[] png)
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

		private byte[] CaptureChart(Instrument instrument)
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
			foreach (Chart chart in charts.OrderByDescending(c => c.Dispatcher.Invoke(() => c.IsActive)))
			{
				byte[] png = null;
				Chart current = chart;
				current.Dispatcher.Invoke(new Action(delegate
				{
					ChartControl control = current.ActiveChartControl;
					if (control == null || control.Instrument == null) return;
					if (current.WindowState == WindowState.Minimized) return;
					if (control.Instrument.FullName != instrument.FullName) return;

					RenderTargetBitmap shot = current.GetScreenshot(ShareScreenshotType.Chart);
					if (shot == null) return;

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
						png = ms.ToArray();
					}
				}));

				if (png != null) return png;
			}

			return null;
		}

		// ── JSON ────────────────────────────────────────────────────────────────

		private static string BuildPayload(PositionState p)
		{
			var sb = new StringBuilder();
			sb.Append("{\"addonVersion\":").Append(Str(Version));
			sb.Append(",\"account\":").Append(Str(p.Account.Name));
			sb.Append(",\"instrument\":").Append(Str(p.Instrument.FullName));
			sb.Append(",\"trades\":[");

			for (int i = 0; i < p.Closed.Count; i++)
			{
				ClosedTrade t = p.Closed[i];
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
