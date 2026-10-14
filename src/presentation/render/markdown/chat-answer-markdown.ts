/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An assistant's chat answer as the window draws it: its Markdown rendered by
 * the chat renderer (no raw HTML, no images), then cleaned by the ONE canonical
 * sanitizer (S2). The chat stream carries the result, so the browser ships
 * neither a Markdown renderer nor a sanitizer.
 */

import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { renderChatMarkdownToHtml } from '@/infrastructure/markdown/chat-markdown-renderer'

/** Render and sanitize an answer's Markdown; `''` for an empty answer. */
export const renderChatAnswerHtml = (markdown: string): string =>
  markdown.length === 0 ? '' : sanitizeRichTextHTML(renderChatMarkdownToHtml(markdown))
