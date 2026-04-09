"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ConfirmationDialog({
  open,
  eyebrow = "Please confirm",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  isConfirming = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  isConfirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isConfirming) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirming, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[160]">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        className="absolute inset-0 bg-[rgba(14,18,32,0.72)]"
        disabled={isConfirming}
        onClick={onClose}
      />
      <div className="relative z-[161] flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_30px_90px_-28px_rgba(27,31,59,0.7)]">
          <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">{eyebrow}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={tone === "danger" ? "bg-[rgba(190,32,63,0.14)] text-[var(--color-danger)]" : undefined}>
                  {tone === "danger" ? "Destructive action" : "Confirmation"}
                </Badge>
              </div>
              <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-[var(--color-ink-muted)]">{description}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:justify-end sm:px-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isConfirming}>
              {cancelLabel}
            </Button>
            <Button type="button" variant={tone === "danger" ? "danger" : "default"} onClick={onConfirm} disabled={isConfirming}>
              {isConfirming ? "Working..." : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
