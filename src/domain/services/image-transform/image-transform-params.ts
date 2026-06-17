/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type TransformFit = 'cover' | 'contain' | 'fill'

export type TransformFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'origin'

export type CropStrategy =
  | { readonly kind: 'center' }
  | { readonly kind: 'entropy' }
  | { readonly kind: 'attention' }
  | { readonly kind: 'focal'; readonly x: number; readonly y: number }

export interface TransformParams {
  readonly width?: number
  readonly height?: number
  readonly fit: TransformFit
  readonly crop: CropStrategy
  readonly format?: TransformFormat
  readonly quality?: number
}

export type TransformParseResult =
  | { readonly ok: true; readonly params: TransformParams }
  | { readonly ok: false; readonly error: string }

const FIT_VALUES: ReadonlySet<TransformFit> = new Set<TransformFit>(['cover', 'contain', 'fill'])

const FORMAT_VALUES: ReadonlySet<TransformFormat> = new Set<TransformFormat>([
  'webp',
  'avif',
  'jpeg',
  'png',
  'origin',
])

const parseFormat = (
  raw: string | undefined
): TransformParseResult | TransformFormat | undefined => {
  if (raw === undefined || raw === '') return undefined
  if (FORMAT_VALUES.has(raw as TransformFormat)) return raw as TransformFormat
  return { ok: false, error: `Unsupported format: '${raw}'` }
}

const MIN_QUALITY = 1

const MAX_QUALITY = 100

export const DEFAULT_QUALITY = 80

const parseQuality = (raw: string | undefined): TransformParseResult | number | undefined => {
  if (raw === undefined || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value < MIN_QUALITY || value > MAX_QUALITY) {
    return {
      ok: false,
      error: `quality must be an integer between ${MIN_QUALITY} and ${MAX_QUALITY}, received: '${raw}'`,
    }
  }
  return value
}

const NAMED_CROPS: ReadonlyMap<string, CropStrategy> = new Map<string, CropStrategy>([
  ['center', { kind: 'center' }],
  ['', { kind: 'center' }],
  ['entropy', { kind: 'entropy' }],
  ['attention', { kind: 'attention' }],
])

const MIN_DIMENSION = 1

const MAX_DIMENSION = 2500

const parseDimension = (
  name: string,
  raw: string | undefined
): TransformParseResult | number | undefined => {
  if (raw === undefined || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isInteger(value)) return undefined
  if (value < MIN_DIMENSION || value > MAX_DIMENSION) {
    return {
      ok: false,
      error: `${name} must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}, received: '${raw}'`,
    }
  }
  return value
}

const inFocalRange = (n: number): boolean => n >= 0 && n <= 100

const parseFocalCrop = (raw: string): TransformParseResult | CropStrategy => {
  const parts = raw.split(',')
  if (parts.length !== 2) {
    return { ok: false, error: `Invalid crop parameter: '${raw}'` }
  }
  const x = Number(parts[0])
  const y = Number(parts[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, error: `Invalid crop focal point: '${raw}'` }
  }
  if (!inFocalRange(x) || !inFocalRange(y)) {
    return {
      ok: false,
      error: `Crop focal point values must be between 0 and 100, received: '${raw}'`,
    }
  }
  return { kind: 'focal', x, y }
}

const parseCrop = (raw: string | undefined): TransformParseResult | CropStrategy => {
  if (raw === undefined) return { kind: 'center' }
  const named = NAMED_CROPS.get(raw)
  if (named) return named
  return parseFocalCrop(raw)
}

const isDimensionError = (
  result: TransformParseResult | number | undefined
): result is TransformParseResult => result !== undefined && typeof result === 'object'

const isParseError = <T>(
  result: TransformParseResult | T | undefined
): result is TransformParseResult =>
  result !== undefined && result !== null && typeof result === 'object' && 'ok' in result

const resolveFit = (raw: string | undefined): TransformFit =>
  raw !== undefined && FIT_VALUES.has(raw as TransformFit) ? (raw as TransformFit) : 'cover'

export const parseTransformParams = (
  query: Record<string, string | undefined>
): TransformParseResult => {
  const widthResult = parseDimension('width', query['width'])
  if (isDimensionError(widthResult)) return widthResult

  const heightResult = parseDimension('height', query['height'])
  if (isDimensionError(heightResult)) return heightResult

  const cropResult = parseCrop(query['crop'])
  if ('ok' in cropResult) return cropResult

  const formatResult = parseFormat(query['format'])
  if (isParseError(formatResult)) return formatResult

  const qualityResult = parseQuality(query['quality'])
  if (isParseError(qualityResult)) return qualityResult

  return {
    ok: true,
    params: {
      ...(widthResult !== undefined && { width: widthResult }),
      ...(heightResult !== undefined && { height: heightResult }),
      fit: resolveFit(query['fit']),
      crop: cropResult,
      ...(formatResult !== undefined && { format: formatResult }),
      ...(qualityResult !== undefined && { quality: qualityResult }),
    },
  }
}

export const defaultTransformParams = (): TransformParams => ({
  fit: 'cover',
  crop: { kind: 'center' },
})

export const hasTransformParams = (query: Record<string, string | undefined>): boolean =>
  ['width', 'height', 'fit', 'crop', 'format', 'quality'].some((k) => {
    const v = query[k]
    return v !== undefined && v !== ''
  })
