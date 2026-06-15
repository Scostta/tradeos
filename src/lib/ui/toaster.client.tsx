"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Toast } from "~/lib/ui/toast";
import type { ToastVariant } from "~/lib/ui/toast";

interface Props {
  variant: ToastVariant;
  message: string;
}

const subscribe = () => () => {};

export function Toaster({ variant, message }: Props) {
  // createPortal needs `document`, so render only on the client. Reading
  // client-vs-server via useSyncExternalStore avoids a setState-in-effect.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-5 right-5 z-50">
      <Toast variant={variant} message={message} />
    </div>,
    document.body
  );
}
