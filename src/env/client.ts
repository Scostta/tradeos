export const envClient = {
  NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  // Clave pública VAPID para suscribirse a Web Push; vacía = avisos no disponibles.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY:  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};
