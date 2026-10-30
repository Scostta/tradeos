import "server-only";

export const envServer = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  POLYGON_API_KEY:           process.env.POLYGON_API_KEY ?? "",
  // Anthropic API (AI Insights). Pago aparte, pay-as-you-go en console.anthropic.com.
  ANTHROPIC_API_KEY:         process.env.ANTHROPIC_API_KEY ?? "",
  // Web Push (avisos de Invest). Sin clave privada no se envía nada.
  VAPID_PRIVATE_KEY:         process.env.VAPID_PRIVATE_KEY ?? "",
  VAPID_SUBJECT:             process.env.VAPID_SUBJECT ?? "",
  // Secreto compartido con el job del screener (GitHub secret INVEST_NOTIFY_SECRET).
  INVEST_NOTIFY_SECRET:      process.env.INVEST_NOTIFY_SECRET ?? "",
};
