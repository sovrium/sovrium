/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inline markdown for one-line guidance — a form field's help text, a form's
 * or a step's description.
 *
 * The subset is what a line of guidance has room for: links (always opened in
 * a new tab), bold, italic, strikethrough, inline code and line breaks. The
 * renderer escapes raw HTML rather than parsing it, and its output then passes
 * the ONE canonical sanitizer before it reaches the page (S2), so what a
 * caller may `dangerouslySetInnerHTML` is always this function's result.
 */

import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { renderMarkdownInlineToHtml } from '@/infrastructure/markdown/markdown-it-renderer'

/**
 * Render `source` as sanitized inline HTML; `''` when there is nothing to
 * show, so a caller can omit the element entirely.
 */
export const renderInlineMarkdown = (source: string | undefined): string => {
  if (source === undefined || source.trim() === '') return ''
  return sanitizeRichTextHTML(renderMarkdownInlineToHtml(source))
}
