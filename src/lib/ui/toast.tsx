import React from "react";
import { cn } from "~/utils/cn";
import { CircleCheckIcon } from "~/lib/ui/icons/circle-check-icon";
import { CircleInfoIcon } from "~/lib/ui/icons/circle-info-icon";
import { CircleXIcon } from "~/lib/ui/icons/circle-x-icon";
import { TriangleAlertIcon } from "~/lib/ui/icons/triangle-alert-icon";

export type ToastVariant = "error" | "warning" | "success" | "info";

interface ToastProps {
  variant: ToastVariant;
  message: string;
}

const CONFIG: Record<ToastVariant, { icon: () => React.ReactElement; className: string }> = {
  error:   { icon: CircleXIcon,       className: "text-loss  border-loss/20"  },
  warning: { icon: TriangleAlertIcon, className: "text-short border-short/20" },
  success: { icon: CircleCheckIcon,   className: "text-profit border-profit/20" },
  info:    { icon: CircleInfoIcon,    className: "text-long  border-long/20"  },
};

export function Toast({ variant, message }: ToastProps) {
  const { icon: Icon, className } = CONFIG[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-sm bg-surface-2 border text-sm shrink-0",
        className
      )}
    >
      <Icon />
      <span>{message}</span>
    </div>
  );
}
