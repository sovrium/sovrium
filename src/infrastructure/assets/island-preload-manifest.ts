/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Island-type -> emitted-chunk map, so the SSR document can declare a
 * `<link rel="modulepreload">` for the islands a page actually mounts.
 *
 * WHY THIS EXISTS — THE RACE A RUNTIME PRELOAD CANNOT WIN
 * ------------------------------------------------------
 * `src/presentation/islands/island-registry.ts` owns the general story: there is
 * exactly ONE island entry module, and a browser fetches an ES module's entire
 * static import closure before evaluating a line of it, so a static `import`
 * there is eager for EVERY island-bearing page. Twelve of fourteen static
 * imports moved behind `import()` on 2026-09-01 and bought their timing
 * guarantee back with a runtime pass (`preloadIslandsWithin`).
 *
 * Two could not follow. A runtime preload buys *"resolved before the mount
 * pass"*, never *"resolved before `load`"*: the entry is a deferred module
 * script, its top-level `await` does not hold back the load event, and
 * `page.goto()` returns on `load`. The `crud-form` chunk pulls a sub-graph
 * (react-hook-form, zod, the field renderers), so it loses that race RELIABLY
 * rather than occasionally: measured 2026-09-02 over four runs with the preload
 * links suppressed, 8, 9, 9 and 10 of the seventeen specs in
 * `[internal ref]` failed —
 * against 17/17 passing on two runs with the links emitted.
 *
 * Quote the RANGE, never one of those numbers. Each run is a draw from a race,
 * and an earlier revision of this docstring cited a single count as if it were a
 * constant. That reads as determinism, and invites someone meeting a run that
 * fails a different number to go looking for a second bug. The spread is itself
 * the evidence: a deterministic ordering would not wander, and no suppressed run
 * ever came back clean.
 *
 * The failure is `setInputFiles` landing on the SSR `<input type="file">`, whose
 * value React discards on its first render. The form renders perfectly and
 * silently drops the file.
 *
 * A `<link rel="modulepreload">` in `<head>` closes exactly that gap and nothing
 * else: the chunk fetch starts at HTML-PARSE time, in parallel with the entry
 * rather than behind it, so the entry's `import()` finds the module already in
 * the map and resolves in microtasks instead of round trips.
 *
 * WHY THE MAP IS COMPUTED AND NOT WRITTEN DOWN
 * -------------------------------------------
 * Chunk filenames are content-hashed (`crud-form-island-a1b2c3d4.js`), so the
 * href cannot be a constant. Only the `[name]` half is stable, and only because
 * Bun substitutes the BASENAME OF THE RESOLVED FILE — not of the import
 * specifier. That distinction is load-bearing rather than pedantic:
 * `import('./crud-form-island')` resolved to `crud-form-island/index.tsx` and
 * emitted `index-<hash>.js`, indistinguishable from the two other
 * directory-index chunks in the same build. The module was renamed to
 * `crud-form-island/crud-form-island.tsx` in the same commit so the emitted name
 * is unambiguous, and {@link resolveChunk} PROVES the match is unique on every
 * boot rather than trusting it.
 *
 * Resolution cannot run the other way (specifier -> file) at request time: the
 * compiled binary ships no `src/` to resolve against, only the emitted chunk
 * names. So the name is declared here and checked against the real build.
 *
 * WHY IT COVERS TWO ISLANDS AND NOT TWELVE
 * ----------------------------------------
 * The preload link exists to buy back what a static import guaranteed, and
 * exactly two islands had that guarantee. Every other priority island already
 * passes its specs on the runtime preload path, and listing one here would put
 * bytes into the `<head>` of pages that do not need them — the opposite of what
 * the change is for. Add an entry only alongside a spec that fails without it.
 */

import { logError } from '@/infrastructure/logging/logger'

/**
 * Island types whose chunk must be discoverable from the HTML, keyed by island
 * type (exactly as in `ISLANDS`), valued by the `[name]` Bun substitutes into
 * `naming.chunk` — see the header for why that is the resolved file's basename.
 */
export const PRELOADED_ISLAND_CHUNK_NAMES: Readonly<Record<string, string>> = {
  'auth-form': 'auth-form-island',
  'crud-form': 'crud-form-island',
}

/** A manifest entry: island type -> the chunk paths its mount needs up front. */
export type IslandPreloadManifest = Readonly<Record<string, readonly string[]>>

/**
 * The `.js` files one build emitted, as paths relative to its output root.
 *
 * WHY A BUILD'S OWN OUTPUT LIST AND NOT A DIRECTORY LISTING
 * --------------------------------------------------------
 * The dev/watch path builds into `<tmpdir>/sovrium-islands-<pid>` — one
 * directory per PROCESS, not per build — and `Bun.build` does not clean its
 * `outdir` (measured 2026-09-22: building twice into one directory leaves both
 * builds' content-hashed chunks side by side). Every rebuild therefore ADDS a
 * `crud-form-island-<hash>.js` rather than replacing one, and a rebuild happens
 * on every request while `isDevCacheDisabled()` holds.
 *
 * Reading the directory back then answers a different question from the one
 * {@link resolveChunk} is asking. It wants "which chunk did THIS build emit for
 * this island"; a listing answers "which chunks has this process ever emitted",
 * and after the second build that is two — so the island resolves to nothing and
 * its preload link silently disappears. The same shared directory produces the
 * zero case from the other side: two boots racing in one process can have one
 * reading the directory while the other is still writing into it.
 *
 * Scoping the listing to the build's own outputs removes both, because the
 * ambiguity was never in the resolver — it was in the question. `resolveChunk`
 * keeps logging zero and two as errors, and after this they mean what they say:
 * a build that really did emit the wrong number of chunks for an island.
 *
 * The two SHIPPING modes never had the problem and are unchanged: the compiled
 * binary resolves against its embedded asset map, and `dist/island-chunks` is
 * written once by the build script and never at runtime.
 */
export function toEmittedChunkPaths(
  outputPaths: readonly string[],
  root: string
): readonly string[] {
  const prefix = root.endsWith('/') ? root : `${root}/`
  return outputPaths
    .map((path) => path.split('\\').join('/'))
    .map((path) => (path.startsWith(prefix) ? path.slice(prefix.length) : path))
    .filter((path) => path.endsWith('.js'))
}

/**
 * Reads the emitted island bundle. Injected rather than imported so the three
 * shipping modes (dev tmpdir build, `dist/`, embedded-in-binary) share ONE
 * closure walk instead of each growing a private copy of it.
 */
export interface IslandChunkReader {
  /** Every emitted file, as a path RELATIVE to the `/assets/islands/` root. */
  readonly list: () => Promise<readonly string[]>
  /** Source text of one such path. Rejects if it does not exist. */
  readonly read: (relativePath: string) => Promise<string>
}

/**
 * Static (eager) module specifiers: `import … from 'x'`, bare `import 'x'`, and
 * `export … from 'x'`. Deliberately does NOT match `import('x')` — a dynamic
 * call is a split point, and preloading past it would drag the whole lazy graph
 * into the document. Mirrors `[internal ref]`, which
 * walks the same emitted output for the adjacent question.
 */
const STATIC_IMPORT_RE =
  /(?:^|[;}\s])(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?["']([^"']+)["']/g

/** Resolve `./sibling.js` against the directory of `fromPath`, both relative. */
function resolveSibling(fromPath: string, specifier: string): string {
  const dir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : ''
  const segments = [...dir.split('/').filter(Boolean), ...specifier.split('/')]
  const stack = segments.reduce<readonly string[]>((acc, segment) => {
    if (segment === '.' || segment === '') return acc
    if (segment === '..') return acc.slice(0, -1)
    return [...acc, segment]
  }, [])
  return stack.join('/')
}

/**
 * Every chunk reachable from `start` through STATIC imports, `start` included.
 *
 * This is the set a browser must have before the module can evaluate, which is
 * precisely the set worth declaring in `<head>`: preloading only the island's
 * own chunk would still leave its sub-graph as a second round trip, and the
 * sub-graph is the whole reason `crud-form` lost the race.
 *
 * A chunk that cannot be read contributes nothing rather than aborting the walk
 * — a missing preload link degrades to today's behaviour, while a throw here
 * would take a page render with it.
 */
function collectStaticClosure(
  reader: IslandChunkReader,
  start: string
): Promise<ReadonlySet<string>> {
  const seen = new Set<string>()

  const visit = async (path: string): Promise<void> => {
    if (seen.has(path)) return
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the visited set IS the accumulator this walk exists to fill, and it is marked BEFORE the first await so two concurrent branches cannot both descend into one chunk
    seen.add(path)

    const source = await reader.read(path).catch(() => undefined)
    if (source === undefined) return

    const specifiers = [...source.matchAll(STATIC_IMPORT_RE)]
      .map((match) => match[1])
      .filter((specifier): specifier is string => specifier !== undefined)
      // Only relative specifiers name an emitted chunk; a bare specifier in a
      // browser bundle is an unbundled external with no file to preload.
      .filter((specifier) => specifier.startsWith('.'))

    return Promise.all(specifiers.map((specifier) => visit(resolveSibling(path, specifier)))).then(
      () => undefined
    )
  }

  return visit(start).then(() => seen)
}

/**
 * The one emitted chunk for `chunkName`, or `undefined` with a logged error.
 *
 * Zero matches and two matches are BOTH failures, and both are logged rather
 * than thrown. The consequence of returning `undefined` is a missing preload
 * link, i.e. exactly the behaviour that shipped before this module existed —
 * degraded, not broken. Throwing would instead surface as a page that renders
 * no island runtime at all, which is worse than the problem.
 *
 * The mechanical guard against this going unnoticed is
 * `[internal ref]`, which
 * fails the moment `crud-form` stops being preloaded.
 */
function resolveChunk(
  files: readonly string[],
  islandType: string,
  chunkName: string
): string | undefined {
  const escaped = chunkName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?:^|/)${escaped}-[a-z0-9]+\\.js$`)
  const matches = files.filter((file) => pattern.test(file))

  if (matches.length === 1) return matches[0]

  logError(
    `[ISLANDS] preload manifest: expected exactly one chunk named "${chunkName}-<hash>.js" for ` +
      `island "${islandType}", found ${matches.length}${matches.length > 0 ? ` (${matches.join(', ')})` : ''}. ` +
      `No modulepreload will be emitted for it, so its mount races the load event again — see ` +
      `src/infrastructure/assets/island-preload-manifest.ts. Most likely the island module was ` +
      `renamed (update PRELOADED_ISLAND_CHUNK_NAMES) or resolved to a directory index (give the ` +
      `file a unique basename).`
  )
  return undefined
}

/**
 * Build the island-type -> preload-chunk map for one emitted bundle.
 *
 * Chunks already in the ENTRY's own static closure are SUBTRACTED: the browser
 * fetches those as part of the entry's module graph regardless, so a link for
 * them would add `<head>` bytes and move nothing. What remains is exactly the
 * sub-graph that used to arrive too late.
 *
 * @param reader - access to the emitted bundle
 * @param entryFile - the entry's path relative to the island asset root
 */
export async function computeIslandPreloadManifest(
  reader: IslandChunkReader,
  entryFile: string
): Promise<IslandPreloadManifest> {
  const files = await reader.list()
  const entryClosure = await collectStaticClosure(reader, entryFile)

  const entries = await Promise.all(
    Object.entries(PRELOADED_ISLAND_CHUNK_NAMES).map(async ([islandType, chunkName]) => {
      const chunk = resolveChunk(files, islandType, chunkName)
      if (chunk === undefined) return undefined
      const closure = await collectStaticClosure(reader, chunk)
      const needed = [...closure].filter((path) => !entryClosure.has(path)).toSorted()
      return needed.length > 0 ? ([islandType, needed] as const) : undefined
    })
  )

  return Object.fromEntries(entries.filter((entry) => entry !== undefined))
}
