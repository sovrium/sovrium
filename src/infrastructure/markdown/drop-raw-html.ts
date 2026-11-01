/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `drop_raw_html` core rule of the page markdown renderer.
 *
 * The page renderer parses with `html: true`, so markdown-it tokenises author
 * raw HTML — an HTML comment, a `<script>`, an `<img onerror>`, a CDATA
 * section, a processing instruction, a `<!DOCTYPE>` — as `html_block` and
 * `html_inline` tokens. This rule removes every one of them before headings
 * are read and before anything renders, so raw HTML is neither emitted nor
 * printed as text. It drops tokens; it does not sanitise: the canonical
 * `sanitizeRichTextHTML` downstream stays the one sanitiser.
 */

/** The slice of markdown-it's token the rule reads and rewrites. */
export interface RawHtmlToken {
  readonly type: string
  content: string
  children: RawHtmlToken[] | null
}

/** An inline `<script>` / `<style>` open tag: the text up to its close tag is code, not prose. */
const RAW_TEXT_OPEN = /^<(script|style)\b/i

/** `true` when an odd run of backslashes escapes the character at `index`. */
const isEscapedAt = (text: string, index: number): boolean =>
  ((/\\*$/.exec(text.slice(0, index))?.[0] ?? '').length & 1) === 1

/**
 * The first occurrence of `needle` in `text` at or after `from` that no
 * backslash escapes: `\<b>` is the literal text `<b>`, not the tag it spells.
 */
const unescapedIndexOf = (text: string, needle: string, from: number): number => {
  const index = text.indexOf(needle, from)
  return index > 0 && isEscapedAt(text, index) ? unescapedIndexOf(text, needle, index + 1) : index
}

interface Walk {
  /** The children that survive, in order. */
  readonly kept: readonly RawHtmlToken[]
  /** The source ranges of `content` the dropped HTML occupied. */
  readonly cuts: readonly (readonly [number, number])[]
  /** Where in `content` the search for the next token's source resumes. */
  readonly cursor: number
  /** Inside an inline `<script>` / `<style>`: where it opened, and its close tag. */
  readonly open?: { readonly at: number; readonly closer: RegExp }
}

/** Inside an inline `<script>` / `<style>`: everything is dropped up to its close tag. */
const stepInsideRawText = (
  content: string,
  walk: Walk & { readonly open: NonNullable<Walk['open']> },
  child: RawHtmlToken
): Walk => {
  if (child.type !== 'html_inline' || !walk.open.closer.test(child.content)) return walk
  const at = unescapedIndexOf(content, child.content, walk.cursor)
  const end = at < 0 ? content.length : at + child.content.length
  return { kept: walk.kept, cuts: [...walk.cuts, [walk.open.at, end]], cursor: end }
}

/** An `html_inline` child: cut, or, for an unclosed `<script>` / `<style>`, the start of a run. */
const stepHtmlInline = (content: string, walk: Walk, child: RawHtmlToken): Walk => {
  const at = unescapedIndexOf(content, child.content, walk.cursor)
  if (at < 0) return walk
  const end = at + child.content.length
  const open = RAW_TEXT_OPEN.exec(child.content)
  return open === null || new RegExp(`</${open[1]}\\s*>`, 'i').test(child.content)
    ? { ...walk, cuts: [...walk.cuts, [at, end]], cursor: end }
    : { ...walk, cursor: end, open: { at, closer: new RegExp(`^</${open[1]}\\s*>`, 'i') } }
}

/**
 * One step of {@link withoutInlineHtml}. Every `html_inline` child is dropped,
 * and so is everything between an inline `<script>` / `<style>` and its close
 * tag (to the end of the inline when the close tag never comes). Each dropped
 * tag is located in `content` from a cursor, past the code spans before it, so
 * a literal `<b>` in a code span or behind a backslash is never the one cut.
 */
const step = (content: string, walk: Walk, child: RawHtmlToken): Walk => {
  if (walk.open !== undefined)
    return stepInsideRawText(content, { ...walk, open: walk.open }, child)
  if (child.type === 'html_inline') return stepHtmlInline(content, walk, child)
  if (child.type !== 'code_inline') return { ...walk, kept: [...walk.kept, child] }
  const at = content.indexOf(child.content, walk.cursor)
  const cursor = at < 0 ? walk.cursor : at + child.content.length
  return { ...walk, kept: [...walk.kept, child], cursor }
}

/**
 * An inline token's children without their raw HTML, and its `content` (which
 * the renderer reads for a heading's text and anchor) without the source that
 * HTML occupied: `## Loading <!-- note -->` reads "Loading".
 */
const withoutInlineHtml = (
  content: string,
  children: readonly RawHtmlToken[]
): { readonly kept: readonly RawHtmlToken[]; readonly content: string } => {
  const walked = children.reduce<Walk>((walk, child) => step(content, walk, child), {
    kept: [],
    cuts: [],
    cursor: 0,
  })
  const cuts =
    walked.open === undefined ? walked.cuts : [...walked.cuts, [walked.open.at, content.length]]
  const rest = cuts.reduce<{ readonly text: string; readonly from: number }>(
    (acc, [start, end]) => ({ text: `${acc.text}${content.slice(acc.from, start)} `, from: end }),
    { text: '', from: 0 }
  )
  return {
    kept: walked.kept,
    content: `${rest.text}${content.slice(rest.from)}`.replace(/[ \t]{2,}/g, ' ').trim(),
  }
}

/**
 * Core rule: remove every raw HTML token from the parsed stream. A block of
 * raw HTML goes whole; an inline token loses its `html_inline` children and
 * the source they occupied in its `content`.
 */
export const dropRawHtml = (state: { tokens: RawHtmlToken[] }): void => {
  state.tokens = state.tokens.filter((token) => token.type !== 'html_block')
  state.tokens.forEach((token) => {
    const children = token.children ?? []
    if (!children.some((child) => child.type === 'html_inline')) return
    const { kept, content } = withoutInlineHtml(token.content, children)
    token.content = content
    token.children = [...kept]
  })
}
