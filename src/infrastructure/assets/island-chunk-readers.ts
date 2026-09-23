/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three ways Sovrium can read an emitted island bundle, behind the one
 * {@link IslandChunkReader} interface the preload manifest consumes.
 *
 * They live beside `island-preload-manifest.ts` rather than at the route-setup
 * call site because the question they answer — "what did this bundle emit, and
 * what is in each chunk" — is about the ASSET, not about serving it. Keeping
 * them here also keeps the scoping rule in one place: `toEmittedChunkPaths` and
 * the reader that needs it are now neighbours rather than two files apart.
 */

import { readdir } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { getRuntimeAssets } from './embedded-runtime-assets'
import { toEmittedChunkPaths, type IslandChunkReader } from './island-preload-manifest'

/**
 * Reader over an on-disk island build directory — the dev per-process tmpdir
 * and the bundled `dist/island-chunks`, which differ only in path.
 *
 * `recursive` is load-bearing: the dev build emits the entry at the root and
 * every chunk under `chunks/`, so a flat listing would find nothing to preload
 * and return an empty manifest that looks like a legitimate "nothing to do".
 *
 * `buildOutputPaths` — the absolute paths one `Bun.build` emitted — replaces the
 * directory listing when supplied, and the DEV path must supply it. Its output
 * directory is keyed on the process rather than the build and `Bun.build` does
 * not clean `outdir`, so reading the directory back reports every chunk the
 * process has ever emitted and no island resolves to exactly one. See
 * `toEmittedChunkPaths` for the full account. `dist/island-chunks` needs no
 * override: the build script writes it once and nothing writes it at runtime.
 */
export function diskChunkReader(
  root: string,
  buildOutputPaths?: readonly string[]
): IslandChunkReader {
  return {
    list: async () => {
      if (buildOutputPaths !== undefined) return toEmittedChunkPaths(buildOutputPaths, root)
      const names = await readdir(root, { recursive: true }).catch(() => [] as string[])
      return names.map((name) => name.split(sep).join('/')).filter((name) => name.endsWith('.js'))
    },
    read: (relativePath) => Bun.file(join(root, relativePath)).text(),
  }
}

/** Reader over the compiled binary's embedded island assets. */
export async function embeddedChunkReader(): Promise<IslandChunkReader> {
  const assets = await getRuntimeAssets()
  return {
    list: async () => Object.keys(assets.islands).filter((name) => name.endsWith('.js')),
    read: (relativePath) => {
      const embedded = assets.islands[relativePath]
      return embedded === undefined
        ? Promise.reject(new Error(`No embedded island chunk "${relativePath}"`))
        : Bun.file(embedded).text()
    },
  }
}
