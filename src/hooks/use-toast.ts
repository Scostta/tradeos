"use client";

import { startTransition, useEffect, useState } from "react";
import type { AuthActionState } from "~/actions/auth";
import type { ToastVariant } from "~/lib/ui/toast";

interface ToastState {
  variant: ToastVariant;
  message: string;
}

export function useToast(actionState: AuthActionState, duration = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!actionState) return;
    startTransition(() => {
      setToast({
        variant: actionState.type === "error" ? "error" : "success",
        message: actionState.message,
      });
    });
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [actionState, duration]);

  return toast;
}
