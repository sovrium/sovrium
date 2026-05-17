/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Error for image transformation operations
 */
export class ImageTransformError extends Data.TaggedError('ImageTransformError')<{
  readonly cause: unknown
}> {}

/**
 * Image Transform Service Port
 *
 * Provides image manipulation operations (resize, crop, convert, thumbnail).
 * Implementation lives in infrastructure layer.
 */
export class ImageTransformService extends Context.Tag('ImageTransformService')<
  ImageTransformService,
  {
    readonly resize: (
      input: Uint8Array,
      width: number,
      height: number
    ) => Effect.Effect<Uint8Array, ImageTransformError>
    // eslint-disable-next-line max-params -- crop region requires x, y, w, h + input
    readonly crop: (
      input: Uint8Array,
      x: number,
      y: number,
      w: number,
      h: number
    ) => Effect.Effect<Uint8Array, ImageTransformError>
    readonly convert: (
      input: Uint8Array,
      format: string
    ) => Effect.Effect<Uint8Array, ImageTransformError>
    readonly thumbnail: (
      input: Uint8Array,
      size: number
    ) => Effect.Effect<Uint8Array, ImageTransformError>
  }
>() {}
