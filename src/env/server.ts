import "server-only";

export const envServer = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  POLYGON_API_KEY:           process.env.POLYGON_API_KEY ?? "",
  // Anthropic API (AI Insights). Pago aparte, pay-as-you-go en console.anthropic.com.
  ANTHROPIC_API_KEY:         process.env.ANTHROPIC_API_KEY ?? "",
  ANTHROPIC_MODEL:           process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
};
