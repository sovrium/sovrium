/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/** The SVG could not be rasterized: not parseable, or the engine failed. */
export class SvgRasterizeError extends Data.TaggedError('SvgRasterizeError')<{
  readonly message: string
}> {}

/** A rasterized SVG: PNG bytes and their size in pixels. */
export interface RasterizedSvg {
  readonly png: Uint8Array
  readonly width: number
  readonly height: number
}

/** How to rasterize: a target width OR height (proportions kept), and the fonts text may use. */
export interface SvgRasterizeOptions {
  readonly width?: number
  readonly height?: number
  /** Font files (TTF / OTF) text in the SVG is drawn with. */
  readonly fonts?: ReadonlyArray<Uint8Array>
}

/**
 * SVG → PNG inside the binary, with no browser: the engine behind an SVG
 * `document/generateImage`. It never fetches anything — an `<image>` pointing
 * at the network is not loaded.
 */
export class SvgRasterizer extends Context.Service<
  SvgRasterizer,
  {
    readonly rasterize: (
      svg: string,
      options: SvgRasterizeOptions
    ) => Effect.Effect<RasterizedSvg, SvgRasterizeError>
  }
>()('SvgRasterizer') {}
