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
} from '@/application/ports/services/image-transform-service'
import { resizeImage, createThumbnail, convertImage, cropImage } from './image-processor'

export const ImageTransformServiceLive = Layer.succeed(
  ImageTransformService,
  ImageTransformService.of({
    resize: (input: Uint8Array, width: number, height: number) =>
      Effect.tryPromise({
        try: () => resizeImage(input, width, height),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),

    // eslint-disable-next-line max-params -- crop region requires x, y, w, h + input
    crop: (input: Uint8Array, x: number, y: number, w: number, h: number) =>
      Effect.tryPromise({
        try: () => cropImage(input, x, y, w, h),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),

    convert: (input: Uint8Array, format: string) =>
      Effect.tryPromise({
        try: () => convertImage(input, format as 'jpeg' | 'png' | 'webp' | 'avif'),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),

    thumbnail: (input: Uint8Array, size: number) =>
      Effect.tryPromise({
        try: () => createThumbnail(input, size),
        catch: (error: unknown) => new ImageTransformError({ cause: error }),
      }),
  })
)
