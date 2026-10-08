/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ambient declaration for font files embedded in the binary.
 *
 * Like the WebAssembly payloads beside them, they are imported
 * `with { type: 'file' }` ONLY: Bun embeds the bytes and hands back a path — a
 * real one in dev, `/$bunfs/…` in the compiled binary — which `Bun.file()`
 * reads either way. The shim cannot enforce the attribute; the loader's unit
 * test is the runtime half.
 */
declare module '*.woff2' {
  /** Absolute path to the embedded `.woff2` file. */
  const path: string
  export default path
}
