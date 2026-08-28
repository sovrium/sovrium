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
 * Output formats supported by the composed `transform` pipeline.
 *
 * AVIF was withdrawn: `Bun.Image`'s `bun` backend — the one that runs on Linux,
 * and therefore in the compiled binary and the deployment container — carries
 * no AV1 encoder, so an AVIF transform passed on macOS and failed everywhere
 * Sovrium actually runs. See `infrastructure/storage/bun-image.ts` for the
 * measurement.
 */
export type ImageOutputFormat = 'jpeg' | 'png' | 'webp'

/**
 * How a two-dimension resize reconciles the requested box with the source
 * aspect ratio. `fill` stretches to exactly the box; `inside` scales to fit
 * within it, preserving the ratio (so the output may be smaller than asked).
 *
 * The crop-or-pad modes (`cover`, `contain`, `outside`) are absent because the
 * pipeline exposes no crop primitive.
 */
export type ImageFit = 'fill' | 'inside'

/**
 * Composed-pipeline options consumed by {@link ImageTransformService.transform}.
 *
 * `operation` names the author's intent; the geometric stage actually runs
 * whenever `width` or `height` is supplied, and the encoding stage whenever an
 * output format is resolved. There is no `crop` operation and no `x` / `y`
 * offset — cropping was withdrawn rather than emulated.
 */
export interface ImageTransformOptions {
  readonly operation: 'resize' | 'convert'
  readonly width?: number
  readonly height?: number
  readonly fit?: ImageFit
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
 * - **Atoms** (`resize`, `convert`, `thumbnail`) — single-step operations that
 *   fail explicitly on processing errors.
 * - **Composed pipeline** (`transform`) — resize plus optional format
 *   conversion in a single pipeline run. Used by the automation
 *   `file.transformImage` action.
 *
 * ## Every operation can fail, including `transform`
 *
 * `transform` used to declare error channel `never` and degrade to a verbatim
 * passthrough, on the reasoning that "the automation contract is a file exists
 * at the destination, not the pixels were re-encoded". That reasoning is what
 * let a compiled binary in which NO transform worked ship unnoticed: the
 * passthrough answered `200` with a plausible `Content-Type` for every request,
 * so no assertion could tell a working pipeline from an absent one.
 *
 * A transform that cannot be performed is now an error the caller has to
 * handle. Callers may still choose to be lenient — but they choose it
 * explicitly, at a site where the decision is visible.
 *
 * Implementation lives in the infrastructure layer.
 */
export class ImageTransformService extends Context.Service<
  ImageTransformService,
  {
    readonly resize: (
      input: Uint8Array,
      width: number,
      height: number
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
    ) => Effect.Effect<ImageTransformResult, ImageTransformError>
  }
>()('ImageTransformService') {}
