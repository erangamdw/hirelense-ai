"use client";

import { useId, useState } from "react";
import { FileUp, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FileUploadCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-panel-strong)] px-6 py-10 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--color-accent)] shadow-sm">
            <FileUp className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-[var(--color-ink)]">Choose a file</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Upload a document to use it in grounded analysis, interview prep, or recruiter review.
            </p>
          </div>
        </label>
        <input
          id={inputId}
          type="file"
          className="sr-only"
          onChange={(event) => setFileName(event.target.files?.[0]?.name || null)}
        />
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-[var(--color-border)]">
          <div className="flex items-center gap-3 text-sm text-[var(--color-ink-muted)]">
            <Paperclip className="h-4 w-4" />
            {fileName || "No file selected yet"}
          </div>
          <Button type="button" variant="secondary" size="sm">
            Attach
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
