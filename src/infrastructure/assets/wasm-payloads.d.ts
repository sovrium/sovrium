/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ambient declaration for WebAssembly payloads embedded in the binary.
 *
 * They are imported `with { type: 'file' }` ONLY ([internal ref] D6): Bun embeds the
 * bytes and hands back a path — a real one in dev, `/$bunfs/…` in the compiled
 * binary — which `Bun.file()` reads either way. Imported without the
 * attribute, Bun would try to instantiate the module itself and the bundler
 * would no longer treat it as an opaque asset. The shim cannot enforce the
 * attribute; the loader's unit test and the compiled-binary probe are the
 * runtime half.
 */
declare module '*.wasm' {
  /** Absolute path to the embedded `.wasm` file. */
  const path: string
  export default path
}
