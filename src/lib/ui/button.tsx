import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "~/utils/cn";

type Variant = "accent" | "ghost" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  accent: "btn-accent",
  ghost:  "btn-ghost",
  icon:   "icon-btn",
};

export function Button({
  variant = "ghost",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(VARIANTS[variant], "disabled:opacity-60", className)}
      {...props}
    >
      {children}
    </button>
  );
}
