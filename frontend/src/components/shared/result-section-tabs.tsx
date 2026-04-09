"use client";

import { type ReactNode, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ResultSectionTab = {
  id: string;
  label: string;
  badge?: string;
  content: ReactNode;
};

export function ResultSectionTabs({
  tabs,
  defaultTabId,
}: {
  tabs: ResultSectionTab[];
  defaultTabId?: string;
}) {
  const initialTabId = tabs.find((tab) => tab.id === defaultTabId)?.id ?? tabs[0]?.id ?? "";
  const [activeTabId, setActiveTabId] = useState(initialTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;

  if (!activeTab) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-panel)]",
                )}
              >
                <span>{tab.label}</span>
                {tab.badge ? (
                  <Badge className={isActive ? "bg-white/14 text-[var(--color-paper)]" : ""}>{tab.badge}</Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>{activeTab.content}</div>
    </div>
  );
}
