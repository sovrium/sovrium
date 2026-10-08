/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  childElements,
  descendantsNamed,
  isElement,
  ownText,
  replaceElements,
  rewriteRoot,
  withChildren,
  type XmlChild,
  type XmlElement,
} from './ooxml-tree'

/**
 * Block tags in a Word part, and how the whole part becomes ONE Handlebars
 * template.
 *
 * ## The model
 *
 * After run normalisation every tag sits inside one `w:t`. The part is then
 * serialized and rendered as a single template: Handlebars leaves the markup
 * alone and expands `{{#each}}`, `{{#if}}`, `{{else}}`, nesting included, over
 * whatever text lies between a block's open and close. That is correct
 * whenever the markup between them is balanced — two tags in the same
 * paragraph, or in sibling paragraphs. Two placements are not, and are moved
 * first, on the tree:
 *
 *  - **A row loop**: the open tag at the start of a row's first cell and its
 *    close at the end of the row's last cell. Left in place, the cells would
 *    repeat INSIDE the row. Both tags move out, beside the `w:tr`, so the whole
 *    row repeats. An open with no close in its row (or a close with no open)
 *    moves alone, which is how a block spans several rows.
 *  - **A tag paragraph**: a paragraph holding block tags and nothing else
 *    (`{{#if client.vip}}` on its own line). Left in place, its empty paragraph
 *    would stay behind as a blank line. It is replaced by its tags, so the
 *    paragraphs between repeat or vanish with their own styles and numbering
 *    (`w:pPr`, `w:numPr`) and leave no empty line.
 *
 * Rows are handled before paragraphs, so a row loop written in a paragraph of
 * its own inside the first cell is a row loop, not a paragraph block.
 *
 * Tags whose markup in between does not balance (a block opened in a cell and
 * closed outside its table) render to XML that does not parse; the caller
 * reports that as the template's fault, naming the part.
 */

const TAG = /\{\{\{?[\s\S]*?\}\}\}?/g

type TagKind = 'open' | 'else' | 'close' | 'comment' | 'inline'

const OPEN = /^\{\{~?\s*(?:#|\^\s*[^\s}~])/
const ELSE = /^\{\{~?\s*(?:else\b|\^\s*~?\}\})/
const CLOSE = /^\{\{~?\s*\//
const COMMENT = /^\{\{~?\s*!/

const tagKind = (tag: string): TagKind => {
  if (ELSE.test(tag)) return 'else'
  if (OPEN.test(tag)) return 'open'
  if (CLOSE.test(tag)) return 'close'
  return COMMENT.test(tag) ? 'comment' : 'inline'
}

interface Token {
  readonly node: XmlElement
  readonly text: string
  readonly index: number
  readonly kind: TagKind
}

const tokensOf = (texts: ReadonlyArray<XmlElement>): ReadonlyArray<Token> =>
  texts.flatMap((node) =>
    [...ownText(node).matchAll(TAG)].map((m) => ({
      node,
      text: m[0],
      index: m.index,
      kind: tagKind(m[0]),
    }))
  )

/** Index of the token that closes `tokens[0]`, or `-1` when the row never closes it. */
const matchOfFirst = (tokens: ReadonlyArray<Token>): number =>
  tokens.reduce<{ readonly depth: number; readonly match: number }>(
    (state, token, i) => {
      if (state.match >= 0) return state
      if (token.kind === 'open') return { ...state, depth: state.depth + 1 }
      if (token.kind !== 'close') return state
      return state.depth === 1 ? { depth: 0, match: i } : { ...state, depth: state.depth - 1 }
    },
    { depth: 0, match: -1 }
  ).match

/** Whether `tokens[last]` closes a block opened before the row. */
const lastClosesOutside = (tokens: ReadonlyArray<Token>): boolean =>
  tokens.reduce<{ readonly depth: number; readonly outside: boolean }>(
    (state, token, i) => {
      if (token.kind === 'open') return { depth: state.depth + 1, outside: false }
      if (token.kind !== 'close') return state
      return state.depth === 0
        ? { depth: 0, outside: i === tokens.length - 1 }
        : { depth: state.depth - 1, outside: false }
    },
    { depth: 0, outside: false }
  ).outside

const STOP_AT_TABLES: ReadonlySet<string> = new Set(['w:tbl'])

const textsOf = (cell: XmlElement | undefined): ReadonlyArray<XmlElement> =>
  cell === undefined ? [] : descendantsNamed(cell, 'w:t', STOP_AT_TABLES)

const startsItsCell = (token: Token, cellTexts: ReadonlyArray<XmlElement>): boolean => {
  const firstFilled = cellTexts.find((t) => ownText(t).trim() !== '')
  return firstFilled === token.node && ownText(token.node).trimStart().startsWith(token.text)
}

const endsItsCell = (token: Token, cellTexts: ReadonlyArray<XmlElement>): boolean => {
  const lastFilled = cellTexts.findLast((t) => ownText(t).trim() !== '')
  return lastFilled === token.node && ownText(token.node).trimEnd().endsWith(token.text)
}

/** Remove the given tokens from their `w:t`s, inside `element`. */
const removeTokens = (element: XmlElement, tokens: ReadonlyArray<Token>): XmlElement =>
  replaceElements(element, (node) => {
    const own = tokens.filter((t) => t.node === node).toSorted((a, b) => b.index - a.index)
    if (own.length === 0) return undefined
    const text = own.reduce(
      (acc, t) => acc.slice(0, t.index) + acc.slice(t.index + t.text.length),
      ownText(node)
    )
    return [withChildren(node, text === '' ? [] : [text])]
  })

interface RowHoist {
  readonly open?: Token
  readonly close?: Token
}

/** Whether a token opens the row (first tag, at the start of the first cell). */
const opensRow = (token: Token, cells: ReadonlyArray<XmlElement>): boolean =>
  token.kind === 'open' && startsItsCell(token, textsOf(cells[0]))

/** Whether a token closes the row (last tag, at the end of the last cell). */
const closesRow = (token: Token, cells: ReadonlyArray<XmlElement>): boolean =>
  token.kind === 'close' && endsItsCell(token, textsOf(cells.at(-1)))

/** Which of a row's first and last tags wrap the whole row, and so move out of it. */
const rowHoist = (tokens: ReadonlyArray<Token>, cells: ReadonlyArray<XmlElement>): RowHoist => {
  const first = tokens[0]
  const last = tokens.at(-1)
  if (first === undefined || last === undefined) return {}
  // -1: the first tag opens the row and is closed in a later row; -2: it does not open the row.
  const match = opensRow(first, cells) ? matchOfFirst(tokens) : -2
  const closesLast = closesRow(last, cells)
  // The pair moves out only together: an open closed mid-row stays where it is.
  const pairs = closesLast && match === tokens.length - 1
  const open = pairs || match === -1
  const close = closesLast && (pairs || lastClosesOutside(tokens))
  return { ...(open ? { open: first } : {}), ...(close ? { close: last } : {}) }
}

/** A row, with a loop or condition around it moved out beside it. */
const hoistRow = (row: XmlElement): ReadonlyArray<XmlChild> => {
  const cells = childElements(row).filter((c) => c.name === 'w:tc')
  const tokens = tokensOf(descendantsNamed(row, 'w:t', STOP_AT_TABLES)).filter(
    (t) => t.kind !== 'comment'
  )
  const { open, close } = rowHoist(tokens, cells)
  const hoisted = [open, close].filter((t): t is Token => t !== undefined)
  if (hoisted.length === 0) return [row]
  return [
    ...(open === undefined ? [] : [open.text]),
    removeTokens(row, hoisted),
    ...(close === undefined ? [] : [close.text]),
  ]
}

/** Content a paragraph must keep even when its text is only tags. */
const KEEPS_PARAGRAPH = ['w:drawing', 'w:pict', 'w:object']

/** A paragraph of block tags only becomes those tags; any other is kept. */
const hoistParagraph = (paragraph: XmlElement): ReadonlyArray<XmlChild> => {
  const texts = descendantsNamed(paragraph, 'w:t', new Set(['w:p']))
  const tokens = tokensOf(texts)
  if (tokens.length === 0 || tokens.some((t) => t.kind === 'inline')) return [paragraph]
  const rest = texts.map(ownText).join('').replace(TAG, '')
  if (rest.trim() !== '') return [paragraph]
  if (KEEPS_PARAGRAPH.some((name) => descendantsNamed(paragraph, name).length > 0)) {
    return [paragraph]
  }
  return [tokens.map((t) => t.text).join('')]
}

/** Move row loops and tag paragraphs out of the markup, in one Word part. */
export const hoistBlockTags = (root: XmlElement): XmlElement => {
  const rowsHoisted = rewriteRoot(root, (element) =>
    element.name === 'w:tbl'
      ? [
          withChildren(
            element,
            element.children.flatMap((child) =>
              isElement(child) && child.name === 'w:tr' ? hoistRow(child) : [child]
            )
          ),
        ]
      : [element]
  )
  return rewriteRoot(rowsHoisted, (element) =>
    element.name === 'w:p' ? hoistParagraph(element) : [element]
  )
}

// ---------------------------------------------------------------------------
// The serialized template
// ---------------------------------------------------------------------------

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

const SMART_QUOTES: Readonly<Record<string, string>> = {
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u2018': "'",
  '\u2019': "'",
}

/**
 * One tag of the serialized part, made a plain, ESCAPED Handlebars tag:
 *
 *  - the XML escaping `stringify` gave its text is undone, and the curly quotes
 *    Word's autocorrect types are made straight, so `(eq status “paid”)` works;
 *  - `{{{raw}}}` and `{{&raw}}` become `{{raw}}`: a value can never be written
 *    into the part as markup;
 *  - a partial, `{{> name}}`, is kept as written, so the render refuses it by
 *    name: partials are not part of the Word template language, and a tag that
 *    silently vanished would leave the author a document missing its letterhead.
 */
const neutraliseTag = (body: string): string => {
  const decoded = body
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[\u201C\u201D\u201E\u2018\u2019]/g, (quote) => SMART_QUOTES[quote] ?? quote)
  const lead = /^(~?\s*)([&>]?)/.exec(decoded)
  const prefix = lead?.[1] ?? ''
  const marker = lead?.[2] ?? ''
  const rest = decoded.slice(prefix.length + marker.length)
  return marker === '>' ? `{{${prefix}>${rest}}}` : `{{${prefix}${rest}}}`
}

const SERIALIZED_TAG = /\{\{\{?([^<]*?)\}?\}\}/g

/** Every tag of a serialized part, through {@link neutraliseTag}. */
export const neutraliseTags = (serialized: string): string =>
  serialized.replace(SERIALIZED_TAG, (_tag, body: string) => neutraliseTag(body))

// ---------------------------------------------------------------------------
// After rendering
// ---------------------------------------------------------------------------

/** Containers whose content is elements only — layout whitespace goes. */
const STRUCTURAL = new Set([
  'w:body',
  'w:tbl',
  'w:tr',
  'w:tc',
  'w:hdr',
  'w:ftr',
  'w:footnotes',
  'w:footnote',
  'w:endnotes',
  'w:endnote',
  'w:sdtContent',
  'w:txbxContent',
])

/**
 * Make a rendered part valid Word again where a loop or condition emptied it:
 * a cell must end with a paragraph, a table must keep a row, and the space a
 * removed tag paragraph left between elements is not content.
 */
export const repairRenderedPart = (root: XmlElement): XmlElement =>
  rewriteRoot(root, (element) => {
    const children = STRUCTURAL.has(element.name)
      ? element.children.filter((c) => typeof c !== 'string' || c.trim() !== '')
      : element.children
    if (element.name === 'w:tbl' && !children.some((c) => isElement(c) && c.name === 'w:tr')) {
      return []
    }
    if (element.name === 'w:tc' && !children.some((c) => isElement(c) && c.name === 'w:p')) {
      return [withChildren(element, [...children, { name: 'w:p', attributes: {}, children: [] }])]
    }
    return [children === element.children ? element : withChildren(element, children)]
  })
