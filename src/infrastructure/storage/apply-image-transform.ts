/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DEFAULT_QUALITY } from '@/domain/services/image-transform/image-transform-params'
import type {
  TransformFormat,
  TransformParams,
} from '@/domain/services/image-transform/image-transform-params'
import type SharpNamespace from 'sharp'
import type { ResizeOptions } from 'sharp'

/**
 * `sharp` is imported lazily (dynamic `import()`), never at module top level.
 *
 * `sharp` ships a platform-specific native binding. When Sovrium is compiled
 * into a Bun standalone binary, that binding cannot be embedded — a top-level
 * `import sharp from 'sharp'` would throw at module-evaluation time and crash
 * the whole server before it can boot (the CSS phase never runs). Deferring
 * the import to first use keeps the binary bootable: image transforms simply
 * degrade to serving the original bytes when `sharp` is unavailable.
 */
type Sharp = typeof SharpNamespace

/**
 * Dynamically load the `sharp` module. The dynamic `import()` is resolved by
 * the JS module system's own module cache, so repeated calls reuse the same
 * already-evaluated module instance with no extra cost — no manual memoization
 * is needed here.
 */
const loadSharp = async (): Promise<Sharp> => {
  const mod = await import('sharp')
  return mod.default
}

/** Concrete output formats Sharp transcodes to (excludes the `origin` sentinel). */
type OutputFormat = 'webp' | 'avif' | 'jpeg' | 'png'

/** Canonical MIME type for each transcode target. */
const FORMAT_MIME: Readonly<Record<OutputFormat, string>> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/**
 * Result of an image transform.
 *
 * `format` is the format actually produced. When Sharp is unavailable it falls
 * back to `undefined` (original bytes, original — unknown — format), in which
 * case the caller derives the Content-Type from the stored filename instead.
 */
export interface ImageTransformResult {
  readonly bytes: Uint8Array
  readonly format?: OutputFormat
}

/** Map a focal-point percentage to a Sharp gravity third: low / middle / high. */
const toThird = (pct: number, low: string, mid: string, high: string): string =>
  pct < 33.34 ? low : pct > 66.66 ? high : mid

/**
 * Translate a focal point (x/y percentages) to one of Sharp's 9 gravity anchors.
 * Sharp does not accept arbitrary x/y percentages, so the focal point is mapped
 * to the gravity anchor for the image third it lands in.
 */
const focalToGravity = (x: number, y: number): string => {
  const horizontal = toThird(x, 'left', 'center', 'right')
  const vertical = toThird(y, 'top', 'center', 'bottom')
  if (vertical === 'center' && horizontal === 'center') return 'center'
  if (vertical === 'center') return horizontal
  if (horizontal === 'center') return vertical
  return `${vertical} ${horizontal}`
}

/** Map a parsed crop strategy to a Sharp `position` value for `fit=cover`. */
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

/**
 * Resolve the output format Sharp should transcode to.
 *
 * - explicit `format` (other than `origin`) — that format
 * - `format=origin` — `undefined` (no transcode, preserve original)
 * - `format` absent — negotiate from the `Accept` header (AVIF preferred,
 *   then WebP), or `undefined` when the header offers no modern format
 */
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

/** Build the Sharp resize options object for the requested transform. */
const resizeOptions = (config: RunPipelineConfig): Readonly<ResizeOptions> => {
  const { params } = config
  const position = params.fit === 'cover' ? cropToSharpPosition(config) : undefined
  return {
    ...(params.width !== undefined && { width: params.width }),
    ...(params.height !== undefined && { height: params.height }),
    fit: params.fit,
    ...(position !== undefined && { position }),
  }
}

/** Canonical MIME type for a resolved output format. */
export const mimeForFormat = (format: OutputFormat): string => FORMAT_MIME[format]

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
 * lossy formats (JPEG / WebP / AVIF) — PNG output is lossless and ignores it.
 */
const resolveQuality = (params: TransformParams): number => params.quality ?? DEFAULT_QUALITY

/** Inputs threaded through the Sharp transform pipeline. */
type RunPipelineConfig = Readonly<{
  sharp: Sharp
  input: Uint8Array
  params: TransformParams
  outputFormat: OutputFormat | undefined
  needsResize: boolean
}>

/**
 * Run the Sharp pipeline: resize (when dimensions requested) then transcode
 * (when an output format is resolved). Returns the produced bytes.
 *
 * For lossy output formats the `quality` parameter (or the default) is applied;
 * PNG output is lossless and the quality value is intentionally ignored.
 */
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
      // PNG is lossless — quality has no effect on the encoded output.
      return resized.png().toBuffer()
    default:
      return resized.toBuffer()
  }
}

/**
 * Apply on-the-fly image transforms (resize + crop + format conversion) to
 * image bytes using Sharp.
 *
 * Graceful by design: if Sharp throws (native module unavailable, input is not
 * a decodable image, etc.) the **original bytes are returned unchanged** with
 * an `undefined` format. This keeps the download route resilient — a transform
 * request never produces a hard failure, it simply degrades to serving the
 * stored original.
 *
 * @param acceptHeader - the request `Accept` header, used for format
 *   negotiation when no explicit `format` parameter is supplied.
 */
export const applyImageTransform = async (
  input: Uint8Array,
  params: TransformParams,
  acceptHeader?: string
): Promise<ImageTransformResult> => {
  const outputFormat = resolveOutputFormat(params.format, acceptHeader)
  const needsResize = params.width !== undefined || params.height !== undefined

  // Nothing to do — no resize and no transcode; serve original bytes.
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
    // Native Sharp unavailable or undecodable input — degrade to original bytes.
    return { bytes: input }
  }
}
