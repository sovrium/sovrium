/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class ImageTransformError extends Data.TaggedError('ImageTransformError')<{
  readonly cause: unknown
}> {}

export interface CropRegion {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type ImageOutputFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export interface ImageTransformOptions {
  readonly operation: 'resize' | 'crop' | 'noop'
  readonly width?: number
  readonly height?: number
  readonly x?: number
  readonly y?: number
  readonly outputFormat?: ImageOutputFormat
  readonly quality?: number
}

export interface ImageTransformResult {
  readonly bytes: Uint8Array
  readonly contentType: string
}

export class ImageTransformService extends Context.Tag('ImageTransformService')<
  ImageTransformService,
  {
    readonly resize: (
      input: Uint8Array,
      width: number,
      height: number
    ) => Effect.Effect<Uint8Array, ImageTransformError>
    readonly crop: (
      input: Uint8Array,
      region: CropRegion
    ) => Effect.Effect<Uint8Array, ImageTransformError>
    readonly convert: (
      input: Uint8Array,
      format: string
    ) => Effect.Effect<Uint8Array, ImageTransformError>
    readonly thumbnail: (
      input: Uint8Array,
      size: number
    ) => Effect.Effect<Uint8Array, ImageTransformError>
    readonly transform: (
      input: Uint8Array,
      options: ImageTransformOptions
    ) => Effect.Effect<ImageTransformResult, never>
  }
>() {}
