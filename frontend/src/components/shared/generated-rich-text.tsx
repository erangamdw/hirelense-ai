"use client";

import type { ReactNode } from "react";

type GeneratedRichTextProps = {
  text: string;
  className?: string;
  variant?: "plain" | "framed" | "inverse";
};

type ParagraphBlock = {
  type: "paragraph";
  content: string;
};

type ListBlock = {
  type: "unordered-list" | "ordered-list";
  items: string[];
};

type TextBlock = ParagraphBlock | ListBlock;

function parseBlocks(text: string): TextBlock[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  const blocks: TextBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index].trim();

    if (!currentLine) {
      index += 1;
      continue;
    }

    const unorderedMatch = currentLine.match(/^[-*]\s+(.*)$/);
    const orderedMatch = currentLine.match(/^\d+\.\s+(.*)$/);

    if (unorderedMatch || orderedMatch) {
      const type = unorderedMatch ? "unordered-list" : "ordered-list";
      const items: string[] = [];

      while (index < lines.length) {
        const line = lines[index];
        const trimmedLine = line.trim();
        const currentUnorderedMatch = trimmedLine.match(/^[-*]\s+(.*)$/);
        const currentOrderedMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);
        const currentMatch = type === "unordered-list" ? currentUnorderedMatch : currentOrderedMatch;

        if (currentMatch) {
          items.push(currentMatch[1].trim());
          index += 1;
          continue;
        }

        if (!trimmedLine) {
          index += 1;
          break;
        }

        if (items.length) {
          items[items.length - 1] = `${items[items.length - 1]}\n${trimmedLine}`;
          index += 1;
          continue;
        }

        break;
      }

      blocks.push({ type, items });
      continue;
    }

    const paragraphLines: string[] = [currentLine];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index].trim();
      if (!nextLine) {
        index += 1;
        break;
      }

      if (/^[-*]\s+/.test(nextLine) || /^\d+\.\s+/.test(nextLine)) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      content: paragraphLines.join("\n"),
    });
  }

  return blocks;
}

function renderInlineContent(text: string, variant: "plain" | "framed" | "inverse"): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong
          key={`${segment}-${index}`}
          className={variant === "inverse" ? "font-semibold text-white" : "font-semibold text-[var(--color-ink)]"}
        >
          {segment.slice(2, -2)}
        </strong>
      );
    }

    if (segment.startsWith("*") && segment.endsWith("*")) {
      return (
        <em
          key={`${segment}-${index}`}
          className={variant === "inverse" ? "italic text-white/90" : "italic text-[var(--color-ink)]"}
        >
          {segment.slice(1, -1)}
        </em>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}

function renderLineBreaks(text: string, variant: "plain" | "framed" | "inverse") {
  return text.split("\n").map((line, index, lines) => (
    <span key={`${line}-${index}`}>
      {renderInlineContent(line, variant)}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function getBlockClassName(variant: "plain" | "framed" | "inverse") {
  if (variant === "framed") {
    return "rounded-2xl border border-[var(--color-border)] bg-white px-4 py-4 text-sm leading-7 text-[var(--color-ink-muted)] shadow-[0_14px_34px_-28px_rgba(27,31,59,0.42)]";
  }

  if (variant === "inverse") {
    return "rounded-2xl border border-white/10 bg-white/8 px-4 py-4 text-sm leading-7 text-white/88";
  }

  return "text-sm leading-7 text-[var(--color-ink-muted)]";
}

export function GeneratedRichText({ text, className, variant = "plain" }: GeneratedRichTextProps) {
  const blocks = parseBlocks(text);
  const blockClassName = getBlockClassName(variant);
  const listSpacingClassName = variant === "plain" ? "space-y-3 pl-5" : "space-y-3 pl-6";
  const containerClassName =
    className ??
    (variant === "plain"
      ? "space-y-4 text-sm leading-7 text-[var(--color-ink-muted)]"
      : "space-y-4");

  return (
    <div className={containerClassName}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <div key={`paragraph-${index}`} className={blockClassName}>
              <p className="whitespace-pre-wrap break-words">{renderLineBreaks(block.content, variant)}</p>
            </div>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <div key={`ordered-${index}`} className={blockClassName}>
              <ol className={`${listSpacingClassName}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="break-words pl-1">
                  {renderLineBreaks(item, variant)}
                </li>
              ))}
              </ol>
            </div>
          );
        }

        return (
          <div key={`unordered-${index}`} className={blockClassName}>
            <ul className={`${listSpacingClassName}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`${item}-${itemIndex}`} className="break-words pl-1">
                {renderLineBreaks(item, variant)}
              </li>
            ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
