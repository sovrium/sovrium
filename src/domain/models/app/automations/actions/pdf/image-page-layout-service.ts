/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FROM_IMAGES_PAGE_SIZES } from './from-images'

/**
 * HOW A PICTURE IS LAID ON ITS PAGE in `pdf/fromImages`: the page's size and
 * orientation, and the rectangle the picture is drawn in, in PDF space
 * (points from the page's bottom-left corner).
 */

export type ImagePageSize = (typeof FROM_IMAGES_PAGE_SIZES)[number]

/** The named paper sizes, portrait, in points. */
export const PAPER_SIZES: Readonly<
  Record<Exclude<ImagePageSize, 'image'>, { readonly width: number; readonly height: number }>
> = {
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
}

export interface ImageLayoutRequest {
  /** The picture's size, in pixels. */
  readonly picture: { readonly width: number; readonly height: number }
  readonly pageSize: ImagePageSize
  readonly orientation: 'auto' | 'portrait' | 'landscape'
  readonly fit: 'contain' | 'cover' | 'stretch'
  readonly margin: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ImageLayout {
  readonly page: { readonly width: number; readonly height: number }
  /** Where the picture is drawn; with `cover` it may run past `clip`. */
  readonly picture: Rect
  /** The area inside the margin, which a `cover` picture is cut to. */
  readonly clip: Rect
}

/** The page: the picture's own size (and the margin), or a paper size turned as asked. */
const pageOf = (
  request: ImageLayoutRequest
): { readonly width: number; readonly height: number } => {
  const { picture, margin } = request
  if (request.pageSize === 'image') {
    return { width: picture.width + 2 * margin, height: picture.height + 2 * margin }
  }
  const paper = PAPER_SIZES[request.pageSize]
  const landscape =
    request.orientation === 'landscape' ||
    (request.orientation === 'auto' && picture.width > picture.height)
  const long = Math.max(paper.width, paper.height)
  const short = Math.min(paper.width, paper.height)
  return landscape ? { width: long, height: short } : { width: short, height: long }
}

/** The picture's rectangle inside the area, as `fit` says. */
const fitInto = (area: Rect, request: ImageLayoutRequest): Rect => {
  if (request.fit === 'stretch') return area
  const { width, height } = request.picture
  const scales = [area.width / width, area.height / height]
  const scale = request.fit === 'cover' ? Math.max(...scales) : Math.min(...scales)
  const drawn = { width: width * scale, height: height * scale }
  return {
    x: area.x + (area.width - drawn.width) / 2,
    y: area.y + (area.height - drawn.height) / 2,
    ...drawn,
  }
}

/** Lay one picture on its page. */
export const layImageOnPage = (request: ImageLayoutRequest): ImageLayout => {
  const page = pageOf(request)
  const { margin } = request
  const clip = {
    x: margin,
    y: margin,
    width: Math.max(page.width - 2 * margin, 1),
    height: Math.max(page.height - 2 * margin, 1),
  }
  return { page, picture: fitInto(clip, request), clip }
}
