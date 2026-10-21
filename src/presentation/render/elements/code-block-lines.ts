/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Split a highlighted `<code>` into shadcn/ui's Code Block lines: one
 * `code-block-line` per source line, carrying its variant, around one
 * `code-block-line-content` holding that line's tokens.
 *
 * ## Why it works on the HTML string
 *
 * It serves two surfaces that only meet as HTML: the `code` component injects
 * its highlighted subtree with `dangerouslySetInnerHTML`, and a markdown fence
 * is framed by a splice that runs AFTER the canonical sanitizer. The sanitizer
 * drops every `data-*` attribute, so the line parts cannot be asked of the
 * highlighter: they are added here, on markup the sanitizer has already passed,
 * exactly as the frame around them is.
 *
 * Shiki writes one `<span class="line">` per line, joined by a newline, and no
 * token ever spans a newline; the un-highlighted fallback is escaped text with
 * newlines. Splitting the body on the newline therefore yields one line in
 * both shapes. The newlines are KEPT between the line parts: the code is a grid,
 * so they draw nothing, and they are what makes the `<code>`'s text — the copy
 * payload — the source with its line breaks.
 *
 * ## The copy payload of a diff
 *
 * The delegated copy handler copies the `<code>`'s text. A diff line's sign is
 * drawn by the line's `::after` and taken out of its content, so a reader does
 * not see it twice — and so it would be lost from the clipboard. It is kept in a
 * `hidden` element at the head of the line, outside the line content: never
 * drawn, still text, so the copied block is the diff as written and can still
 * be applied.
 */

import {
  CODE_BLOCK_LINE_CONTENT_CLASSES,
  computeCodeBlockCodeClasses,
  computeCodeBlockLineClasses,
  type CodeBlockLineVariant,
} from '@/presentation/design/code-block-line-classes'

/** What a block asks of its lines. Every field is optional; none changes the copied text. */
export interface CodeBlockLineOptions {
  /** The block's language; `diff` draws its `+` and `-` lines as added and removed. */
  readonly language?: string | undefined
  /** The number the first line carries (default 1). */
  readonly startLine?: number | undefined
  /** Lines to highlight, by the number the reader sees: counted from `startLine`. */
  readonly highlightLines?: readonly number[] | undefined
  /** Wrap long lines instead of scrolling them. */
  readonly wrap?: boolean | undefined
  /** The block draws a line-number gutter beside its lines. */
  readonly numbered?: boolean | undefined
}

const CODE_RE = /^<code\b([^>]*)>([\s\S]*)<\/code>$/
const CLASS_RE = /\bclass="([^"]*)"/
const SHIKI_LINE_RE = /^<span class="line">([\s\S]*)<\/span>$/
/** The leading tags of a line, then its first character. */
const LEADING_CHAR_RE = /^((?:<[^>]+>)*)([ +-])/
/** One tag, the unit a line's visible text is read between. */
const TAG_RE = /<[^>]+>/

/**
 * The text a line shows: the runs between its tags, joined. Read only to tell
 * what the line starts with; never written back into markup.
 */
const visibleTextOf = (content: string): string => content.split(TAG_RE).join('')

/** A line's content with its diff sign taken out, and the sign that was taken. */
interface DiffLine {
  readonly variant: CodeBlockLineVariant
  readonly sign: string
  readonly content: string
}

/**
 * Read a diff line's sign. A `+++ ` or `--- ` file header is not a change, and
 * is left as it is written.
 */
function readDiffLine(content: string): DiffLine | undefined {
  const text = visibleTextOf(content)
  if (text.startsWith('+++ ') || text.startsWith('--- ')) return undefined
  const match = LEADING_CHAR_RE.exec(content)
  if (match === null) return undefined
  const [whole, tags = '', sign = ''] = match
  const variant: CodeBlockLineVariant =
    sign === '+' ? 'added' : sign === '-' ? 'removed' : 'default'
  return { variant, sign, content: tags + content.slice(whole.length) }
}

/** One line part, its sign kept as hidden text when a diff took it from the content. */
function renderLine(
  content: string,
  variant: CodeBlockLineVariant,
  sign: string,
  numbered: boolean
): string {
  const hiddenSign = sign === '' ? '' : `<span hidden>${sign}</span>`
  return (
    `<span data-slot="code-block-line" data-variant="${variant}" class="${computeCodeBlockLineClasses(variant, numbered)}">` +
    hiddenSign +
    `<span data-slot="code-block-line-content" class="${CODE_BLOCK_LINE_CONTENT_CLASSES}">${content}</span></span>`
  )
}

/** The variant and content of the line at `index`, before it is drawn. */
function shapeLine(
  raw: string,
  index: number,
  options: CodeBlockLineOptions
): { readonly content: string; readonly variant: CodeBlockLineVariant; readonly sign: string } {
  const content = SHIKI_LINE_RE.exec(raw)?.[1] ?? raw
  if (options.language === 'diff') {
    const diff = readDiffLine(content)
    if (diff !== undefined) return diff
  }
  const number = (options.startLine ?? 1) + index
  const highlighted = options.highlightLines?.includes(number) === true
  return { content, variant: highlighted ? 'highlighted' : 'default', sign: '' }
}

/**
 * Rewrite one `<code>…</code>` into the Code Block's `code-block-code` with one
 * line part per source line. Markup that is not a single `<code>` element is
 * returned untouched, so an unexpected highlighter shape degrades to the block
 * it was rather than to a broken one.
 */
export function shapeCodeBlockCode(codeHtml: string, options: CodeBlockLineOptions = {}): string {
  const match = CODE_RE.exec(codeHtml)
  if (match === null) return codeHtml
  const [, attrs = '', body = ''] = match
  const numbered = options.numbered === true
  const lines = body.split('\n').map((raw, index) => {
    const { content, variant, sign } = shapeLine(raw, index, options)
    return renderLine(content, variant, sign, numbered)
  })
  const authored = CLASS_RE.exec(attrs)?.[1]
  const classes = [authored, computeCodeBlockCodeClasses(options.wrap === true)]
    .filter((part) => part !== undefined && part.length > 0)
    .join(' ')
  return `<code data-slot="code-block-code" class="${classes}">${lines.join('\n')}</code>`
}

/** The same rewrite, applied to the `<code>` inside a whole `<pre>…</pre>`. */
export function shapeCodeBlockPre(preHtml: string, options: CodeBlockLineOptions = {}): string {
  return preHtml.replace(/<code\b[^>]*>[\s\S]*<\/code>/, (code) =>
    shapeCodeBlockCode(code, options)
  )
}
