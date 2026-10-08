/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PAGE_ANCHORS } from './placement'

/**
 * WHERE A MARK IS DRAWN — the geometry `pdf/watermark` and `pdf/stamp` share.
 *
 * The config measures from the page's top-left corner, the way a layout tool
 * does; PDF draws from the bottom-left. This module turns one into the other.
 *
 * A mark is a box drawn from an origin: an image from its bottom-left corner,
 * a line of text from the start of its baseline (its box reaching `below`
 * points under the baseline, for the descenders). It is turned
 * counter-clockwise by `angle` about that origin. The box the turned mark
 * occupies is what an anchor or `at` places, so a turned mark stays on the
 * page as an upright one does.
 */

/** One of the nine anchors a mark can sit on. */
export type PageAnchor = (typeof PAGE_ANCHORS)[number]

/** Where the mark goes: on an anchor, `margin` points from the edges, or with its top-left at `at`. */
export type MarkPlacement =
  | { readonly anchor: PageAnchor; readonly margin: number }
  | { readonly at: { readonly x: number; readonly y: number } }

export interface MarkGeometry {
  /** The page, in points. */
  readonly page: { readonly width: number; readonly height: number }
  /** The mark's own box, upright, in points. */
  readonly box: { readonly width: number; readonly height: number }
  /** How far the box reaches under the origin (a text's descent; 0 for an image). */
  readonly below: number
  /** Degrees counter-clockwise. */
  readonly angle: number
  readonly placement: MarkPlacement
}

/** The origin to draw the mark from, in PDF space (points from the page's bottom-left). */
export interface MarkOrigin {
  readonly x: number
  readonly y: number
}

/** Where a box `size` long starts on a side `side` long, for an anchor's part on that axis. */
const startOnAxis = (part: string, side: number, size: number, margin: number): number => {
  if (part === 'center') return (side - size) / 2
  return part === 'start' ? margin : side - margin - size
}

/** One word of an anchor as a part of its axis. */
const axisPart = (word: string): string => {
  if (word === 'top' || word === 'left') return 'start'
  return word === 'center' ? 'center' : 'end'
}

/** The anchor's horizontal and vertical parts, as start / center / end. */
const anchorParts = (anchor: PageAnchor): { readonly x: string; readonly y: string } => {
  if (anchor === 'center') return { x: 'center', y: 'center' }
  const [vertical = 'center', horizontal = 'center'] = anchor.split('-')
  return { x: axisPart(horizontal), y: axisPart(vertical) }
}

/** The top-left corner, from the page's top-left, of the box the turned mark occupies. */
const boundsTopLeft = (
  geometry: MarkGeometry,
  bounds: { readonly width: number; readonly height: number }
): { readonly left: number; readonly top: number } => {
  const { placement, page } = geometry
  if ('at' in placement) return { left: placement.at.x, top: placement.at.y }
  const parts = anchorParts(placement.anchor)
  return {
    left: startOnAxis(parts.x, page.width, bounds.width, placement.margin),
    top: startOnAxis(parts.y, page.height, bounds.height, placement.margin),
  }
}

/** The origin a mark is drawn from so that it sits where its placement says. */
export const markOrigin = (geometry: MarkGeometry): MarkOrigin => {
  const radians = (geometry.angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const { width, height } = geometry.box
  const bounds = {
    width: Math.abs(width * cos) + Math.abs(height * sin),
    height: Math.abs(width * sin) + Math.abs(height * cos),
  }
  const { left, top } = boundsTopLeft(geometry, bounds)
  const centre = { x: left + bounds.width / 2, y: geometry.page.height - (top + bounds.height / 2) }
  // The box's centre, seen from the origin, before and after the turn.
  const local = { x: width / 2, y: height / 2 - geometry.below }
  return {
    x: centre.x - (local.x * cos - local.y * sin),
    y: centre.y - (local.x * sin + local.y * cos),
  }
}

/** `#rrggbb` as red, green and blue from 0 to 1. */
export const hexToRgb = (
  hex: string
): { readonly r: number; readonly g: number; readonly b: number } => {
  const channel = (offset: number): number => parseInt(hex.slice(offset, offset + 2), 16) / 255
  return { r: channel(1), g: channel(3), b: channel(5) }
}
