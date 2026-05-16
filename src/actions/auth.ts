"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import { APP_URLS } from "~/constants/app-urls";

export type AuthActionState = {
  type: "error" | "success";
  code: string;
  message: string;
} | null;

export async function signInWithEmail(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { type: "error", code: error.code ?? error.name, message: error.message };
  redirect(APP_URLS.DASHBOARD);
}

export async function signUpWithEmail(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { type: "error", code: error.code ?? error.name, message: error.message };

  if (!data.session) {
    return { type: "success", code: "CHECK_EMAIL", message: "Check your inbox to confirm your account, then sign in." };
  }

  redirect(APP_URLS.DASHBOARD);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(APP_URLS.LOGIN);
}

export async function signInWithGoogle(): Promise<void> {
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}${APP_URLS.AUTH_CALLBACK}` },
  });

  if (error || !data.url) redirect(APP_URLS.LOGIN);
  else redirect(data.url);
}
