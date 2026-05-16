"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toast } from "~/lib/ui/toast";
import type { ToastVariant } from "~/lib/ui/toast";

interface Props {
  variant: ToastVariant;
  message: string;
}

export function Toaster({ variant, message }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-5 right-5 z-50">
      <Toast variant={variant} message={message} />
    </div>,
    document.body
  );
}
