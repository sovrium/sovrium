/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure parsing + validation for on-the-fly image transform query parameters.
 *
 * Used by the bucket file download route to interpret `?width=&height=&fit=&crop=`
 * style parameters. All functions here are pure — Sharp invocation lives in the
 * infrastructure layer.
 */

/** Sharp `fit` modes supported by Sovrium image transforms. */
export type TransformFit = 'cover' | 'contain' | 'fill'

/**
 * Output image format for on-the-fly format conversion.
 *
 * - `webp` / `avif` / `jpeg` / `png` — explicit transcode target
 * - `origin` — preserve the stored image's original format (no transcode,
 *   ignores any `Accept` header negotiation)
 *
 * When the `format` parameter is absent, the route negotiates the best
 * available format from the request's `Accept` header.
 */
export type TransformFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'origin'

/**
 * Crop strategy for `fit=cover`.
 *
 * - `center`  — default Sharp gravity (center crop)
 * - `entropy` — Sharp entropy-based smart cropping
 * - `attention` — Sharp attention-based smart cropping
 * - focal point — `{ x, y }` percentages (0-100) describing where to anchor the crop
 */
export type CropStrategy =
  | { readonly kind: 'center' }
  | { readonly kind: 'entropy' }
  | { readonly kind: 'attention' }
  | { readonly kind: 'focal'; readonly x: number; readonly y: number }

/** Parsed, validated transform request derived from query parameters. */
export interface TransformParams {
  readonly width?: number
  readonly height?: number
  readonly fit: TransformFit
  readonly crop: CropStrategy
  /**
   * Explicit output format. `undefined` means "negotiate from the `Accept`
   * header"; `origin` means "preserve the stored format unchanged".
   */
  readonly format?: TransformFormat
  /**
   * Compression quality for lossy output formats (JPEG, WebP, AVIF). An
   * integer in the inclusive range 1-100. `undefined` means "apply the
   * default quality" (see {@link DEFAULT_QUALITY}). Ignored for lossless PNG
   * output.
   */
  readonly quality?: number
}

/** Result of parsing — either valid params or a validation error to surface as HTTP 400. */
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

/**
 * Parse the `format` parameter.
 *
 * Returns the parsed `TransformFormat` for a recognised value, `undefined`
 * when the parameter is absent (auto-negotiation), or a validation error for
 * any unsupported value (e.g. `bmp`) which surfaces as HTTP 400.
 */
const parseFormat = (
  raw: string | undefined
): TransformParseResult | TransformFormat | undefined => {
  if (raw === undefined || raw === '') return undefined
  if (FORMAT_VALUES.has(raw as TransformFormat)) return raw as TransformFormat
  return { ok: false, error: `Unsupported format: '${raw}'` }
}

/** Inclusive minimum value for the `quality` parameter. */
const MIN_QUALITY = 1

/** Inclusive maximum value for the `quality` parameter. */
const MAX_QUALITY = 100

/**
 * Default compression quality applied to lossy output formats when no explicit
 * `quality` parameter is supplied.
 */
export const DEFAULT_QUALITY = 80

/**
 * Parse the `quality` parameter.
 *
 * - absent / empty — `undefined` (the default quality is applied downstream)
 * - an integer within the inclusive 1-100 range — that number
 * - anything else (non-integer, or outside 1-100, e.g. `0` / `101`) — a
 *   validation error which surfaces as HTTP 400
 */
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

/** Inclusive minimum pixel value for a `width` / `height` resize dimension. */
const MIN_DIMENSION = 1

/** Inclusive maximum pixel value for a `width` / `height` resize dimension. */
const MAX_DIMENSION = 2500

/**
 * Parse a dimension query value (`width` / `height`).
 *
 * - absent / empty / non-numeric — `undefined` (no resize on that axis)
 * - an integer within the inclusive 1-2500 range — that number
 * - an integer outside the 1-2500 range (e.g. `0`, `3000`) — a validation
 *   error which surfaces as HTTP 400
 */
const parseDimension = (
  name: string,
  raw: string | undefined
): TransformParseResult | number | undefined => {
  if (raw === undefined || raw === '') return undefined
  const value = Number(raw)
  // Non-numeric garbage (e.g. `abc`) is silently ignored — no resize requested.
  if (!Number.isInteger(value)) return undefined
  if (value < MIN_DIMENSION || value > MAX_DIMENSION) {
    return {
      ok: false,
      error: `${name} must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}, received: '${raw}'`,
    }
  }
  return value
}

/** True when a focal-point percentage is within the inclusive 0-100 range. */
const inFocalRange = (n: number): boolean => n >= 0 && n <= 100

/** Parse the focal-point `x,y` form of the `crop` parameter. */
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

/**
 * Parse the `crop` parameter.
 *
 * Accepts `center` | `entropy` | `attention`, or a focal point `x,y` where both
 * x and y are percentages in the inclusive range 0-100. Focal point values
 * outside 0-100 produce a validation error.
 */
const parseCrop = (raw: string | undefined): TransformParseResult | CropStrategy => {
  if (raw === undefined) return { kind: 'center' }
  const named = NAMED_CROPS.get(raw)
  if (named) return named
  return parseFocalCrop(raw)
}

/** True when a `parseDimension` result is a validation error rather than a number. */
const isDimensionError = (
  result: TransformParseResult | number | undefined
): result is TransformParseResult => result !== undefined && typeof result === 'object'

/**
 * True when a parse result that may carry a primitive value (a `TransformFormat`
 * string, a `number`, or `undefined`) is instead a validation error object.
 * Used to short-circuit `parseTransformParams` on the `format` / `quality` parses.
 */
const isParseError = <T>(
  result: TransformParseResult | T | undefined
): result is TransformParseResult =>
  result !== undefined && result !== null && typeof result === 'object' && 'ok' in result

/** Resolve the requested `fit` mode, defaulting to `cover` for absent/unknown values. */
const resolveFit = (raw: string | undefined): TransformFit =>
  raw !== undefined && FIT_VALUES.has(raw as TransformFit) ? (raw as TransformFit) : 'cover'

/**
 * Parse and validate transform query parameters.
 *
 * The `crop` strategy is only meaningful when `fit=cover`; for other fit modes
 * the crop value is parsed (so invalid focal points still 400) but ignored when
 * applying the transform.
 */
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

/**
 * Default transform params carrying no resize / crop / explicit format.
 *
 * Used by the download route for plain image requests that carry no `?width`
 * etc. — passing these defaults still lets the transform pipeline run
 * `Accept`-header format negotiation.
 */
export const defaultTransformParams = (): TransformParams => ({
  fit: 'cover',
  crop: { kind: 'center' },
})

/**
 * Returns true when the query carries at least one transform-affecting parameter.
 * Used to decide whether to run the transform pipeline at all.
 */
export const hasTransformParams = (query: Record<string, string | undefined>): boolean =>
  ['width', 'height', 'fit', 'crop', 'format', 'quality'].some((k) => {
    const v = query[k]
    return v !== undefined && v !== ''
  })
