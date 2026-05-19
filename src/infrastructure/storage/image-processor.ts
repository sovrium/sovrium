/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CropRegion } from '@/application/ports/services/image-transform-service'

const loadSharp = async () => (await import('sharp')).default

export const resizeImage = async (
  input: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> => {
  const sharp = await loadSharp()
  const result = await sharp(input).resize({ width, height, fit: 'cover' }).toBuffer()
  return new Uint8Array(result)
}

export const createThumbnail = async (input: Uint8Array, size: number): Promise<Uint8Array> => {
  const sharp = await loadSharp()
  const result = await sharp(input).resize(size, size, { fit: 'cover' }).toBuffer()
  return new Uint8Array(result)
}

export const convertImage = async (
  input: Uint8Array,
  format: 'jpeg' | 'png' | 'webp' | 'avif'
): Promise<Uint8Array> => {
  const sharp = await loadSharp()
  const result = await sharp(input).toFormat(format).toBuffer()
  return new Uint8Array(result)
}

export const cropImage = async (input: Uint8Array, region: CropRegion): Promise<Uint8Array> => {
  const sharp = await loadSharp()
  const { x, y, w, h } = region
  const result = await sharp(input).extract({ left: x, top: y, width: w, height: h }).toBuffer()
  return new Uint8Array(result)
}
