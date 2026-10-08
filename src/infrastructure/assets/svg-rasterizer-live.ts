/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  SvgRasterizeError,
  SvgRasterizer,
  type RasterizedSvg,
  type SvgRasterizeOptions,
} from '@/application/ports/services/svg-rasterizer'
import { imageAreaRefusal } from '@/infrastructure/export/renderer-page-setup'
import { fittedSvgSize, intrinsicSvgSize, type PixelSize } from './svg-output-size'

/** The resvg `fitTo` for the requested size: one dimension scales, keeping proportions. */
const fitTo = (options: SvgRasterizeOptions) => {
  if (options.width !== undefined) return { mode: 'width' as const, value: options.width }
  if (options.height !== undefined) return { mode: 'height' as const, value: options.height }
  return { mode: 'original' as const }
}

/**
 * A common sans-serif the host may have, kept as a glyph fallback behind the
 * embedded IBM Plex Sans (a script Plex does not cover, such as CJK). The
 * WebAssembly build of resvg cannot list system fonts the way the native one
 * does, so the usual locations are probed once, in order, and the first
 * readable file is kept for the process. Finding none is normal — a slim
 * container has no fonts — and costs nothing: Plex is always there.
 */
const SYSTEM_SANS_CANDIDATES: readonly string[] = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
]

const findSystemSans = async (): Promise<Uint8Array | undefined> => {
  const found = await Promise.all(
    SYSTEM_SANS_CANDIDATES.map(async (path) => {
      const file = Bun.file(path)
      return (await file.exists()) ? new Uint8Array(await file.arrayBuffer()) : undefined
    })
  ).catch(() => [])
  return found.find((bytes) => bytes !== undefined)
}

/** Whether a font file is one resvg reads (TrueType, OpenType or a collection; not WOFF). */
const isSfnt = (bytes: Uint8Array): boolean => {
  const tag = String.fromCharCode(...bytes.subarray(0, 4))
  return tag === 'OTTO' || tag === 'true' || tag === 'ttcf' || tag === '\u0000\u0001\u0000\u0000'
}

/** Where the rasterizer finds the host's fallback sans; injectable so a test can hide it. */
export interface SvgRasterizerDependencies {
  readonly systemSans: () => Promise<Uint8Array | undefined>
}

/**
 * The fonts SVG text is drawn with, in precedence order: the TTF/OTF fonts
 * declared in `assets`, then the embedded IBM Plex Sans, then the host's
 * common sans when it has one. resvg resolves a named `font-family` among all
 * of them, and draws text whose family is absent (or unnamed) with the FIRST
 * font loaded — a declared font when there is one, IBM Plex Sans otherwise.
 */
export const svgFontBuffers = async (
  fonts: ReadonlyArray<Uint8Array>,
  systemSans: Promise<Uint8Array | undefined>
): Promise<Uint8Array[]> => {
  // Reached lazily, like the WebAssembly: the boot path never reads the font files.
  const { loadPlexSans } = await import('./plex-sans-woff2')
  const [plex, host] = await Promise.all([loadPlexSans(), systemSans])
  return [
    ...fonts.filter(isSfnt).map((font) => new Uint8Array(font)),
    ...plex.map((font) => new Uint8Array(font)),
    ...(host === undefined ? [] : [new Uint8Array(host)]),
  ]
}

/** The image limits refused an SVG's size; the message names the limit it passed. */
class SvgTooLarge extends Error {}

/** Refuse a rasterisation whose output would pass the image limits, before it is drawn. */
const refuseOversized = (size: PixelSize): void => {
  const refusal = imageAreaRefusal({ ...size, scale: 1 })
  if (refusal !== undefined) throw new SvgTooLarge(`render_limit_exceeded: ${refusal}`)
}

/** Rasterize once, freeing the WASM-side renderer and image whatever happens. */
const rasterizeWith = async (
  svg: string,
  options: SvgRasterizeOptions,
  systemSans: Promise<Uint8Array | undefined>
): Promise<RasterizedSvg> => {
  // The size the root declares, checked before resvg reads a byte of it ...
  const declared = intrinsicSvgSize(svg)
  if (declared !== undefined) refuseOversized(fittedSvgSize(declared, options))
  // Reached lazily: the boot path never imports the 2.4 MiB WebAssembly loader.
  const { loadResvg } = await import('./resvg-wasm')
  const Resvg = await loadResvg()
  const renderer = new Resvg(svg, {
    fitTo: fitTo(options),
    font: {
      loadSystemFonts: false,
      fontBuffers: await svgFontBuffers(options.fonts ?? [], systemSans),
    },
  })
  try {
    // ... and the size resvg resolved, before it allocates the pixels.
    refuseOversized(fittedSvgSize({ width: renderer.width, height: renderer.height }, options))
    const image = renderer.render()
    try {
      return { png: image.asPng(), width: image.width, height: image.height }
    } finally {
      image.free()
    }
  } finally {
    renderer.free()
  }
}

/**
 * The resvg-wasm rasterizer over the given dependencies. The host's fallback
 * sans is looked up once per rasterizer, on its first render.
 */
export const makeSvgRasterizer = (
  dependencies: SvgRasterizerDependencies
): SvgRasterizer['Service'] => {
  let systemSans: Promise<Uint8Array | undefined> | undefined
  return {
    rasterize: (svg, options) =>
      Effect.tryPromise({
        try: () => {
          systemSans ??= dependencies.systemSans()
          return rasterizeWith(svg, options, systemSans)
        },
        catch: (cause) =>
          new SvgRasterizeError({
            message:
              cause instanceof SvgTooLarge
                ? cause.message
                : `the SVG could not be rendered: ${cause instanceof Error ? cause.message : String(cause)}`,
          }),
      }).pipe(Effect.withSpan('documents.rasterize-svg')),
  }
}

/**
 * The resvg-wasm rasterizer. The module and the embedded fonts are loaded on
 * the first render (lazily, shared afterwards), so a server that never renders
 * an SVG never pays for them.
 */
export const SvgRasterizerLive = Layer.succeed(
  SvgRasterizer,
  makeSvgRasterizer({ systemSans: findSystemSans })
)
