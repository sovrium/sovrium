/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Geist, Regular and Bold, embedded in the binary as the font SVG text is
 * drawn with when nothing better is available.
 *
 * The WebAssembly build of resvg cannot see the host's fonts, and a slim
 * container usually has none, so without an embedded face SVG `<text>` rendered
 * blank. These two files make sure there is always one, and that it is the
 * family the pages themselves are set in (shadcn/ui's Geist).
 *
 * Source: the `geist` npm tarball v1.7.2,
 * `package/dist/fonts/geist-sans/Geist-{Regular,Bold}.woff2` — the full glyph
 * set Geist publishes (Latin, Latin Extended, Cyrillic, Vietnamese), copied
 * byte for byte (sha256 `d8bce822…0df2` and `04f94859…22be2`). The package is
 * not a dependency: it is a Next.js integration, and only these two files are
 * read. Two static weights rather than the variable face the CSS ships: resvg
 * does not apply a variation axis, so a variable file draws bold text at the
 * regular weight. Geist has no Greek, so Greek text in an SVG falls back to the
 * host sans when there is one.
 *
 * OFL-1.1; license text at `licenses/OFL-1.1-geist.txt`.
 *
 * ## How the bytes get into the binary
 *
 * `with { type: 'file' }` embeds each file and hands back a path, the same
 * pattern as `resvg-wasm.ts`: the source path in dev, a `/$bunfs/…` path in
 * the compiled binary, only ever handed to `Bun.file()`. No base64 inlining.
 *
 * ## Read it lazily
 *
 * Nothing on the `sovrium start` boot path imports this module: the SVG
 * rasterizer reaches it through `await import()` on its first render, and the
 * bytes are read once per process.
 */

import BOLD_PATH from './fonts/geist-bold.woff2' with { type: 'file' }
import REGULAR_PATH from './fonts/geist-regular.woff2' with { type: 'file' }

/** The family name both embedded files declare. */
export const GEIST_SANS_FAMILY = 'Geist'

let loading: Promise<readonly Uint8Array[]> | undefined

const read = async (): Promise<readonly Uint8Array[]> =>
  Promise.all(
    [REGULAR_PATH, BOLD_PATH].map(
      async (path) => new Uint8Array(await Bun.file(path).arrayBuffer())
    )
  )

/**
 * The embedded Geist files (Regular, then Bold), read on first call
 * and shared afterwards. A failed read clears the memo, so a transient error
 * does not poison every later render.
 */
export const loadGeistSans = (): Promise<readonly Uint8Array[]> => {
  loading ??= read().catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}
