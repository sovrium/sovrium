/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DEFAULT_QUALITY } from '@/domain/services/image-transform-params'
import type { TransformFormat, TransformParams } from '@/domain/services/image-transform-params'
import type SharpNamespace from 'sharp'

type Sharp = typeof SharpNamespace

const loadSharp = async (): Promise<Sharp> => {
  const mod = await import('sharp')
  return mod.default
}

type OutputFormat = 'webp' | 'avif' | 'jpeg' | 'png'

const FORMAT_MIME: Readonly<Record<OutputFormat, string>> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export interface ImageTransformResult {
  readonly bytes: Uint8Array
  readonly format?: OutputFormat
}

const toThird = (pct: number, low: string, mid: string, high: string): string =>
  pct < 33.34 ? low : pct > 66.66 ? high : mid

const focalToGravity = (x: number, y: number): string => {
  const horizontal = toThird(x, 'left', 'center', 'right')
  const vertical = toThird(y, 'top', 'center', 'bottom')
  if (vertical === 'center' && horizontal === 'center') return 'center'
  if (vertical === 'center') return horizontal
  if (horizontal === 'center') return vertical
  return `${vertical} ${horizontal}`
}

const cropToSharpPosition = (config: RunPipelineConfig): string | number => {
  const { crop } = config.params
  switch (crop.kind) {
    case 'entropy':
      return config.sharp.strategy.entropy
    case 'attention':
      return config.sharp.strategy.attention
    case 'focal':
      return focalToGravity(crop.x, crop.y)
    case 'center':
    default:
      return 'center'
  }
}

const resolveOutputFormat = (
  format: TransformFormat | undefined,
  acceptHeader: string | undefined
): OutputFormat | undefined => {
  if (format === 'origin') return undefined
  if (format !== undefined) return format
  const accept = (acceptHeader ?? '').toLowerCase()
  if (accept.includes('image/avif')) return 'avif'
  if (accept.includes('image/webp')) return 'webp'
  return undefined
}

const resizeOptions = (config: RunPipelineConfig): Readonly<SharpNamespace.ResizeOptions> => {
  const { params } = config
  const position = params.fit === 'cover' ? cropToSharpPosition(config) : undefined
  return {
    ...(params.width !== undefined && { width: params.width }),
    ...(params.height !== undefined && { height: params.height }),
    fit: params.fit,
    ...(position !== undefined && { position }),
  }
}

export const mimeForFormat = (format: OutputFormat): string => FORMAT_MIME[format]

export const resolveTransformOutputFormat = (
  params: TransformParams,
  acceptHeader?: string
): string => resolveOutputFormat(params.format, acceptHeader) ?? 'origin'

const resolveQuality = (params: TransformParams): number => params.quality ?? DEFAULT_QUALITY

type RunPipelineConfig = Readonly<{
  sharp: Sharp
  input: Uint8Array
  params: TransformParams
  outputFormat: OutputFormat | undefined
  needsResize: boolean
}>

const runPipeline = async (config: RunPipelineConfig): Promise<Buffer> => {
  const { sharp, input, params, outputFormat, needsResize } = config
  const resized = needsResize ? sharp(input).resize(resizeOptions(config)) : sharp(input)
  const quality = resolveQuality(params)
  switch (outputFormat) {
    case 'webp':
      return resized.webp({ quality }).toBuffer()
    case 'avif':
      return resized.avif({ quality }).toBuffer()
    case 'jpeg':
      return resized.jpeg({ quality }).toBuffer()
    case 'png':
      return resized.png().toBuffer()
    default:
      return resized.toBuffer()
  }
}

export const applyImageTransform = async (
  input: Uint8Array,
  params: TransformParams,
  acceptHeader?: string
): Promise<ImageTransformResult> => {
  const outputFormat = resolveOutputFormat(params.format, acceptHeader)
  const needsResize = params.width !== undefined || params.height !== undefined

  if (!needsResize && outputFormat === undefined) {
    return { bytes: input }
  }

  try {
    const sharp = await loadSharp()
    const result = await runPipeline({ sharp, input, params, outputFormat, needsResize })
    return {
      bytes: new Uint8Array(result),
      ...(outputFormat !== undefined && { format: outputFormat }),
    }
  } catch {
    return { bytes: input }
  }
}
