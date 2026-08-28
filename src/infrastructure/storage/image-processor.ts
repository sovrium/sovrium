/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single-step image operations, expressed over the shared `Bun.Image` seam.
 *
 * These used to lazily `import('sharp')` because its native addon cannot load
 * from a compiled binary's virtual filesystem. `Bun.Image` is part of the
 * runtime, so there is no module to defer and nothing to fail at load time —
 * see `./bun-image.ts` for why that mattered.
 *
 * Every function here REJECTS on an undecodable input rather than returning it
 * unchanged. `cropImage` is gone: the pipeline has no crop primitive.
 */

import { runImagePipeline } from './bun-image'
import type { ImageOutputFormat } from './bun-image'

/** Resize to an exact width x height box, distorting if the ratio disagrees. */
export const resizeImage = async (
  input: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> => await runImagePipeline(input, { width, height, fit: 'fill' })

/**
 * Scale an image to fit within a `size` x `size` box.
 *
 * `fit: 'inside'` preserves the aspect ratio, so a non-square source yields a
 * non-square thumbnail. The previous `fit: 'cover'` cropped to an exact square;
 * that mode was withdrawn along with cropping.
 */
export const createThumbnail = async (input: Uint8Array, size: number): Promise<Uint8Array> =>
  await runImagePipeline(input, { width: size, height: size, fit: 'inside' })

/** Re-encode into another container, leaving the geometry untouched. */
export const convertImage = async (
  input: Uint8Array,
  format: ImageOutputFormat
): Promise<Uint8Array> => await runImagePipeline(input, { outputFormat: format })
