/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `data-sovrium-id` a page export stamps on every node it draws, whatever
 * draws the node's root element.
 *
 * ─── WHY THE STAMP IS PUT ON AFTER THE RENDER ──────────────────────────────
 *
 * A node's id rides on the props the renderer builds for it, and a renderer
 * that spreads those props onto its root element stamps itself. Most do not:
 * an island draws its own placeholder, a code block its own figure, a skeleton
 * its own box, and each new type is one more place to remember. So the
 * renderer brackets every exported node between two empty markers, and this
 * pass moves the id onto the first element the node drew between them — the
 * node's root, however it was drawn — then removes the markers. A node that
 * already stamped itself keeps its stamp, and a node that drew no element (or
 * drew text first) is left unstamped rather than stamped on a stranger. A
 * renderer that stamped an element of its own choosing keeps that choice.
 *
 * Markers are resolved innermost first, so a node whose first element is its
 * child's root never takes the child's element.
 */

/** The attribute of the marker opening an exported node's drawing. */
export const EXPORT_STAMP_OPEN_ATTRIBUTE = 'data-sovrium-stamp'

/** The attribute of the marker closing an exported node's drawing. */
export const EXPORT_STAMP_CLOSE_ATTRIBUTE = 'data-sovrium-stamp-end'

const STAMP_ATTRIBUTE = 'data-sovrium-id'

const CLOSE_MARKER = new RegExp(`<template ${EXPORT_STAMP_CLOSE_ATTRIBUTE}="([^"]*)"></template>`)

const ANY_MARKER = new RegExp(
  `<template (?:${EXPORT_STAMP_OPEN_ATTRIBUTE}|${EXPORT_STAMP_CLOSE_ATTRIBUTE})="[^"]*"></template>`,
  'g'
)

/**
 * A marker inside an attribute value: an island hands its children over as
 * markup in its props, escaped once per island it sits in, and those copies
 * are never drawn, so their markers are dropped rather than resolved.
 */
const ESCAPED_MARKER = new RegExp(
  `&(?:amp;)*lt;template (?:${EXPORT_STAMP_OPEN_ATTRIBUTE}|${EXPORT_STAMP_CLOSE_ATTRIBUTE})=[\\s\\S]*?&(?:amp;)*gt;&(?:amp;)*lt;/template&(?:amp;)*gt;`,
  'g'
)

const WHITESPACE = /\s/

const WORD_CHARACTER = /\w/

const TAG_NAME_CHARACTER = /[\w-]/

const ASCII_LETTER = /[A-Za-z]/

/**
 * Where a raw-text block opened at `start` ends: `<name …>` (the name followed
 * by a non-word character, as `\b` reads it) through the first `</name>`, or
 * `undefined` when `start` opens no such block or the block never closes.
 */
const blockEnd = (drawing: string, start: number, name: string): number | undefined => {
  const opener = `<${name}`
  if (!drawing.startsWith(opener, start)) return undefined
  const afterName = start + opener.length
  if (WORD_CHARACTER.test(drawing.charAt(afterName))) return undefined
  const openEnd = drawing.indexOf('>', afterName)
  if (openEnd === -1) return undefined
  const closer = `</${name}>`
  const close = drawing.indexOf(closer, openEnd + 1)
  return close === -1 ? undefined : close + closer.length
}

/** Where a comment opened at `start` ends, or `undefined` when there is none to end. */
const commentEnd = (drawing: string, start: number): number | undefined => {
  if (!drawing.startsWith('<!--', start)) return undefined
  const close = drawing.indexOf('-->', start + 4)
  return close === -1 ? undefined : close + 3
}

/** The index of the first non-whitespace character at or after `start`. */
const pastWhitespace = (drawing: string, start: number): number =>
  WHITESPACE.test(drawing.charAt(start)) ? pastWhitespace(drawing, start + 1) : start

/** Where a whitespace run starting at `start` ends, or `undefined` when none starts there. */
const whitespaceEnd = (drawing: string, start: number): number | undefined => {
  const end = pastWhitespace(drawing, start)
  return end === start ? undefined : end
}

/** How far a drawing's lead-in runs, and where the last block in it opened. */
interface LeadIn {
  readonly end: number
  readonly lastBlockStart: number | undefined
}

/**
 * Where the lead-in of a drawing ends: past whitespace, comments, and the
 * `<style>` and `<script>` blocks a node may draw ahead of its root. One
 * forward scan, each item read to its first close as HTML reads it, so the
 * cost is linear in the drawing whatever it holds. Every recursion here is a
 * tail call, which the runtime runs in constant stack.
 */
const leadInFrom = (drawing: string, start: number, lastBlockStart?: number): LeadIn => {
  const pastSpaceOrComment = whitespaceEnd(drawing, start) ?? commentEnd(drawing, start)
  if (pastSpaceOrComment !== undefined) {
    return leadInFrom(drawing, pastSpaceOrComment, lastBlockStart)
  }
  const pastBlock = blockEnd(drawing, start, 'style') ?? blockEnd(drawing, start, 'script')
  return pastBlock === undefined
    ? { end: start, lastBlockStart }
    : leadInFrom(drawing, pastBlock, start)
}

/** The index just past the run of tag-name characters starting at `start`. */
const tagNameRunEnd = (drawing: string, start: number): number =>
  TAG_NAME_CHARACTER.test(drawing.charAt(start)) ? tagNameRunEnd(drawing, start + 1) : start

/** A tag name with the trailing hyphens a word boundary cannot end on taken off. */
const trimmedTagNameEnd = (drawing: string, nameStart: number, end: number): number =>
  end > nameStart + 1 && drawing.charAt(end - 1) === '-'
    ? trimmedTagNameEnd(drawing, nameStart, end - 1)
    : end

interface LeadingElement {
  /** What the drawing holds ahead of the element. */
  readonly leading: string
  readonly tag: string
  /** The element's opening tag after its name, up to its `>`. */
  readonly attributes: string
  /** The index just past the opening tag's `>`. */
  readonly end: number
}

/**
 * The opening tag at `start`, if one is there: a letter-led name of word
 * characters and hyphens (never ending on a hyphen), read through its first `>`.
 */
const elementAt = (drawing: string, start: number): LeadingElement | undefined => {
  if (drawing.charAt(start) !== '<' || !ASCII_LETTER.test(drawing.charAt(start + 1))) {
    return undefined
  }
  const nameEnd = trimmedTagNameEnd(drawing, start + 1, tagNameRunEnd(drawing, start + 1))
  const close = drawing.indexOf('>', nameEnd)
  if (close === -1) return undefined
  return {
    leading: drawing.slice(0, start),
    tag: drawing.slice(start + 1, nameEnd),
    attributes: drawing.slice(nameEnd, close),
    end: close + 1,
  }
}

/**
 * The first element of a drawing, past whitespace, comments, and the `<style>`
 * and `<script>` blocks a node may draw ahead of its root. When nothing that
 * opens an element follows the lead-in, the drawing's root is the last block
 * of the lead-in itself — a node that drew only a `<style>` or a `<script>`.
 */
const leadingElementOf = (drawing: string): LeadingElement | undefined => {
  const { end, lastBlockStart } = leadInFrom(drawing, 0)
  return (
    elementAt(drawing, end) ??
    (lastBlockStart === undefined ? undefined : elementAt(drawing, lastBlockStart))
  )
}

const openMarkerOf = (id: string): string =>
  `<template ${EXPORT_STAMP_OPEN_ATTRIBUTE}="${id}"></template>`

/**
 * A node's drawing with its id on its root element, unless the drawing already
 * carries that id (a renderer that stamped an inner element keeps its choice)
 * or the root already carries another node's.
 */
const stampRoot = (drawing: string, id: string): string => {
  if (drawing.includes(` ${STAMP_ATTRIBUTE}="${id}"`)) return drawing
  const element = leadingElementOf(drawing)
  if (element === undefined) return drawing
  const { leading, tag, attributes, end } = element
  if (tag === 'template' || attributes.includes(` ${STAMP_ATTRIBUTE}="`)) return drawing
  return `${leading}<${tag} ${STAMP_ATTRIBUTE}="${id}"${attributes}>${drawing.slice(end)}`
}

/** Resolve the first closing marker, innermost first, until none is left. */
const resolveMarkers = (html: string): string => {
  const close = CLOSE_MARKER.exec(html)
  if (close === null) return html.replaceAll(ANY_MARKER, '')
  const [closeMarker, id = ''] = close
  const open = openMarkerOf(id)
  const openIndex = html.lastIndexOf(open, close.index)
  const afterClose = html.slice(close.index + closeMarker.length)
  if (openIndex === -1) return resolveMarkers(`${html.slice(0, close.index)}${afterClose}`)
  const drawing = html.slice(openIndex + open.length, close.index)
  return resolveMarkers(`${html.slice(0, openIndex)}${stampRoot(drawing, id)}${afterClose}`)
}

/**
 * Move every bracketed node's id onto its root element and drop the markers.
 *
 * @param html - a drawing the renderer bracketed, as markup; the id inside a
 *   marker is copied as the renderer escaped it.
 * @returns the same markup with no marker left, each node stamped once.
 */
export const resolveExportStamps = (html: string): string =>
  resolveMarkers(html.replaceAll(ESCAPED_MARKER, ''))

const ANY_STAMP = new RegExp(` ${STAMP_ATTRIBUTE}="[^"]*"`, 'g')

/**
 * A copy of a drawing that must not count as the node: its markers and stamps
 * removed, so a node a renderer draws twice (a marquee's seam clone) is tied
 * back once.
 *
 * @param html - a fragment of a drawing, raw markup.
 * @returns the fragment with no marker and no `data-sovrium-id`.
 */
export const withoutExportStamps = (html: string): string =>
  html.replaceAll(ANY_MARKER, '').replaceAll(ANY_STAMP, '')
