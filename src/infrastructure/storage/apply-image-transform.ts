/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DEFAULT_QUALITY } from '@/domain/services/image-transform/image-transform-params'
import { MIME_BY_IMAGE_FORMAT, runImagePipeline, type ImageOutputFormat } from './bun-image'
import type {
  TransformFormat,
  TransformParams,
} from '@/domain/services/image-transform/image-transform-params'

/**
 * On-the-fly image transforms for the bucket download route, over `Bun.Image`.
 *
 * ## What changed, and why it is the whole point
 *
 * This module used to lazily `import('sharp')` and, on ANY failure, return the
 * original bytes with an `undefined` format — described at the time as
 * "graceful by design". In the compiled binary that import ALWAYS failed
 * (a native `.node` addon cannot be read out of `$bunfs`), so the graceful path
 * was the only path: every transform request answered `200` with the stored
 * image, and no assertion on the response envelope could tell the difference.
 *
 * `Bun.Image` removes the reason the fallback existed, and the fallback itself
 * is gone: a transform that cannot be performed is now REPORTED.
 */

/** Concrete output formats the pipeline transcodes to (excludes `origin`). */
type OutputFormat = ImageOutputFormat

/**
 * Result of an image transform.
 *
 * `format` is the format actually produced; `undefined` means the source format
 * was preserved, in which case the caller derives the Content-Type from the
 * stored filename instead.
 */
export interface ImageTransformSuccess {
  readonly ok: true
  readonly bytes: Uint8Array
  readonly format?: OutputFormat
}

/**
 * Why a transform could not be produced.
 *
 * - `undecodable` — the stored bytes are not an image this pipeline can read
 * - `unsupported-format` — the runtime rejected the requested encoder
 *   (`ERR_IMAGE_FORMAT_UNSUPPORTED`)
 * - `failed` — anything else
 *
 * `unsupported-format` survives the AVIF withdrawal deliberately. Every format
 * still on the surface is statically linked in both `Bun.Image` backends, so
 * nothing here PREDICTS an unavailable encoder any more — but the runtime can
 * still raise that code, and mapping it to a 400 an operator can read beats
 * letting it fall through to a 500.
 */
export type ImageTransformFailureReason = 'undecodable' | 'unsupported-format' | 'failed'

/** A transform that could not be produced, for the route to turn into HTTP. */
export interface ImageTransformFailure {
  readonly ok: false
  readonly reason: ImageTransformFailureReason
  readonly message: string
}

/** Outcome of {@link applyImageTransform}. */
export type ImageTransformOutcome = ImageTransformSuccess | ImageTransformFailure

/** Canonical MIME type for a resolved output format. */
export const mimeForFormat = (format: OutputFormat): string => MIME_BY_IMAGE_FORMAT[format]

/**
 * Modern formats offered by `Accept`-header negotiation, best first.
 *
 * AVIF used to head this list, filtered through a runtime encodability check so
 * a machine without an AV1 encoder fell through to WebP. Both are gone with the
 * format itself: WebP is encodable on every `Bun.Image` backend, so the filter
 * could no longer return false for any candidate — a branch no test and no
 * production request could ever take.
 *
 * The list stays a list rather than collapsing to a constant because
 * negotiation is genuinely ordered: a second modern format re-enters here, and
 * only after its encoder is MEASURED on Linux, not inferred from a laptop.
 */
const NEGOTIATED_FORMATS: readonly OutputFormat[] = ['webp']

/**
 * Resolve the output format to transcode to.
 *
 * - explicit `format` (other than `origin`) — that format
 * - `format=origin` — `undefined` (no transcode, preserve original)
 * - `format` absent — the best `Accept`-advertised format this machine can
 *   encode, or `undefined` when the header offers no modern format
 */
const resolveOutputFormat = (
  format: TransformFormat | undefined,
  acceptHeader: string | undefined
): OutputFormat | undefined => {
  if (format === 'origin') return undefined
  if (format !== undefined) return format
  const accept = (acceptHeader ?? '').toLowerCase()
  return NEGOTIATED_FORMATS.find((candidate) => accept.includes(`image/${candidate}`))
}

/**
 * Resolve the output format string for a transform request, exposed so the
 * download route can derive a stable transform-cache key / ETag that matches
 * the bytes {@link applyImageTransform} will produce.
 *
 * Returns `'origin'` when no transcode occurs (the stored format is preserved
 * — either an explicit `format=origin` or an `Accept` header offering no
 * modern format).
 */
export const resolveTransformOutputFormat = (
  params: TransformParams,
  acceptHeader?: string
): string => resolveOutputFormat(params.format, acceptHeader) ?? 'origin'

/**
 * Resolve the compression quality applied to lossy output formats.
 *
 * Returns the explicit `quality` parameter when supplied, otherwise the
 * platform default ({@link DEFAULT_QUALITY}). The value is only consulted for
 * lossy formats (JPEG / WebP) — PNG output is lossless and ignores it.
 */
const resolveQuality = (params: TransformParams): number => params.quality ?? DEFAULT_QUALITY

/** `Bun.Image` sets a stable `error.code`; branch on it rather than the message. */
const failureReasonFor = (error: unknown): ImageTransformFailureReason => {
  const code = (error as { readonly code?: unknown } | null)?.code
  if (code === 'ERR_IMAGE_DECODE_FAILED' || code === 'ERR_IMAGE_UNKNOWN_FORMAT') {
    return 'undecodable'
  }
  if (code === 'ERR_IMAGE_FORMAT_UNSUPPORTED') return 'unsupported-format'
  return 'failed'
}

/**
 * Apply on-the-fly image transforms (resize + format conversion) to image bytes.
 *
 * Returns a failure outcome instead of the original bytes when the input cannot
 * be decoded or the requested encoder is unavailable. The route turns that into
 * an HTTP error the operator can see, rather than a `200` carrying an image
 * that was never transformed.
 *
 * @param acceptHeader - the request `Accept` header, used for format
 *   negotiation when no explicit `format` parameter is supplied.
 */
export const applyImageTransform = async (
  input: Uint8Array,
  params: TransformParams,
  acceptHeader?: string
): Promise<ImageTransformOutcome> => {
  const outputFormat = resolveOutputFormat(params.format, acceptHeader)
  const needsResize = params.width !== undefined || params.height !== undefined

  // Nothing to do — no resize and no transcode; serve original bytes.
  if (!needsResize && outputFormat === undefined) {
    return { ok: true, bytes: input }
  }

  try {
    const bytes = await runImagePipeline(input, {
      ...(params.width !== undefined && { width: params.width }),
      ...(params.height !== undefined && { height: params.height }),
      fit: params.fit,
      ...(outputFormat !== undefined && { outputFormat }),
      quality: resolveQuality(params),
    })
    return { ok: true, bytes, ...(outputFormat !== undefined && { format: outputFormat }) }
  } catch (error) {
    return {
      ok: false,
      reason: failureReasonFor(error),
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
