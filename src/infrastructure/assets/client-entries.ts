/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the stable-named client entries' bytes come from, and the
 * content-hashed names they are published under.
 *
 * Read by the asset routes (`static-assets.ts`), which serve those bytes, and
 * by the page renderer, which references the hashed names. Both must agree on
 * the same bytes, so both read them from here.
 */

import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getRuntimeAssets } from '@/infrastructure/assets/embedded-runtime-assets'
import { logDebug } from '@/infrastructure/logging/logger'
import { isDevCacheDisabled, isProduction as isProductionEnv } from '@/infrastructure/process/env'
import {
  clientScriptPath,
  isBundled,
  isCompiled,
  resolvePackagePath,
} from '@/infrastructure/process/package-paths'
import { islandDirName } from '@/infrastructure/server/route-setup/island-dir-sweep'
import {
  hashedEntryName,
  hashedEntryPaths,
  serveEntry,
  stableEntryName,
  type EntryCacheControl,
} from './client-entry-hash'
import { diskChunkReader, embeddedChunkReader } from './island-chunk-readers'
import {
  computeChunkPreloadManifest,
  computeIslandPreloadManifest,
  toEmittedChunkPaths,
  type IslandChunkReader,
  type IslandPreloadManifest,
} from './island-preload-manifest'

const isProduction = isProductionEnv()

/**
 * Wrap an asset `build` step in promise-memoization that is bypassed in dev.
 *
 * Prebuilt-asset modes (compiled binary, npm bundle) and normal dev runs share
 * the same cache. Only a live-edit dev run (`isDevCacheDisabled()`) re-runs
 * `build` on every call so source edits appear without a restart. The
 * `!isCompiled && !isBundled` guard keeps prebuilt assets memoized even when the
 * dev-cache flag is set, since there is no source to rebuild from in those modes.
 *
 * Both bundle providers (`getClientBundle` here, `buildIslands` in
 * `static-assets.ts`) share this exact dev-bypass/memo idiom; centralizing it
 * keeps the dev-cache condition in one place and removes the per-provider
 * mutable `cachedPromise`.
 */
export const memoizeUnlessDev = <T>(build: () => Promise<T>): (() => Promise<T>) => {
  let cachedPromise: Promise<T> | undefined
  return (): Promise<T> => {
    if (!isCompiled && !isBundled && isDevCacheDisabled()) return build()
    return (cachedPromise ??= build())
  }
}

/**
 * The client runtime as one build emitted it: the loader entry
 * (`/assets/client.js`) and the feature chunks it imports by relative specifier
 * (`/assets/client-chunks/<name>-<hash>.js`).
 */
export interface ClientBundle {
  /** The loader entry's source. */
  readonly entryText: string
  /** The chunk file names this build emitted (`client-core-runtime-<hash>.js`). */
  readonly chunkNames: readonly string[]
  /** One chunk's source, by file name. Rejects for a name not in `chunkNames`. */
  readonly readChunk: (name: string) => Promise<string>
  /**
   * Feature → the `/assets/…` hrefs a page asking for it declares as
   * `modulepreload`. See {@link CLIENT_FEATURE_CHUNK_NAMES}.
   */
  readonly preloads: Readonly<Record<string, readonly string[]>>
}

/** The loader entry's file name, at the root of every client build. */
const CLIENT_ENTRY_FILE = 'client-bundle.js'

/** The directory the feature chunks are written to, beside the entry. */
export const CLIENT_CHUNK_DIR = 'client-chunks'

/**
 * Feature → the `[name]` Bun gives its chunk: the basename of the module
 * `islands/client.ts` imports for it. The build script fails unless it emits
 * exactly one chunk per name, so a rename cannot silently drop a preload.
 */
const CLIENT_FEATURE_CHUNK_NAMES: Readonly<Record<string, string>> = {
  core: 'client-core-runtime',
}

/**
 * Where a source checkout builds the client runtime: inside this process's own
 * island build directory, so the island sweep reclaims it with the rest — see
 * `ISLAND_OUT_DIR` in `static-assets.ts` for why the directory is per process.
 */
const DEV_CLIENT_OUT_DIR = join(tmpdir(), islandDirName(process.pid), 'client-runtime')

/** A reader rooted where the entry sits, so chunk paths read `client-chunks/<name>`. */
const clientReader = (
  entryText: string,
  chunkNames: readonly string[],
  readChunk: (name: string) => Promise<string>
): IslandChunkReader => ({
  list: async () => [CLIENT_ENTRY_FILE, ...chunkNames.map((name) => `${CLIENT_CHUNK_DIR}/${name}`)],
  read: async (path) =>
    path === CLIENT_ENTRY_FILE ? entryText : readChunk(path.slice(CLIENT_CHUNK_DIR.length + 1)),
})

/** Complete a build's sources into a {@link ClientBundle}, preload map included. */
const toClientBundle = async (
  entryText: string,
  chunkNames: readonly string[],
  read: (name: string) => Promise<string>
): Promise<ClientBundle> => {
  const known = new Set(chunkNames)
  const readChunk = (name: string): Promise<string> =>
    known.has(name) ? read(name) : Promise.reject(new Error(`No client chunk "${name}"`))
  const manifest = await computeChunkPreloadManifest(
    clientReader(entryText, chunkNames, readChunk),
    CLIENT_ENTRY_FILE,
    CLIENT_FEATURE_CHUNK_NAMES,
    'CLIENT'
  )
  const preloads = Object.fromEntries(
    Object.entries(manifest).map(([feature, paths]) => [
      feature,
      paths.map((path) => `/assets/${path}`),
    ])
  )
  return { entryText, chunkNames, readChunk, preloads }
}

/** The `.js` files directly under `dir`, or none when it does not exist. */
const listChunkFiles = async (dir: string): Promise<readonly string[]> =>
  (await readdir(dir).catch(() => [] as string[])).filter((name) => name.endsWith('.js')).toSorted()

/** The prebuilt client runtime embedded in the compiled binary. */
const readEmbeddedClientBundle = async (): Promise<ClientBundle> => {
  const assets = await getRuntimeAssets()
  const chunks = assets.clientChunks
  return toClientBundle(
    await Bun.file(assets.clientBundle).text(),
    Object.keys(chunks).toSorted(),
    (name) => Bun.file(chunks[name] as string).text()
  )
}

/** The prebuilt client runtime the npm bundle ships in `dist/`. */
const readDistClientBundle = async (): Promise<ClientBundle> => {
  const chunkDir = resolvePackagePath('dist', CLIENT_CHUNK_DIR)
  return toClientBundle(
    await Bun.file(resolvePackagePath('dist', CLIENT_ENTRY_FILE)).text(),
    await listChunkFiles(chunkDir),
    (name) => Bun.file(join(chunkDir, name)).text()
  )
}

/** Build the client runtime from `src/` into this process's directory. */
const buildDevClientBundle = async (): Promise<ClientBundle> => {
  const result = await Bun.build({
    entrypoints: [resolvePackagePath('src', 'presentation', 'islands', 'client.ts')],
    outdir: DEV_CLIENT_OUT_DIR,
    target: 'browser',
    minify: isProduction,
    format: 'esm',
    splitting: true,
    naming: { entry: CLIENT_ENTRY_FILE, chunk: `${CLIENT_CHUNK_DIR}/[name]-[hash].js` },
  })

  if (!result.success) {
    const errors = result.logs.map((log) => log.message).join('\n')
    throw new Error(`Client bundle build failed:\n${errors}`)
  }

  const entry = result.outputs.find((output) => output.kind === 'entry-point')
  if (!entry) {
    throw new Error('Client bundle build produced no output')
  }

  // Scoped to THIS build's outputs: the directory outlives a build, and a
  // listing would hand back every chunk the process ever emitted.
  const chunkDir = join(DEV_CLIENT_OUT_DIR, CLIENT_CHUNK_DIR)
  const chunkNames = toEmittedChunkPaths(
    result.outputs.filter((output) => output.kind === 'chunk').map((output) => output.path),
    chunkDir
  )
  return toClientBundle(await entry.text(), chunkNames, (name) =>
    Bun.file(join(chunkDir, name)).text()
  )
}

/**
 * Creates a lazy-cached client runtime provider.
 *
 * Compiled binary: the embedded entry and chunks. npm bundle: `dist/`. Source
 * checkout: a split `Bun.build` of `src/presentation/islands/client.ts`.
 *
 * The result is cached via promise memoization (bypassed on dev live-edit runs).
 */
export const getClientBundle = memoizeUnlessDev((): Promise<ClientBundle> =>
  isCompiled
    ? readEmbeddedClientBundle()
    : isBundled
      ? readDistClientBundle()
      : buildDevClientBundle()
)

/** The client runtime loader entry's source, served at `/assets/client.js`. */
export const readClientEntry = async (): Promise<string> => (await getClientBundle()).entryText

/** Read a script's bytes from a path, or from a path resolved lazily. */
export const readScript = async (scriptPath: string | (() => Promise<string>)): Promise<string> =>
  Bun.file(typeof scriptPath === 'function' ? await scriptPath() : scriptPath).text()

/**
 * Resolve a client-script source: the embedded copy in the compiled binary,
 * else the on-disk path (dist/ when bundled, src/ in dev).
 */
export const clientScriptSource = (name: string): string | (() => Promise<string>) =>
  isCompiled
    ? () => getRuntimeAssets().then((a) => a.clientScripts[name] as string)
    : clientScriptPath(name)

/**
 * Whether this process serves PREBUILT client entries — the compiled binary's
 * embedded copies or the npm bundle's `dist/` — whose bytes are fixed for the
 * life of the release, and therefore publishable under a content-hashed name.
 *
 * A source checkout builds `client.js` at runtime and already names its island
 * entry by hash (`island-client-<hash>.js`), and it serves everything uncached,
 * so it keeps the stable names.
 */
export const servesPrebuiltEntries = isCompiled || isBundled

/**
 * The top-level stable entries that are ALSO published under a hashed name
 * (`/assets/<name>-<hash>.js`), each with how to read the bytes it serves. The
 * island entry is the fourth, and is handled by `setupIslandRoutes`
 * because it must stay under `/assets/islands/` (it imports its chunks by
 * relative specifier).
 */
export const HASHED_TOP_LEVEL_ENTRIES: Readonly<Record<string, () => Promise<string>>> = {
  'client.js': readClientEntry,
  'language-switcher.js': () => readScript(clientScriptSource('language-switcher.js')),
  'scroll-animation.js': () => readScript(clientScriptSource('scroll-animation.js')),
}

/**
 * Stable entry path → the content-hashed path rendered pages reference instead
 * (`/assets/client.js` → `/assets/client-3fa9c210.js`). Empty in a source
 * checkout, where pages keep the stable names.
 *
 * Injected into the page renderer, which looks each path up and falls back to
 * the stable one — so an entry missing from the map degrades to the alias,
 * never to a 404.
 */
export const resolveClientScriptPaths = memoizeUnlessDev(
  async (): Promise<Readonly<Record<string, string>>> =>
    servesPrebuiltEntries ? hashedEntryPaths(HASHED_TOP_LEVEL_ENTRIES, '/assets/') : {}
)

/**
 * One client runtime chunk as a response, or `undefined` for a name the current
 * build did not emit (the caller answers 404).
 */
export async function serveClientChunk(
  name: string,
  cacheControl: string
): Promise<Response | undefined> {
  const bundle = await getClientBundle()
  if (!bundle.chunkNames.includes(name)) return undefined
  return new Response(await bundle.readChunk(name), {
    headers: { 'Content-Type': 'application/javascript', 'Cache-Control': cacheControl },
  })
}

/**
 * Client runtime feature → the chunk hrefs a page loading that feature declares
 * as `modulepreload`. Injected into the page renderer beside
 * {@link resolveClientScriptPaths}.
 */
export const resolveClientRuntimePreloads = async (): Promise<
  Readonly<Record<string, readonly string[]>>
> => (await getClientBundle()).preloads

/**
 * Serve a hashed top-level entry name (current hash pinned, any other hash
 * revalidating — see `serveEntry`), or `undefined` for an unknown name.
 */
export async function serveHashedTopLevelEntry(
  request: Readonly<Request>,
  file: string,
  cacheControl: EntryCacheControl
): Promise<Response | undefined> {
  const stable = stableEntryName(file)
  const read = stable === undefined ? undefined : HASHED_TOP_LEVEL_ENTRIES[stable]
  if (stable === undefined || read === undefined) return undefined
  return serveEntry({ request, requested: file, stable, read, cacheControl })
}

/** Where the npm bundle ships its prebuilt island entry and chunks. */
export const PREBUILT_ISLAND_DIR = resolvePackagePath('dist', 'island-chunks')

/** A reader over the prebuilt island bundle: embedded in the binary, else `dist/`. */
export const prebuiltIslandReader = async (): Promise<IslandChunkReader> =>
  isCompiled ? embeddedChunkReader() : diskChunkReader(PREBUILT_ISLAND_DIR)

/** The stable name the prebuilt island entry ships under (embedded and `dist/`). */
export const PREBUILT_ISLAND_ENTRY = 'island-entry.js'

/** The prebuilt island entry's bytes (compiled binary or npm bundle). */
export const readPrebuiltIslandEntry = memoizeUnlessDev(async (): Promise<string> =>
  (await prebuiltIslandReader()).read(PREBUILT_ISLAND_ENTRY)
)

/**
 * Serve the prebuilt island entry under either of its names, or `undefined`
 * when `relativePath` names neither.
 *
 * `island-entry-<hash>.js` with the CURRENT hash is the name pages reference,
 * pinned `immutable`. The unhashed `island-entry.js` — and a hash from another
 * release — is the alias HTML cached from an older release still names: it
 * serves the current entry `no-cache` with an `ETag`, so it is revalidated on
 * every use rather than outliving the chunks it imports.
 */
export async function servePrebuiltIslandEntry(
  request: Readonly<Request>,
  relativePath: string,
  cacheControl: EntryCacheControl
): Promise<Response | undefined> {
  if (
    !servesPrebuiltEntries ||
    (relativePath !== PREBUILT_ISLAND_ENTRY &&
      stableEntryName(relativePath) !== PREBUILT_ISLAND_ENTRY)
  ) {
    return undefined
  }
  return serveEntry({
    request,
    requested: relativePath,
    stable: PREBUILT_ISLAND_ENTRY,
    read: readPrebuiltIslandEntry,
    cacheControl,
  })
}

/**
 * The prebuilt island bundle as the page renderer consumes it: the entry's
 * content-hashed name (`island-entry-<hash>.js`, the name pages reference) and
 * the preload manifest computed over the stable-named entry it stands for.
 */
export async function prebuiltIslandBuild(): Promise<{
  readonly entryFile: string
  readonly preloads: IslandPreloadManifest
}> {
  logDebug('[ISLANDS] Using pre-built island entry')
  const preloads = await computeIslandPreloadManifest(
    await prebuiltIslandReader(),
    PREBUILT_ISLAND_ENTRY
  )
  return {
    entryFile: hashedEntryName(PREBUILT_ISLAND_ENTRY, await readPrebuiltIslandEntry()),
    preloads,
  }
}
