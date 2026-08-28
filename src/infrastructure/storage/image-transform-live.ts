/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  ImageTransformService,
  ImageTransformError,
  type ImageOutputFormat,
  type ImageTransformOptions,
  type ImageTransformResult,
} from '@/application/ports/services/image-transform-service'
import { MIME_BY_IMAGE_FORMAT, readSourceImageMetadata, runImagePipeline } from './bun-image'
import { resizeImage, createThumbnail, convertImage } from './image-processor'

/**
 * Output codec used when a `file.transformImage` CONVERSION names no format.
 *
 * This was AVIF, resolved through a preference list because AVIF is not
 * universally encodable. The list is gone with the format: `Bun.Image`'s `bun`
 * backend — the default on Linux, and therefore in the distributed binary and
 * in the deployment container — ships no AV1 encoder and answers AVIF with
 * `ERR_IMAGE_FORMAT_UNSUPPORTED`. A default that works on macOS and fails in
 * production is not a default.
 *
 * WebP replaces it, and it is a constant rather than a list because it is the
 * only thing left to choose:
 *
 * - it encodes on BOTH backends, so it never varies by host;
 * - it is lossy by default and roughly 25-30% smaller than JPEG at equivalent
 *   visual quality, so the frugality the AVIF default was chosen for survives;
 * - unlike AVIF it is supported by every browser shipped since 2020, so it is
 *   a win-win in the ecoconception sense — smaller AND faster — with no
 *   compatibility trade;
 * - unlike JPEG it keeps the alpha channel, so a transparent PNG source is not
 *   silently flattened onto black.
 *
 * PNG stays available as an EXPLICIT choice for callers who need lossless
 * output; it is the wrong default because it is the largest.
 */
const DEFAULT_OUTPUT_FORMAT: ImageOutputFormat = 'webp'

/**
 * The format the pipeline should encode to, or `undefined` for "keep the
 * source format".
 *
 * A default only applies to `operation: 'convert'`, because that is the only
 * operation that ASKED for a different container. A `resize` naming no format
 * used to be transcoded to the default anyway — to AVIF before this change,
 * and to WebP after it — which meant an action declaring
 * `destination: 'thumbnail.png'` wrote WebP bytes to a `.png` key, then
 * labelled them `image/png` from the extension. Nothing caught it because the
 * only assertion on the written file was that it had a non-zero length.
 *
 * Preserving the source format for a pure resize is also the narrower promise:
 * an author who wants a different container has one word to type, and one who
 * does not gets their own format back.
 */
const resolveOutputFormat = (options: ImageTransformOptions): ImageOutputFormat | undefined =>
  options.outputFormat ?? (options.operation === 'convert' ? DEFAULT_OUTPUT_FORMAT : undefined)

/**
 * MIME type for a pipeline run that preserved the source format.
 *
 * `Bun.Image#metadata()` names the source container; when it is one this
 * platform also encodes, its canonical MIME type is used. Anything else — a
 * format decodable but not encodable here — is reported as a generic binary
 * rather than guessed at, so a caller deriving a filename from it is not
 * quietly handed the wrong suffix.
 */
const preservedContentType = async (input: Uint8Array): Promise<string> => {
  const { format } = await readSourceImageMetadata(input)
  return MIME_BY_IMAGE_FORMAT[format as ImageOutputFormat] ?? 'application/octet-stream'
}

export const ImageTransformServiceLive = Layer.succeed(
  ImageTransformService,
  ImageTransformService.of({
    resize: (input: Uint8Array, width: number, height: number) =>
      Effect.tryPromise({
        try: () => resizeImage(input, width, height),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),

    convert: (input: Uint8Array, format: string) =>
      Effect.tryPromise({
        try: () => convertImage(input, format as ImageOutputFormat),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),

    thumbnail: (input: Uint8Array, size: number) =>
      Effect.tryPromise({
        try: () => createThumbnail(input, size),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),

    /**
     * Composed pipeline for the automation `file.transformImage` action.
     *
     * Fails when the input cannot be decoded or the requested encoder is
     * unavailable. It used to swallow both and return the input bytes verbatim,
     * which is how a binary that performed no transforms at all shipped
     * unnoticed — the caller could not distinguish a re-encoded image from the
     * original one.
     *
     * `contentType` describes the bytes actually produced, whether that came
     * from an explicit format, the conversion default, or the source.
     */
    transform: (input: Uint8Array, options: ImageTransformOptions) => {
      const resolvedFormat = resolveOutputFormat(options)
      return Effect.tryPromise({
        try: async (): Promise<ImageTransformResult> => {
          const bytes = await runImagePipeline(input, {
            ...options,
            ...(resolvedFormat !== undefined && { outputFormat: resolvedFormat }),
          })
          const contentType =
            resolvedFormat === undefined
              ? await preservedContentType(input)
              : MIME_BY_IMAGE_FORMAT[resolvedFormat]
          return { bytes, contentType }
        },
        catch: (cause) => new ImageTransformError({ cause }),
      })
    },
  })
)
