/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { AssetKind } from '@/domain/models/app/assets/asset'

/** One private asset, read once when the app started. */
export interface LoadedAsset {
  /** The path as declared (relative to the config directory). */
  readonly path: string
  readonly kind: AssetKind
  readonly contentType: string
  readonly bytes: Uint8Array
}

/**
 * The private assets the running app declared (`assets`), loaded and checked
 * at boot: read whole, contained in the project directory, kind checked
 * against content. Actions read them by their declared path; nothing serves
 * them over HTTP — `realpaths` is what the public-directory route refuses.
 */
export interface AssetStoreShape {
  /** The asset declared at `path`, or `undefined` when none is. */
  readonly get: (path: string) => LoadedAsset | undefined
  /** Absolute real paths of every declared asset file. */
  readonly realpaths: ReadonlySet<string>
}

/** No assets: a process that loaded none (a unit test, a config with no `assets`). */
const EMPTY_ASSET_STORE: AssetStoreShape = { get: () => undefined, realpaths: new Set() }

/**
 * The asset store of the running server. A `Reference`, so a context that
 * loaded no assets (unit tests, a config-less harness) reads an empty store
 * rather than failing to resolve a service; the server's domain runtime
 * provides the store its boot loaded.
 */
export const AssetStore = Context.Reference<AssetStoreShape>('AssetStore', {
  defaultValue: () => EMPTY_ASSET_STORE,
})
