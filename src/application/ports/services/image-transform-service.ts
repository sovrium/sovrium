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
 * Crop region for {@link ImageTransformService.crop}
 */
export interface CropRegion {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Output formats supported by the composed `transform` pipeline. */
export type ImageOutputFormat = 'jpeg' | 'png' | 'webp' | 'avif'

/**
 * Composed-pipeline options consumed by {@link ImageTransformService.transform}.
 *
 * `operation` selects the geometric transform; `outputFormat` + `quality`
 * select the encoding stage. `noop` skips the geometric stage and only
 * re-encodes if `outputFormat` is provided.
 */
export interface ImageTransformOptions {
  readonly operation: 'resize' | 'crop' | 'noop'
  readonly width?: number
  readonly height?: number
  readonly x?: number
  readonly y?: number
  readonly outputFormat?: ImageOutputFormat
  readonly quality?: number
}

/** Output of a composed {@link ImageTransformService.transform} call. */
export interface ImageTransformResult {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/**
 * Image Transform Service Port
 *
 * Provides image manipulation operations. Two API levels are exposed:
 *
 * - **Atoms** (`resize`, `crop`, `convert`, `thumbnail`) — single-step
 *   operations that fail explicitly on processing errors. Used by URL
 *   transform presets and the storage layer's on-the-fly transforms.
 * - **Composed pipeline** (`transform`) — single-pass resize/crop + optional
 *   format conversion in one sharp invocation. Used by the automation
 *   `file.transformImage` action where a single image may need multiple
 *   stages without intermediate buffers. Degrades to a passthrough when
 *   sharp cannot process the input (error channel `never`).
 *
 * Implementation lives in the infrastructure layer.
 */
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
