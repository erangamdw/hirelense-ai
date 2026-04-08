"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-accent)]",
        secondary:
          "bg-[var(--color-panel)] text-[var(--color-ink)] ring-1 ring-[var(--color-border)] hover:bg-[var(--color-panel-strong)]",
        ghost: "text-[var(--color-ink-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-ink)]",
        danger: "bg-[var(--color-danger)] text-white hover:bg-[#a02a1f]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
