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

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email") as string;

  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}${APP_URLS.AUTH_CALLBACK}?next=${APP_URLS.RESET_PASSWORD}`,
  });

  if (error) return { type: "error", code: error.code ?? error.name, message: error.message };

  // Always report success so we don't leak which emails are registered.
  return { type: "success", code: "RESET_SENT", message: "If that email exists, a reset link is on its way." };
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { type: "error", code: "NO_SESSION", message: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { type: "error", code: error.code ?? error.name, message: error.message };

  redirect(APP_URLS.DASHBOARD);
}

export async function resendConfirmation(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email") as string;

  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}${APP_URLS.AUTH_CALLBACK}` },
  });

  if (error) return { type: "error", code: error.code ?? error.name, message: error.message };

  return { type: "success", code: "CONFIRMATION_SENT", message: "Confirmation email sent. Check your inbox." };
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
