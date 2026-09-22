/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure parsing + validation for on-the-fly image transform query parameters.
 *
 * Used by the bucket file download route to interpret `?width=&height=&fit=`
 * style parameters. All functions here are pure — the image pipeline itself
 * lives in the infrastructure layer.
 */

/**
 * How a two-dimension resize reconciles the requested box with the source
 * aspect ratio.
 *
 * - `inside` — scale to fit WITHIN the box, preserving the aspect ratio. The
 *   output may be smaller than the box that was asked for. This is the default.
 * - `fill` — stretch to exactly the box, discarding the aspect ratio. The only
 *   mode that distorts, which is why it must be named explicitly.
 *
 * `cover`, `contain` and `outside` are gone: each needs to crop or pad to
 * reach an exact box, and the pipeline exposes no crop primitive.
 */
export type TransformFit = 'fill' | 'inside'

/**
 * Output image format for on-the-fly format conversion.
 *
 * - `webp` / `jpeg` / `png` — explicit transcode target
 * - `origin` — preserve the stored image's original format (no transcode,
 *   ignores any `Accept` header negotiation)
 *
 * When the `format` parameter is absent, the route negotiates the best
 * available format from the request's `Accept` header.
 */
export type TransformFormat = 'webp' | 'jpeg' | 'png' | 'origin'

/** Parsed, validated transform request derived from query parameters. */
export interface TransformParams {
  readonly width?: number
  readonly height?: number
  readonly fit: TransformFit
  /**
   * Explicit output format. `undefined` means "negotiate from the `Accept`
   * header"; `origin` means "preserve the stored format unchanged".
   */
  readonly format?: TransformFormat
  /**
   * Compression quality for lossy output formats (JPEG, WebP). An
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

const FIT_VALUES: ReadonlySet<TransformFit> = new Set<TransformFit>(['fill', 'inside'])

/**
 * The accepted `format` values.
 *
 * `avif` was withdrawn here rather than merely stopped being produced, so
 * `?format=avif` is answered with a 400 naming the unsupported value. Leaving
 * it parseable would have meant accepting a request the encoder cannot serve
 * on Linux — the platform-conditional behaviour the withdrawal exists to end.
 */
const FORMAT_VALUES: ReadonlySet<TransformFormat> = new Set<TransformFormat>([
  'webp',
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

/**
 * Reject any `crop` parameter.
 *
 * Cropping was WITHDRAWN rather than emulated — the pipeline has no crop
 * primitive, and every available substitution (centre-cropping an `entropy`
 * request, stretching a `cover` request) still answers `200` while quietly
 * changing the image. Refusing names the problem once, at the request that
 * causes it, instead of leaving a catalogue of silently re-framed thumbnails.
 *
 * A well-formed focal point is refused exactly like a malformed one: the
 * capability is gone, so the validity of the value is no longer the question.
 */
const rejectCrop = (raw: string | undefined): TransformParseResult | undefined =>
  raw === undefined || raw === ''
    ? undefined
    : {
        ok: false,
        error:
          `Unsupported parameter 'crop': cropping is no longer offered — ` +
          `remove 'crop' from the request (accepted: width, height, fit, format, quality)`,
      }

/**
 * True when a parse result that may carry a primitive value (a `TransformFormat`
 * string, a `number`, or `undefined`) is instead a validation error object.
 * Used to short-circuit `parseTransformParams` on the `format` / `quality` parses.
 */
const isParseError = <T>(
  result: TransformParseResult | T | undefined
): result is TransformParseResult =>
  result !== undefined && result !== null && typeof result === 'object' && 'ok' in result

/** Fit applied when the request names none. Preserves the source aspect ratio. */
export const DEFAULT_FIT: TransformFit = 'inside'

/**
 * Parse the `fit` parameter.
 *
 * An unrecognised value is an ERROR, not a fallback. It used to resolve
 * silently to `cover`, so a typo changed the output instead of reporting
 * itself — and `cover`, `contain` and `outside` are themselves now
 * unrecognised, having been withdrawn along with cropping.
 */
const parseFit = (raw: string | undefined): TransformParseResult | TransformFit | undefined => {
  if (raw === undefined || raw === '') return undefined
  if (FIT_VALUES.has(raw as TransformFit)) return raw as TransformFit
  return { ok: false, error: `Unsupported fit: '${raw}' (accepted: fill, inside)` }
}

/**
 * Parse and validate transform query parameters.
 *
 * `crop` is rejected outright; `fit` is validated rather than silently
 * defaulted; dimensions are range-checked. Any one of those failing short-
 * circuits to a validation error the download route surfaces as HTTP 400.
 */
/** The validated pieces of a transform request, before defaults are applied. */
interface ValidatedTransformFields {
  readonly width: number | undefined
  readonly height: number | undefined
  readonly fit: TransformFit | undefined
  readonly format: TransformFormat | undefined
  readonly quality: number | undefined
}

/** Assemble the validated pieces, omitting the keys the request left unset. */
const buildTransformParams = (fields: ValidatedTransformFields): TransformParams => ({
  ...(fields.width !== undefined && { width: fields.width }),
  ...(fields.height !== undefined && { height: fields.height }),
  fit: fields.fit ?? DEFAULT_FIT,
  ...(fields.format !== undefined && { format: fields.format }),
  ...(fields.quality !== undefined && { quality: fields.quality }),
})

export const parseTransformParams = (
  query: Readonly<Record<string, string | undefined>>
): TransformParseResult => {
  const cropRejection = rejectCrop(query['crop'])
  if (cropRejection) return cropRejection

  const width = parseDimension('width', query['width'])
  if (isParseError(width)) return width

  const height = parseDimension('height', query['height'])
  if (isParseError(height)) return height

  const fit = parseFit(query['fit'])
  if (isParseError(fit)) return fit

  const format = parseFormat(query['format'])
  if (isParseError(format)) return format

  const quality = parseQuality(query['quality'])
  if (isParseError(quality)) return quality

  return { ok: true, params: buildTransformParams({ width, height, fit, format, quality }) }
}

/**
 * Default transform params carrying no resize and no explicit format.
 *
 * Used by the download route for plain image requests that carry no `?width`
 * etc. — passing these defaults still lets the transform pipeline run
 * `Accept`-header format negotiation.
 */
export const defaultTransformParams = (): TransformParams => ({ fit: DEFAULT_FIT })

/**
 * Returns true when the query carries at least one transform-affecting parameter.
 * Used to decide whether to run the transform pipeline at all.
 */
export const hasTransformParams = (query: Readonly<Record<string, string | undefined>>): boolean =>
  ['width', 'height', 'fit', 'crop', 'format', 'quality'].some((k) => {
    const v = query[k]
    return v !== undefined && v !== ''
  })
