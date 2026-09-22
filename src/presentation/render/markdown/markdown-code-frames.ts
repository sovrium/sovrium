/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Code-block chrome for docs markdown fences.
 *
 * ## Why this exists
 *
 * A docs fence and a config `code` component are the same artifact to a reader,
 * and until now they were built by two unrelated implementations: the config
 * component server-renders a `<figure data-code-frame>` with a header, while a
 * docs fence rendered a bare `<pre class="shiki">` and had a "Copy" button
 * appended CLIENT-SIDE by a separate inline script. The two drifted in markup,
 * in styling, and in what a screen-reader user heard — and the client-injected
 * button meant a reader with scripts blocked, a crawler, and the SSR-built
 * search index all saw a bare `<pre>`.
 *
 * This module puts the docs fence on the SAME frame the config renderer emits,
 * server-side.
 *
 * ## Where it runs in the pipeline, and why it has to run there
 *
 * AFTER `sanitizeRichTextHTML` — the same seam `spliceMarkdownDirectives` uses,
 * for the same reason. The canonical allowlist (security rule S2) drops
 * `<button>`, `<figure>`, `<figcaption>`, `<svg>` and EVERY `data-*` attribute,
 * so chrome emitted before the sanitiser would be silently stripped, and
 * widening the allowlist to accommodate it would re-open the XSS surface the
 * allowlist exists to close. Server-generated chrome wrapped around
 * already-sanitised content is the established pattern here.
 *
 * The fence's ordinal therefore has to cross the sanitiser as a CLASS
 * (`sv-md-code-N`, stamped by `shiki-highlighter.ts`) — classes survive,
 * `data-*` does not — so the splice can pair each `<pre>` with its
 * `{ lang, title }` entry.
 *
 * It runs after the directive splice, not before: directive placeholders are
 * matched with a non-greedy `[\s\S]*?</div>`, and injecting frame markup into
 * their inner HTML first would risk terminating that match early.
 */

import { resolveDefaultCodeFrame } from '@/domain/models/app/pages/code-frame-defaults'
import {
  computeCodeFrameHeaderClasses,
  computeCodeFrameShellClasses,
} from '@/presentation/design/code-frame-default-classes'
import { renderCodeCopyControlHtml } from '@/presentation/render/elements/code-copy-glyphs'
import type { MarkdownCodeBlock } from '@/domain/kernel/markdown/markdown-renderer'

/**
 * Copy-button labels for docs fences. The docs article is not a component with
 * authored `copyLabel` / `copiedLabel` fields, so the frame uses the same
 * defaults the `code` renderer falls back to — keeping the accessible name a
 * reader hears identical on both surfaces.
 */
const COPY_LABEL = 'Copy'
const COPIED_LABEL = 'Copied'

/**
 * Match a highlighted (or plain-fallback) fence `<pre>` carrying the ordinal
 * class the highlighter stamped on it. Non-greedy to the first `</pre>`: Shiki
 * never nests a `<pre>`, and the un-highlighted fallback is a single block too.
 */
const FENCE_RE = /<pre\b[^>]*\bsv-md-code-(\d+)\b[^>]*>[\s\S]*?<\/pre>/g

/** Escape text for safe inclusion in HTML element content. */
const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Mark the fence's `<pre>` as the copy TARGET and the command surface.
 *
 * The copy scope is the `<figure>` (the button lives in the header, above the
 * code), so the delegated handler needs an explicit target rather than the
 * scope's first `<pre>` — a docs fence has only one, but the contract is shared
 * with the config renderer, whose framed blocks can also hold a printed output.
 */
const markCommandPre = (preHtml: string): string =>
  preHtml.replace(/^<pre\b/, '<pre data-code-command="true" data-copy-target="true"')

/**
 * Build the frame for a single fence: a `<figure>` holding a header that names
 * the block and carries the copy control, then the highlighted `<pre>`.
 *
 * The header text is the author's explicit `title=` when they wrote one, and the
 * language-derived default otherwise — 1000+ docs fences carry no title, and a
 * header only a hand-authored subset gets would leave the docs looking
 * half-migrated.
 */
const renderFenceFrame = (block: MarkdownCodeBlock, preHtml: string): string => {
  const fallback = resolveDefaultCodeFrame(block.lang)
  const { title } = block
  const frame = title === undefined ? fallback.frame : 'file'
  const label = title ?? fallback.label
  const headerText = frame === 'file' ? label : `>_ ${label}`
  const headerMarker = frame === 'file' ? 'data-code-filename="true"' : 'data-code-terminal="true"'
  return [
    `<figure data-code-frame="${frame}" data-code-copy-scope="true"`,
    ` aria-label="${escapeText(label).replace(/"/g, '&quot;')}"`,
    ` class="${computeCodeFrameShellClasses()}">`,
    `<figcaption ${headerMarker} class="${computeCodeFrameHeaderClasses()}">`,
    `<span>${escapeText(headerText)}</span>`,
    renderCodeCopyControlHtml(COPY_LABEL, COPIED_LABEL),
    `</figcaption>`,
    markCommandPre(preHtml),
    `</figure>`,
  ].join('')
}

/**
 * Wrap every docs markdown fence in the shared code-block frame.
 *
 * Returns the input verbatim when the article has no fences. A `<pre>` whose
 * ordinal has no matching entry is left alone rather than framed with a guessed
 * header — a lost placeholder should degrade to today's bare block, not to a
 * mislabelled one.
 */
export const spliceMarkdownCodeFrames = (
  html: string,
  codeBlocks: readonly MarkdownCodeBlock[]
): string => {
  if (codeBlocks.length === 0) return html
  return html.replace(FENCE_RE, (match, indexStr: string) => {
    const block = codeBlocks[Number(indexStr)]
    if (block === undefined) return match
    return renderFenceFrame(block, match)
  })
}
