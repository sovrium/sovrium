/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Layer } from 'effect'
import {
  ImageTransformService,
  ImageTransformError,
  type CropRegion,
  type ImageOutputFormat,
  type ImageTransformOptions,
  type ImageTransformResult,
} from '@/application/ports/services/image-transform-service'
import { parseEcoImageFormat } from '@/domain/models/env/eco-image-format'
import { resizeImage, createThumbnail, convertImage, cropImage } from './image-processor'

class SharpProcessingError extends Data.TaggedError('SharpProcessingError')<{
  readonly cause: unknown
}> {}

const MIME_BY_FORMAT: Readonly<Record<ImageOutputFormat, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

const resizeArgs = (
  options: ImageTransformOptions
): Readonly<{ width: number; height: number; fit: 'cover' }> | undefined =>
  options.operation === 'resize' && options.width !== undefined && options.height !== undefined
    ? { width: options.width, height: options.height, fit: 'cover' }
    : undefined

const cropArgs = (
  options: ImageTransformOptions
): Readonly<{ left: number; top: number; width: number; height: number }> | undefined => {
  if (options.operation !== 'crop') return undefined
  const { x, y, width, height } = options
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined
  }
  return { left: x, top: y, width, height }
}

const runSharpPipeline = async (
  input: Uint8Array,
  options: ImageTransformOptions
): Promise<Uint8Array> => {
  const sharpModule = (await import('sharp')).default
  const pipeline = sharpModule(Buffer.from(input))

  const resize = resizeArgs(options)
  const resized = resize ? pipeline.resize(resize) : pipeline

  const crop = cropArgs(options)
  const cropped = crop ? resized.extract(crop) : resized

  const formatted = options.outputFormat
    ? cropped.toFormat(
        options.outputFormat,
        options.quality !== undefined ? { quality: options.quality } : undefined
      )
    : cropped

  const buffer = await formatted.toBuffer()
  return new Uint8Array(buffer)
}

export const ImageTransformServiceLive = Layer.succeed(
  ImageTransformService,
  ImageTransformService.of({
    resize: (input: Uint8Array, width: number, height: number) =>
      Effect.tryPromise({
        try: () => resizeImage(input, width, height),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),

    crop: (input: Uint8Array, region: CropRegion) =>
      Effect.tryPromise({
        try: () => cropImage(input, region),
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

    transform: (input: Uint8Array, options: ImageTransformOptions) => {
      const ecoFormat = parseEcoImageFormat(process.env)
      const resolvedFormat: ImageOutputFormat = options.outputFormat ?? ecoFormat
      const effectiveOptions: ImageTransformOptions = {
        ...options,
        outputFormat: resolvedFormat,
      }
      const contentType = MIME_BY_FORMAT[resolvedFormat]
      return Effect.tryPromise({
        try: () => runSharpPipeline(input, effectiveOptions),
        catch: (cause) => new SharpProcessingError({ cause }),
      }).pipe(
        Effect.map((bytes): ImageTransformResult => ({ bytes, contentType })),
        Effect.catchAll(() => Effect.succeed({ bytes: input, contentType }))
      )
    },
  })
)
