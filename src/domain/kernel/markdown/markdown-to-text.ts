/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Markdown → plain-text conversion — pure domain logic
 * ([internal ref]: [internal ref]).
 *
 * Strips Markdown formatting markers so a `.md` knowledge document is
 * embedded as readable prose, not raw syntax. The document *structure*
 * (heading text, list item text, paragraph breaks) is preserved — only the
 * decorative markers (`#`, `**`, `_`, `` ` ``, link/image syntax, etc.) are
 * removed.
 *
 * Pure: no I/O, no dependencies — a sequence of regex substitutions.
 */

/** One regex substitution applied while stripping Markdown. */
interface Substitution {
  readonly pattern: RegExp
  readonly replacement: string
}

/**
 * Ordered Markdown-marker substitutions. Order matters: fenced code blocks
 * and images are unwrapped before inline emphasis so their inner markers are
 * not double-processed.
 */
const SUBSTITUTIONS: ReadonlyArray<Substitution> = [
  // Fenced code blocks ```lang ... ``` → inner text only.
  { pattern: /```[^\n]*\n([\s\S]*?)```/g, replacement: '$1' },
  // Images ![alt](url) → alt text.
  { pattern: /!\[([^\]]*)\]\([^)]*\)/g, replacement: '$1' },
  // Links [text](url) → text.
  { pattern: /\[([^\]]+)\]\([^)]*\)/g, replacement: '$1' },
  // ATX headings: leading `#`+ and trailing `#`+ on a line.
  { pattern: /^#{1,6}[ \t]+/gm, replacement: '' },
  { pattern: /[ \t]+#+[ \t]*$/gm, replacement: '' },
  // Blockquote markers.
  { pattern: /^[ \t]*>[ \t]?/gm, replacement: '' },
  // Unordered list markers (-, *, +) at line start.
  { pattern: /^[ \t]*[-*+][ \t]+/gm, replacement: '' },
  // Ordered list markers (1. 2. ...) at line start.
  { pattern: /^[ \t]*\d+\.[ \t]+/gm, replacement: '' },
  // Horizontal rules (---, ***, ___) on their own line.
  { pattern: /^[ \t]*([-*_])[ \t]*\1[ \t]*\1[ \t-*_]*$/gm, replacement: '' },
  // Bold + italic emphasis: **text**, __text__, *text*, _text_.
  { pattern: /(\*\*|__)(.*?)\1/g, replacement: '$2' },
  { pattern: /(\*|_)(.*?)\1/g, replacement: '$2' },
  // Inline code `text` → text.
  { pattern: /`([^`]+)`/g, replacement: '$1' },
]

/**
 * Convert Markdown source to plain text by stripping formatting markers.
 *
 * - Heading / list / paragraph *text* is preserved; only markers are removed.
 * - Runs of 3+ blank lines collapse to a single blank line.
 * - The result is trimmed of leading/trailing whitespace.
 */
export const markdownToText = (markdown: string): string => {
  const stripped = SUBSTITUTIONS.reduce(
    (text, { pattern, replacement }) => text.replace(pattern, replacement),
    markdown
  )
  return stripped
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
}
