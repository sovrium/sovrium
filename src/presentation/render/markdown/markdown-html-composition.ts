/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { hasCodeRoleClasses } from '@/domain/models/app/design/code-block-service'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { highlightCodeBlocks } from '@/infrastructure/markdown/shiki-highlighter'
import { spliceMarkdownCodeFrames } from '@/presentation/render/markdown/markdown-code-frames'
import { spliceMarkdownDirectives } from '@/presentation/render/markdown/markdown-directives'
import type { App } from '@/domain/models/app'
import type { renderMarkdownToHtml } from '@/infrastructure/markdown/markdown-it-renderer'

/**
 * Compose the final HTML from a `RenderedMarkdown` payload by walking the
 * full presentation-layer pipeline:
 *
 *   1. Splice Shiki-highlighted markup into `<pre><code data-md-code="N">`
 *      placeholders (cluster 2 — class-based, no inline `style`).
 *   2. Sanitise the whole composed HTML via the canonical
 *      `sanitizeRichTextHTML` (security rule S2 — one sanitiser, no widening).
 *   3. Splice directive component HTML (alert, button, icon shell, code-block
 *      chrome) into the `<div class="md-directive md-directive-N">`
 *      placeholders the domain renderer emitted (cluster 3). Runs AFTER the
 *      sanitiser so the component chrome's `role`/`data-component`/`<button>`/
 *      `<svg>` survives — placeholders are sanitiser-safe (only `class`,
 *      which the allowlist keeps), so they pass through step 2 untouched.
 *      See `markdown-directives.ts` module header for the boundary rationale.
 *   4. Wrap every fence in the shared code-block frame — a header naming the
 *      block plus a server-rendered copy button — so a docs fence and a config
 *      `code` component are the same artifact in the markup, not merely to the
 *      eye. Post-sanitiser for the same reason as step 3, and AFTER step 3
 *      because directive placeholders are matched non-greedily to their first
 *      `</div>`.
 */
export const composeMarkdownHtml = async (
  rendered: ReturnType<typeof renderMarkdownToHtml>,
  app: App | undefined,
  currentLang: string | undefined
): Promise<string> => {
  const highlightedHtml = await highlightCodeBlocks(rendered.html, rendered.codeBlocks, {
    roleClasses: hasCodeRoleClasses(app?.design),
  })
  const sanitizedHtml = sanitizeRichTextHTML(highlightedHtml)
  const withDirectives = spliceMarkdownDirectives(sanitizedHtml, rendered.directives, app?.design)
  return spliceMarkdownCodeFrames(withDirectives, rendered.codeBlocks, {
    copy: resolveInterpreterString('code.copy', currentLang, app?.languages),
    copied: resolveInterpreterString('code.copied', currentLang, app?.languages),
  })
}
