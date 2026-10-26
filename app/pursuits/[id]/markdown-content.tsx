"use client";

import React from "react";
import { sanitizeUrl, stripRawHtml } from "../../../lib/sanitization";

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenize inline code, links, bold, and italics safely without dangerouslySetInnerHTML
  const pattern = /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      nodes.push(
        <code
          key={`inline-${key++}`}
          className="rounded-[2px] border border-[var(--rule)] bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[0.86em] text-[var(--ink)]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const splitIdx = token.indexOf("](");
      const label = token.slice(1, splitIdx);
      const href = token.slice(splitIdx + 2, -1);
      const safeHref = sanitizeUrl(href);
      nodes.push(
        <a
          key={`inline-${key++}`}
          href={safeHref}
          target={safeHref.startsWith("http") ? "_blank" : undefined}
          rel={safeHref.startsWith("http") ? "noreferrer noopener" : undefined}
          className="font-medium text-[var(--ink)] underline decoration-[var(--rule-strong)] underline-offset-2 hover:decoration-[var(--signal)]"
        >
          {label}
        </a>
      );
    } else if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      nodes.push(
        <strong key={`inline-${key++}`} className="font-semibold text-[var(--ink)]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      nodes.push(
        <em key={`inline-${key++}`} className="italic text-[var(--ink)]">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      nodes.push(token);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export function MarkdownContent({
  content,
  className = ""
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;

  const sanitizedContent = stripRawHtml(content);
  const lines = sanitizedContent.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      blocks.push(
        <div
          key={`block-${blockKey++}`}
          className="my-2.5 overflow-hidden rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)]"
        >
          {lang ? (
            <div className="border-b border-[var(--rule)] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
              {lang}
            </div>
          ) : null}
          <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-[var(--ink)]">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Headings (rendered as styled divs/h4 to preserve page heading hierarchy)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizeClass =
        level === 1
          ? "mt-3 mb-1.5 text-[16px] font-semibold tracking-tight text-[var(--ink)]"
          : level === 2
            ? "mt-3 mb-1 text-[14.5px] font-semibold tracking-tight text-[var(--ink)]"
            : "mt-2.5 mb-1 text-[13.5px] font-semibold text-[var(--ink)]";
      blocks.push(
        <div key={`block-${blockKey++}`} className={sizeClass}>
          {renderInline(text)}
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={`block-${blockKey++}`}
          className="my-2 border-l-2 border-[var(--rule-strong)] pl-3 text-[13.5px] italic text-[var(--ink-secondary)]"
        >
          {quoteLines.map((ql, idx) => (
            <p key={idx} className={idx > 0 ? "mt-1" : ""}>
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul
          key={`block-${blockKey++}`}
          className="my-2 list-disc space-y-1 pl-5 text-[var(--ink)] marker:text-[var(--ink-muted)]"
        >
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol
          key={`block-${blockKey++}`}
          className="my-2 list-decimal space-y-1 pl-5 text-[var(--ink)] marker:font-mono marker:text-[12px] marker:text-[var(--ink-muted)]"
        >
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={`block-${blockKey++}`} className="my-3 border-[var(--rule)]" />);
      i++;
      continue;
    }

    // Standard paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`block-${blockKey++}`} className="my-1.5 whitespace-pre-wrap leading-[1.62]">
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 ? "\n" : null}
            {renderInline(pl)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className={`text-[14.5px] text-[var(--ink)] ${className}`}>{blocks}</div>;
}
