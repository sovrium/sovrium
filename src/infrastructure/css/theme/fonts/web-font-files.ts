/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two self-hosted web fonts, by NAME — the content-hashed file each one is
 * served as, and nothing that reads a byte.
 *
 * Deliberately free of the `with { type: 'file' }` imports that embed the bytes
 * (those live in `@/infrastructure/assets/web-fonts`): the stylesheet assembler
 * and the server-rendered `<head>` only need the URL, and a module they import
 * must not drag a font file into every bundle that reaches it.
 *
 * WHY A HARD-CODED HASH. The stylesheet is assembled synchronously, so the URL
 * cannot wait on a read of the file it names. The hash is therefore written
 * here, and `web-fonts.test.ts` recomputes it from the embedded bytes: replacing
 * a font file without updating its hash fails the unit suite rather than
 * serving new bytes under an `immutable` name a browser has already cached.
 *
 * Geist, latin subset, variable weight axis (100–900), from
 * `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` 5.3.0.
 * OFL-1.1; license text at `licenses/OFL-1.1-geist.txt`.
 */

/** Route prefix the font files are served under, at the root of every app. */
export const WEB_FONT_ROUTE_PREFIX = '/assets/fonts/'

/** One self-hosted face: the name its file is served under, and its content hash. */
export interface WebFontFile {
  /** The served name's stem, e.g. `geist`. */
  readonly name: string
  /** First 8 hex digits of the sha256 of the file's bytes. */
  readonly hash: string
}

/** Geist Variable — the sans family `--font-sans` names. */
export const GEIST_SANS_FONT_FILE: WebFontFile = { name: 'geist', hash: '19f9c925' }

/** Geist Mono Variable — the mono family `--font-mono` names. */
export const GEIST_MONO_FONT_FILE: WebFontFile = { name: 'geist-mono', hash: '684ad5b5' }

/** Every self-hosted face, in the order the stylesheet declares them. */
export const WEB_FONT_FILES: readonly WebFontFile[] = [GEIST_SANS_FONT_FILE, GEIST_MONO_FONT_FILE]

/** The served file name, e.g. `geist-19f9c925.woff2`. */
export const webFontFileName = (font: WebFontFile): string => `${font.name}-${font.hash}.woff2`

/** The absolute URL the `<head>` preloads, e.g. `/assets/fonts/geist-19f9c925.woff2`. */
export const webFontHref = (font: WebFontFile): string =>
  `${WEB_FONT_ROUTE_PREFIX}${webFontFileName(font)}`

/**
 * The URL an `@font-face` rule names, RELATIVE to the stylesheet.
 *
 * The stylesheet is always served from `/assets/` (`output.css` or
 * `output-<hash>.css`), so `fonts/<file>` resolves to the same
 * `/assets/fonts/<file>` the `<head>` preloads — and keeps resolving when a
 * static export is hosted under a base path, which an absolute `/assets/...`
 * inside the CSS would not, because the HTML base-path rewrite never reads the
 * stylesheet.
 */
export const webFontStylesheetUrl = (font: WebFontFile): string => `fonts/${webFontFileName(font)}`
