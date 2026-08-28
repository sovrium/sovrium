/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single `Bun.Image` seam for the whole platform.
 *
 * ## Why this replaced `sharp`
 *
 * `sharp` ships a platform-specific native addon. `bun build --compile` bundles
 * it with no `--external`, and a `.node` addon cannot be loaded out of the
 * binary's `$bunfs` virtual filesystem — so in the DISTRIBUTED BINARY the
 * import always failed. Every wrapper caught that failure and returned the
 * original bytes, which answered `200` with a plausible `Content-Type`, so
 * image transforms silently did nothing for every self-hoster.
 *
 * `Bun.Image` is part of the runtime. It is embedded in the compiled binary
 * with no native module to resolve, which is what makes the transform work at
 * all in the artifact people actually run.
 *
 * ## Failures surface — they never degrade to the input
 *
 * Nothing here catches. A decode failure, an unknown container, or an encoder
 * the machine does not have is thrown to the caller. Returning the input bytes
 * on failure is precisely the defect this module exists to end: it converts a
 * loud, findable error into a silent, permanent no-op.
 */

/**
 * Output containers the transform pipeline can encode to.
 *
 * AVIF is absent, and its absence is measured rather than assumed. `Bun.Image`
 * has two backends: `system` on macOS/Windows (JPEG/PNG/WebP statically linked,
 * AVIF/HEIC delegated to ImageIO/WIC) and `bun` on Linux (static codecs only,
 * no AV1 encoder). A probe compiled with `bun build --compile
 * --target=bun-linux-x64` and run inside `debian:bookworm-slim` — the exact
 * `Dockerfile` base — encoded PNG, JPEG and WebP and answered AVIF with
 * `ERR_IMAGE_FORMAT_UNSUPPORTED`. `sharp` vendored libaom and could; the
 * runtime cannot.
 *
 * So AVIF passed on a maintainer's laptop and failed on Linux CI and in
 * production — a platform-conditional green. An option that only works where
 * Sovrium is developed, not where it runs, is worse than no option, so it was
 * withdrawn from the config surface entirely rather than papered over with a
 * capability check.
 *
 * Every remaining format is statically linked in BOTH backends, which is why
 * no encodability predicate survives: there is nothing left for one to decide.
 */
export type ImageOutputFormat = 'jpeg' | 'png' | 'webp'

/**
 * How a two-dimension resize reconciles the requested box with the source
 * aspect ratio. Only these two exist: `cover` / `contain` / `outside` all need
 * to crop or pad, and `Bun.Image` exposes no crop primitive.
 */
export type ImageFit = 'fill' | 'inside'

/** Canonical MIME type for each encodable output format. */
export const MIME_BY_IMAGE_FORMAT: Readonly<Record<ImageOutputFormat, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Decoded properties of a source image. */
export interface SourceImageMetadata {
  readonly width: number
  readonly height: number
  readonly format: string
}

/**
 * Read a source image's real dimensions and container format.
 *
 * `Bun.Image#width` / `#height` return `-1` until the pipeline has run, so
 * `metadata()` is the only truthful reader — an assertion against `.width`
 * would silently compare against `-1`.
 */
export const readSourceImageMetadata = async (input: Uint8Array): Promise<SourceImageMetadata> => {
  const meta = await new Bun.Image(input).metadata()
  return { width: meta.width, height: meta.height, format: meta.format }
}

/** Geometry + encoding settings for one pipeline run. */
export interface ImagePipelineOptions {
  readonly width?: number
  readonly height?: number
  readonly fit?: ImageFit
  readonly outputFormat?: ImageOutputFormat
  readonly quality?: number
}

/**
 * Resolve the height that preserves the source aspect ratio for a height-only
 * request, and vice versa. `Bun.Image#resize` is POSITIONAL — `resize(undefined,
 * height)` throws — so a height-only resize has to name both dimensions, which
 * means computing the other one from the source metadata first.
 */
const resolveHeightOnlyWidth = async (input: Uint8Array, height: number): Promise<number> => {
  const meta = await readSourceImageMetadata(input)
  return Math.max(1, Math.round((meta.width * height) / meta.height))
}

/** Default fit for a two-dimension resize: preserve the aspect ratio. */
const DEFAULT_FIT: ImageFit = 'inside'

/**
 * Apply the geometry stage.
 *
 * - neither dimension — no resize at all
 * - width only — `resize(width)`, which keeps the source aspect ratio
 * - height only — the computed width plus an exact `fill`, since the ratio has
 *   already been applied when deriving that width
 * - both — the requested box under the requested `fit`
 */
const applyResize = async (
  image: Bun.Image,
  input: Uint8Array,
  options: ImagePipelineOptions
): Promise<Bun.Image> => {
  const { width, height } = options
  const fit = options.fit ?? DEFAULT_FIT

  if (width === undefined && height === undefined) return image
  if (height === undefined) return image.resize(width as number)
  if (width === undefined) {
    return image.resize(await resolveHeightOnlyWidth(input, height), height, { fit: 'fill' })
  }
  return image.resize(width, height, { fit })
}

/**
 * Select the output encoder.
 *
 * With no `outputFormat` the pipeline re-encodes in the source format, which is
 * what a pure resize wants. PNG is lossless, so `quality` is deliberately not
 * forwarded to it.
 */
const applyEncoder = (
  image: Bun.Image,
  outputFormat: ImageOutputFormat | undefined,
  quality: number | undefined
): Bun.Image => {
  const options = quality === undefined ? {} : { quality }
  switch (outputFormat) {
    case 'webp':
      return image.webp(options)
    case 'jpeg':
      return image.jpeg(options)
    case 'png':
      return image.png()
    case undefined:
      return image
  }
}

/**
 * Decode, transform and re-encode `input`.
 *
 * Rejects — never returns the input — when the bytes are not a decodable
 * image, or when the requested encoder is unavailable on this machine. The
 * rejection carries `Bun.Image`'s own `error.code` (`ERR_IMAGE_DECODE_FAILED`,
 * `ERR_IMAGE_UNKNOWN_FORMAT`, `ERR_IMAGE_FORMAT_UNSUPPORTED`, …), which callers
 * branch on rather than parsing the message.
 */
export const runImagePipeline = async (
  input: Uint8Array,
  options: ImagePipelineOptions
): Promise<Uint8Array> => {
  const resized = await applyResize(new Bun.Image(input), input, options)
  const encoded = applyEncoder(resized, options.outputFormat, options.quality)
  return await encoded.bytes()
}
