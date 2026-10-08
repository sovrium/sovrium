/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * IBM Plex Sans, Regular and Bold, embedded in the binary as the font SVG text
 * is drawn with when nothing better is available.
 *
 * The WebAssembly build of resvg cannot see the host's fonts, and a slim
 * container usually has none, so without an embedded face SVG `<text>` rendered
 * blank. These two files make sure there is always one.
 *
 * Source: `@ibm/plex-sans` v1.1.0, `fonts/complete/woff2/` — the full glyph
 * set (Latin, Cyrillic, Greek), not a subset. resvg reads WOFF2 directly, so
 * the files are embedded as published, with no conversion step. Two static
 * weights rather than the variable face the CSS ships: resvg does not apply a
 * variation axis, so a variable file draws bold text at the regular weight.
 *
 * OFL-1.1; license text at `licenses/OFL-1.1-ibm-plex.txt`.
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

import BOLD_PATH from './fonts/ibm-plex-sans-bold.woff2' with { type: 'file' }
import REGULAR_PATH from './fonts/ibm-plex-sans-regular.woff2' with { type: 'file' }

/** The family name both embedded files declare. */
export const PLEX_SANS_FAMILY = 'IBM Plex Sans'

let loading: Promise<readonly Uint8Array[]> | undefined

const read = async (): Promise<readonly Uint8Array[]> =>
  Promise.all(
    [REGULAR_PATH, BOLD_PATH].map(
      async (path) => new Uint8Array(await Bun.file(path).arrayBuffer())
    )
  )

/**
 * The embedded IBM Plex Sans files (Regular, then Bold), read on first call
 * and shared afterwards. A failed read clears the memo, so a transient error
 * does not poison every later render.
 */
export const loadPlexSans = (): Promise<readonly Uint8Array[]> => {
  loading ??= read().catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}
