/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SvgRasterizeOptions } from '@/application/ports/services/svg-rasterizer'

/**
 * HOW BIG AN SVG WILL BE ONCE RASTERISED — read from its root element before
 * anything is drawn, so a size past the image limits is refused before resvg
 * allocates the pixels (an SVG declaring `width="100000"` would otherwise ask
 * for gigabytes on the main thread).
 *
 * The size follows resvg's reading: the root's `width` and `height` in any
 * absolute unit, a missing or percentage one taken from the `viewBox` side.
 * The requested `width` or `height` then scales it, proportions kept, as the
 * rasterizer's `fitTo` does.
 */

export interface PixelSize {
  readonly width: number
  readonly height: number
}

/** CSS pixels per unit, as resvg converts them (`em` at its 12-pixel default font size). */
const PX_PER_UNIT: Readonly<Record<string, number>> = {
  '': 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  em: 12,
  ex: 6,
}

const LENGTH = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i

type Length = { readonly px: number } | { readonly percent: number } | undefined

const lengthOf = (value: string | undefined): Length => {
  const match = value === undefined ? null : LENGTH.exec(value)
  if (match === null) return undefined
  const amount = Number(match[1])
  const unit = (match[2] ?? '').toLowerCase()
  if (!Number.isFinite(amount) || amount < 0) return undefined
  if (unit === '%') return { percent: amount }
  const scale = PX_PER_UNIT[unit]
  return scale === undefined ? undefined : { px: amount * scale }
}

/** The root `<svg>` start tag's attributes, quoted values read whole. */
const ROOT = /<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/i

const attributeOf = (attributes: string, name: string): string | undefined => {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attributes)
  return match === null ? undefined : (match[2] ?? match[3])
}

const viewBoxOf = (attributes: string): PixelSize | undefined => {
  const parts = (attributeOf(attributes, 'viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const [, , width, height] = parts
  return parts.length === 4 &&
    width !== undefined &&
    height !== undefined &&
    width > 0 &&
    height > 0 &&
    Number.isFinite(width) &&
    Number.isFinite(height)
    ? { width, height }
    : undefined
}

/** One side: absolute as written, a percentage of the viewBox side, else unknown. */
const side = (length: Length, viewBoxSide: number | undefined): number | undefined => {
  if (length !== undefined && 'px' in length) return length.px
  if (viewBoxSide === undefined) return undefined
  return length === undefined ? viewBoxSide : (viewBoxSide * length.percent) / 100
}

/**
 * The SVG's own size, as resvg resolves it: a missing or percentage side is
 * that share of the `viewBox` side. With no `viewBox` either, resvg measures
 * the drawing itself, which only it can do — 100 is taken here, and the
 * rasterizer checks resvg's own reading again before it draws. `undefined`
 * when the text holds no `<svg>` root.
 */
export const intrinsicSvgSize = (svg: string): PixelSize | undefined => {
  const root = ROOT.exec(svg.replace(/<!--[\s\S]*?-->/g, ''))
  if (root === null) return undefined
  const attributes = root[1] ?? ''
  const viewBox = viewBoxOf(attributes)
  return {
    width: side(lengthOf(attributeOf(attributes, 'width')), viewBox?.width) ?? 100,
    height: side(lengthOf(attributeOf(attributes, 'height')), viewBox?.height) ?? 100,
  }
}

/** The size a rasterisation of `natural` produces under the requested width or height. */
export const fittedSvgSize = (natural: PixelSize, options: SvgRasterizeOptions): PixelSize => {
  if (options.width !== undefined) {
    return {
      width: options.width,
      height: natural.width > 0 ? (options.width * natural.height) / natural.width : 0,
    }
  }
  if (options.height !== undefined) {
    return {
      width: natural.height > 0 ? (options.height * natural.width) / natural.height : 0,
      height: options.height,
    }
  }
  return natural
}
