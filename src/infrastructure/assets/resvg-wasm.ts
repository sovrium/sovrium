/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The resvg WebAssembly payload, loaded from inside the compiled binary
 * ([internal ref] D4/D6: `Bun.Image` does not decode SVG, and a native addon cannot
 * ride `bun build --compile`).
 *
 * This module is the LOADER only — no port, no Layer, no render policy. The
 * document-rendering adapter that consumes it owns all of that, and wraps
 * {@link loadResvg} in `Effect.tryPromise` with a typed error (E2).
 *
 * ## How the bytes get into the binary
 *
 * `with { type: 'file' }` makes the bundler embed `index_bg.wasm` and hand
 * back a path: the real one under `node_modules/` in dev, a
 * `/$bunfs/root/index_bg-<hash>.wasm` inside the compiled binary. That value
 * is only ever handed to `Bun.file()` — never parsed or compared — so nothing
 * here depends on which of the two it is. No base64 inlining ([internal ref] D6):
 * the payload stays a 2.4 MiB binary blob instead of a 3.2 MiB string.
 *
 * ## Read it lazily
 *
 * Nothing on the `sovrium start` boot path may import this module statically:
 * the import itself costs one path string, but the first {@link loadResvg}
 * reads and compiles 2.4 MiB of WebAssembly. The consumer reaches it through
 * an `await import()` at the point of use, as `sovrium docs` does for the
 * manual.
 *
 * ## Once per process
 *
 * `initWasm` throws if called twice, so the instantiation is memoised. A
 * failed attempt clears the memo (the package only latches on success), so a
 * transient read failure does not poison every later render.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm'
import WASM_PATH from '@resvg/resvg-wasm/index_bg.wasm' with { type: 'file' }

/** The resvg renderer constructor, usable once {@link loadResvg} has resolved. */
export type ResvgConstructor = typeof Resvg

let initialisation: Promise<ResvgConstructor> | undefined

const instantiate = async (): Promise<ResvgConstructor> => {
  await initWasm(await Bun.file(WASM_PATH).arrayBuffer())
  return Resvg
}

/**
 * Instantiates the embedded resvg WebAssembly module on first call and
 * resolves to the `Resvg` constructor. Concurrent and later calls share the
 * same instantiation.
 */
export const loadResvg = (): Promise<ResvgConstructor> => {
  initialisation ??= instantiate().catch((error: unknown) => {
    initialisation = undefined
    throw error
  })
  return initialisation
}
