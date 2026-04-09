"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type RecruiterCandidateFormState = {
  full_name: string;
  email: string;
  current_title: string;
  notes: string;
};

export function RecruiterCandidateCreateDialog({
  open,
  form,
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: RecruiterCandidateFormState;
  error: string | null;
  isSubmitting: boolean;
  onChange: (updater: (current: RecruiterCandidateFormState) => RecruiterCandidateFormState) => void;
  onClose: () => void;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[150]">
      <button
        type="button"
        aria-label="Close add candidate dialog"
        className="absolute inset-0 bg-[rgba(14,18,32,0.72)]"
        disabled={isSubmitting}
        onClick={onClose}
      />

      <div className="relative z-[151] flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="w-full max-w-3xl rounded-[32px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_30px_90px_-28px_rgba(27,31,59,0.7)]">
          <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">Add recruiter candidate</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Create a candidate for this job</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-ink-muted)]">
              Add the candidate record first, and optionally attach the CV in the same step.
            </p>
          </div>

          <form
            className="space-y-5 px-5 py-5 sm:px-6"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(event.currentTarget);
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="candidate-name">
                Full name
              </label>
              <Input
                id="candidate-name"
                value={form.full_name}
                onChange={(event) => onChange((current) => ({ ...current, full_name: event.target.value }))}
                placeholder="Candidate name"
                required
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="candidate-email">
                  Email
                </label>
                <Input
                  id="candidate-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))}
                  placeholder="candidate@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="candidate-title">
                  Current title
                </label>
                <Input
                  id="candidate-title"
                  value={form.current_title}
                  onChange={(event) => onChange((current) => ({ ...current, current_title: event.target.value }))}
                  placeholder="Senior Backend Engineer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="candidate-notes">
                Notes
              </label>
              <Textarea
                id="candidate-notes"
                className="min-h-28"
                value={form.notes}
                onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Initial recruiter notes, sourcing context, or referral details."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="candidate-cv">
                Candidate CV
              </label>
              <Input
                id="candidate-cv"
                name="candidate_cv"
                type="file"
                accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
              />
              <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
                Optional. Add the candidate record and upload the CV in the same step.
              </p>
            </div>

            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding candidate..." : "Add candidate"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
