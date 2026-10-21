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

/**
 * The first element of a drawing, past whitespace, comments, and the `<style>`
 * and `<script>` blocks a node may draw ahead of its root.
 */
const LEADING_ELEMENT =
  /^((?:\s+|<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>)*)<([A-Za-z][\w-]*)\b([^>]*)>/

const openMarkerOf = (id: string): string =>
  `<template ${EXPORT_STAMP_OPEN_ATTRIBUTE}="${id}"></template>`

/**
 * A node's drawing with its id on its root element, unless the drawing already
 * carries that id (a renderer that stamped an inner element keeps its choice)
 * or the root already carries another node's.
 */
const stampRoot = (drawing: string, id: string): string => {
  if (drawing.includes(` ${STAMP_ATTRIBUTE}="${id}"`)) return drawing
  const match = LEADING_ELEMENT.exec(drawing)
  if (match === null) return drawing
  const [whole, leading = '', tag = '', attributes = ''] = match
  if (tag === 'template' || attributes.includes(` ${STAMP_ATTRIBUTE}="`)) return drawing
  return `${leading}<${tag} ${STAMP_ATTRIBUTE}="${id}"${attributes}>${drawing.slice(whole.length)}`
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
