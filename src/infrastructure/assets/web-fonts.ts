/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bytes of the two self-hosted web fonts, embedded in the binary and served
 * at `/assets/fonts/<name>-<hash>.woff2`.
 *
 * Until these were files, both faces were inlined into every stylesheet as
 * base64 — about 74 KB of every first page load, the mono face included on
 * pages with no monospace text. As files, a browser fetches the sans face
 * once (the `<head>` preloads it), fetches the mono face only when a page
 * draws monospace text, and caches both apart from the stylesheet, which
 * changes far more often than they do.
 *
 * Geist and Geist Mono, latin subset, variable weight axis, copied byte for
 * byte from `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`
 * 5.3.0 (`files/geist-latin-wght-normal.woff2`,
 * `files/geist-mono-latin-wght-normal.woff2`). OFL-1.1; license text at
 * `licenses/OFL-1.1-geist.txt`. The SVG rasterizer's static Regular and Bold
 * (`geist-sans-woff2.ts`) are different files on purpose: resvg ignores a
 * variation axis, and the browser wants the single variable face.
 *
 * ## How the bytes get into the binary
 *
 * `with { type: 'file' }`, as in `geist-sans-woff2.ts`: the source path in dev,
 * a `/$bunfs/…` path in the compiled binary, only ever handed to `Bun.file()`.
 * Nothing reads them until a browser asks.
 */

import {
  GEIST_MONO_FONT_FILE,
  GEIST_SANS_FONT_FILE,
  webFontFileName,
  type WebFontFile,
} from '@/infrastructure/css/theme/fonts/web-font-files'
import GEIST_MONO_PATH from './fonts/geist-mono-variable-latin.woff2' with { type: 'file' }
import GEIST_SANS_PATH from './fonts/geist-variable-latin.woff2' with { type: 'file' }
import type { EmbeddedAsset } from './embedded-static-assets'

/** Each face with the embedded path its bytes are read from. */
export const EMBEDDED_WEB_FONTS: readonly (WebFontFile & { readonly path: string })[] = [
  { ...GEIST_SANS_FONT_FILE, path: GEIST_SANS_PATH },
  { ...GEIST_MONO_FONT_FILE, path: GEIST_MONO_PATH },
]

/** A served font name: a known stem, a dash, eight hex digits, `.woff2`. */
const SERVED_NAME = /^([a-z-]+)-([a-f0-9]{8})\.woff2$/

/** The outcome of a font request: the bytes, and whether the name asked for is the current one. */
export interface WebFontRead {
  readonly asset: EmbeddedAsset
  /** True when the requested hash is the embedded file's — the only case that may be cached forever. */
  readonly current: boolean
}

/**
 * Read the font a served file name asks for, or `undefined` when the name is
 * not a font this binary embeds.
 *
 * A KNOWN stem with a STALE hash still answers, with the current bytes and
 * `current: false`. That is HTML or CSS cached from a previous release asking
 * for the face it was built against: the current face is the right answer, and
 * a 404 would drop the page to the fallback font stack. The caller serves that
 * answer under a short cache, never `immutable`.
 *
 * The lookup is a match against a fixed list, never a path join, so a
 * traversing or nested name is an ordinary miss.
 */
export const readWebFont = async (fileName: string): Promise<WebFontRead | undefined> => {
  const match = SERVED_NAME.exec(fileName)
  const font = EMBEDDED_WEB_FONTS.find((candidate) => candidate.name === match?.[1])
  if (match === null || font === undefined) return undefined
  return {
    asset: { bytes: await Bun.file(font.path).bytes(), contentType: 'font/woff2' },
    current: fileName === webFontFileName(font),
  }
}
