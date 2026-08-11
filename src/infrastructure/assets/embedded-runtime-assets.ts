/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typed, lazy accessor over the generated embedded runtime-asset manifest.
 *
 * The manifest ({@link ./embedded-runtime-assets.generated}) references built
 * `dist/` assets and is only valid in the compiled binary (or npm-bundled mode).
 * It is imported dynamically so dev never evaluates it — dev builds these assets
 * from `src/` at runtime instead.
 */

export interface RuntimeAssets {
  /** Embedded path of the client runtime bundle (`/assets/client.js`). */
  readonly clientBundle: string
  /** Static client-script filename → embedded path (`/assets/<name>`). */
  readonly clientScripts: Readonly<Record<string, string>>
  /** Island entry + chunk filename → embedded path (`/assets/islands/<name>`). */
  readonly islands: Readonly<Record<string, string>>
}

// eslint-disable-next-line functional/no-let -- single-shot memoization cache
let cache: Promise<RuntimeAssets> | undefined

/**
 * Resolve the embedded runtime-asset manifest (compiled/bundled mode only).
 *
 * Dynamically imported so dev — where the `dist/` assets the manifest points at
 * do not exist — never evaluates it. Memoized for the process lifetime.
 */
export const getRuntimeAssets = (): Promise<RuntimeAssets> => {
  // eslint-disable-next-line functional/no-expression-statements -- memoization cache write
  cache ??= import('./embedded-runtime-assets.generated').then(
    (m) => m.RUNTIME_ASSETS as unknown as RuntimeAssets
  )
  return cache
}
