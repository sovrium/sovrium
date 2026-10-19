/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  highlightCodeToHtml,
  withFenceIndexClass,
} from '@/infrastructure/markdown/shiki-highlighter'

/**
 * The highlighter of an ai-chat answer's blocks of code: the same Shiki engine
 * and class transformer as the docs fences (`shiki-highlighter.ts`), memoised,
 * because a streamed answer is rendered again at every snapshot.
 */

/**
 * The most highlighted blocks kept. Without a memo every fence already written
 * would be tokenised again at each snapshot; with it, a snapshot costs the one
 * fence still being written. Bounded, oldest first out, so a long-lived process
 * does not grow it without end.
 */
const MAX_MEMOISED_FENCES = 256

/** Highlighted fences, by language and source. */
const FENCE_MEMO = new Map<string, string>()

/** Remember a highlighted fence, dropping the oldest past {@link MAX_MEMOISED_FENCES}. */
const memoiseFence = (key: string, html: string): string => {
  FENCE_MEMO.set(key, html)
  if (FENCE_MEMO.size > MAX_MEMOISED_FENCES) {
    const oldest = FENCE_MEMO.keys().next().value
    if (oldest !== undefined) FENCE_MEMO.delete(oldest)
  }
  return html
}

/** A fence placeholder carrying its ordinal (`<pre class="sv-md-code-N shiki">`). */
const ORDINAL_FENCE_RE = /<pre class="sv-md-code-(\d+) shiki">[\s\S]*?<\/pre>/g

/**
 * A highlighted block that came back without Shiki's own `<pre class="shiki">`
 * — an unknown grammar's plain fallback — gets the class, so the code-block
 * chrome draws it like every other block.
 */
const withShikiClass = (html: string): string =>
  /^<pre\b[^>]*\bclass="[^"]*\bshiki\b/.test(html)
    ? html
    : html.replace(/^<pre\b/, '<pre class="shiki"')

/** One block highlighted, from the memo when its language and source were seen. */
const highlightFence = async (lang: string, code: string): Promise<string> => {
  const key = `${lang}\u0000${code}`
  const cached = FENCE_MEMO.get(key)
  return cached ?? memoiseFence(key, withShikiClass(await highlightCodeToHtml(lang, code)))
}

/**
 * Highlight the ordinal-stamped placeholders of a chat answer (written by the
 * chat renderer) in the engine's default palette, keeping each one's ordinal
 * class so the frame can still find it after the sanitizer. A block naming no
 * language, and a placeholder with no entry, are left as they are: plain, and
 * still framed.
 */
export const highlightOrdinalFences = async (
  html: string,
  codeBlocks: readonly { readonly lang: string; readonly code: string }[]
): Promise<string> => {
  if (codeBlocks.length === 0) return html
  const highlighted = await Promise.all(
    codeBlocks.map(({ lang, code }) =>
      lang.length === 0 ? Promise.resolve(undefined) : highlightFence(lang, code)
    )
  )
  return html.replace(ORDINAL_FENCE_RE, (match, idxStr: string) => {
    const idx = Number(idxStr)
    const fence = highlighted[idx]
    return fence === undefined ? match : withFenceIndexClass(fence, idx)
  })
}
