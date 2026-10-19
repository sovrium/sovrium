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
  computeCodeBlockClasses,
  computeCodeBlockFilenameClasses,
  computeCodeBlockHeaderClasses,
} from '@/presentation/design/code-block-default-classes'
import {
  computeCodeBlockActionsClasses,
  computeCodeBlockTitleClasses,
} from '@/presentation/design/code-block-line-classes'
import { shapeCodeBlockPre } from '@/presentation/render/elements/code-block-lines'
import {
  CODE_COPY_STATUS_HTML,
  renderCodeCopyButtonHtml,
} from '@/presentation/render/elements/code-copy-glyphs'
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
  preHtml.replace(
    /^<pre\b/,
    '<pre data-slot="code-block-content" data-code-command="true" data-copy-target="true"'
  )

/** How a frame is drawn: the docs keep the defaults, an ai-chat answer asks for a small one. */
export interface FenceFrameOptions {
  readonly size: 'default' | 'sm'
  readonly variant: 'default' | 'destructive'
  /**
   * What the header names: `docs-default` is the author's `title=`, else the
   * file or terminal the language implies (`query.sql`, `>_ Terminal`);
   * `language` is the language the fence names, verbatim, and no title at all
   * for a fence naming none.
   */
  readonly title: 'docs-default' | 'language'
  /** Whether the header carries the copy button and its status region. */
  readonly copy: boolean
}

/** A docs fence's frame: default size and variant, the derived title, a copy button. */
const DOCS_FENCE_FRAME: FenceFrameOptions = {
  size: 'default',
  variant: 'default',
  title: 'docs-default',
  copy: true,
}

/** The header a frame draws: its frame kind, and the text naming the block, if any. */
interface FenceHeader {
  readonly frame: 'file' | 'terminal'
  readonly label: string | undefined
  readonly text: string | undefined
}

/** Resolve a fence's header under the title mode asked for. */
const resolveFenceHeader = (
  block: Pick<MarkdownCodeBlock, 'lang' | 'title'>,
  mode: FenceFrameOptions['title']
): FenceHeader => {
  if (mode === 'language') {
    const label = block.lang.length === 0 ? undefined : block.lang
    return { frame: 'file', label, text: label }
  }
  const fallback = resolveDefaultCodeFrame(block.lang)
  const { title } = block
  const frame = title === undefined ? fallback.frame : 'file'
  const label = title ?? fallback.label
  return { frame, label, text: frame === 'file' ? label : `>_ ${label}` }
}

/** The header's title part, or nothing for a block with no title. */
const renderFenceTitle = (header: FenceHeader): string => {
  if (header.text === undefined) return ''
  const marker = header.frame === 'file' ? 'data-code-filename="true"' : 'data-code-terminal="true"'
  return [
    `<span data-slot="code-block-title" class="${computeCodeBlockTitleClasses()}">`,
    `<span data-slot="code-block-filename" ${marker} class="${computeCodeBlockFilenameClasses()}">`,
    `${escapeText(header.text)}</span></span>`,
  ].join('')
}

/** The header's actions group with the copy control and its status region, when asked for. */
const renderFenceActions = (copy: boolean): string =>
  copy
    ? [
        `<span data-slot="code-block-actions" class="${computeCodeBlockActionsClasses()}">`,
        renderCodeCopyButtonHtml(COPY_LABEL, COPIED_LABEL),
        `</span>`,
        CODE_COPY_STATUS_HTML,
      ].join('')
    : ''

/**
 * Build the frame for a single fence, on the same shadcn/ui Code Block anatomy
 * the `code` component draws: a `<figure>` holding a header with the title and
 * the actions group carrying the copy control, then the highlighted `<pre>`
 * with one line part per source line. The fence's language is passed through,
 * so a `diff` fence draws its `+` and `-` lines as added and removed.
 *
 * Under the docs defaults, the header text is the author's explicit `title=`
 * when they wrote one, and the language-derived default otherwise — 1000+ docs
 * fences carry no title, and a header only a hand-authored subset gets would
 * leave the docs looking half-migrated.
 */
export const renderFenceFrame = (
  block: Pick<MarkdownCodeBlock, 'lang' | 'title'>,
  preHtml: string,
  options: FenceFrameOptions = DOCS_FENCE_FRAME
): string => {
  const header = resolveFenceHeader(block, options.title)
  const label =
    header.label === undefined
      ? ''
      : ` aria-label="${escapeText(header.label).replace(/"/g, '&quot;')}"`
  return [
    `<figure data-slot="code-block" data-size="${options.size}" data-variant="${options.variant}"`,
    ` data-code-frame="${header.frame}" data-code-copy-scope="true"${label}`,
    ` class="${computeCodeBlockClasses()}">`,
    `<figcaption data-slot="code-block-header" class="${computeCodeBlockHeaderClasses()}">`,
    renderFenceTitle(header),
    renderFenceActions(options.copy),
    `</figcaption>`,
    markCommandPre(shapeCodeBlockPre(preHtml, { language: block.lang })),
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

/** An ai-chat answer's frame: small, titled by the language, copyable once the fence closed. */
const chatFenceFrame = (closed: boolean): FenceFrameOptions => ({
  size: 'sm',
  variant: 'default',
  title: 'language',
  copy: closed,
})

/**
 * Wrap every block of code in an ai-chat answer in a small Code Block frame,
 * titled by the language the fence names. A fence still being written while the
 * answer streams is framed too, but without its copy button and status region:
 * half a block is code that does not run, so it gains the button once it closes.
 * A block whose ordinal has no entry is framed as a closed, untitled one, so the
 * answer never draws a bare `<pre>`.
 */
export const spliceChatCodeFrames = (
  html: string,
  codeBlocks: readonly { readonly lang: string; readonly closed: boolean }[]
): string =>
  html.replace(FENCE_RE, (match, indexStr: string) => {
    const block = codeBlocks[Number(indexStr)] ?? { lang: '', closed: true }
    return renderFenceFrame({ lang: block.lang }, match, chatFenceFrame(block.closed))
  })
