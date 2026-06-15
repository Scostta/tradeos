import "server-only";

export const envServer = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  POLYGON_API_KEY:           process.env.POLYGON_API_KEY ?? "",
};
