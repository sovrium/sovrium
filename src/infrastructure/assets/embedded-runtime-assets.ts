/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface RuntimeAssets {
  readonly clientBundle: string
  readonly clientScripts: Readonly<Record<string, string>>
  readonly islands: Readonly<Record<string, string>>
}

let cache: Promise<RuntimeAssets> | undefined

export const getRuntimeAssets = (): Promise<RuntimeAssets> => {
  cache ??= import('./embedded-runtime-assets.generated').then(
    (m) => m.RUNTIME_ASSETS as unknown as RuntimeAssets
  )
  return cache
}
