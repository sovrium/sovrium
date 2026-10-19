/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * On-disk compile cache for the per-app Tailwind stylesheet.
 *
 * The in-memory cache (`css-cache-service.ts`) dies with the process, and the
 * pre-compiled file is sound only for the app it was built for, so without
 * this module every boot of an app with a `design`, a scoped design system or
 * its own classes compiles Tailwind from scratch. This module keeps that
 * compile across restarts: one file per (engine build, compile inputs), written atomically,
 * read back only when its integrity header still matches its body.
 *
 * Layout: `<cache dir>/<engine dir>/<inputs digest>.css`, where the engine
 * directory names the build (version + a digest of the engine fingerprint) so
 * an upgrade starts a fresh directory and the old one can be pruned whole.
 *
 * A miss, a corrupt entry or an unwritable directory is never an error for the
 * caller: each degrades to a plain compile, as if the cache were off. Nothing here touches the network, and nothing is written outside
 * the cache directory.
 */

import { createHash, randomBytes } from 'node:crypto'
import { statSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Data, Effect } from 'effect'
import { logDebug } from '@/infrastructure/logging/logger'
import type { CompiledCSS } from '@/infrastructure/css/cache/css-cache-service'

/** A file-system failure while reading, writing or pruning the compile cache. */
export class TailwindCompileCacheError extends Data.TaggedError('TailwindCompileCacheError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** The env slice this module reads; a parameter so the tests need no globals. */
export type CompileCacheEnv = Readonly<Record<string, string | undefined>>

/** Engine directories untouched for longer than this are removed on a write. */
const STALE_ENGINE_DIR_MS = 30 * 24 * 60 * 60 * 1000

/** What an entry's first line opens with; the version digit moves with the format. */
const ENTRY_HEADER_PREFIX = '/*! sovrium-tailwind-cache v1 '

/** The header line in full: body length in UTF-16 units, then its sha256. */
const ENTRY_HEADER_LINE = /^\/\*! sovrium-tailwind-cache v1 (\d+) ([a-f0-9]{64}) \*\/\n/

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

/** An env value with surrounding blanks removed, `undefined` when unset or blank. */
const nonEmpty = (env: CompileCacheEnv, name: string): string | undefined => {
  const value = env[name]?.trim()
  return value === undefined || value === '' ? undefined : value
}

/**
 * Whether the operator switched the cache off (`SOVRIUM_TAILWIND_CACHE=off`).
 * Off means every boot compiles, exactly as before the cache existed.
 */
export const isCompileCacheDisabled = (env: CompileCacheEnv = process.env): boolean =>
  env['SOVRIUM_TAILWIND_CACHE']?.trim().toLowerCase() === 'off'

/**
 * Where entries live: `SOVRIUM_TAILWIND_CACHE_DIR` when set, else the user's
 * cache directory — `$XDG_CACHE_HOME/sovrium/tailwind`, falling back to
 * `%LOCALAPPDATA%\sovrium\cache\tailwind` on Windows and
 * `~/.cache/sovrium/tailwind` elsewhere. Never a path relative to the engine's
 * own files, so the compiled binary (whose files live in a virtual file
 * system) resolves the same directory a source run does.
 */
export const resolveCompileCacheDir = (
  env: CompileCacheEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir()
): string => {
  const explicit = nonEmpty(env, 'SOVRIUM_TAILWIND_CACHE_DIR')
  if (explicit !== undefined) return explicit
  const xdg = nonEmpty(env, 'XDG_CACHE_HOME')
  if (xdg !== undefined) return join(xdg, 'sovrium', 'tailwind')
  const localAppData = platform === 'win32' ? nonEmpty(env, 'LOCALAPPDATA') : undefined
  if (localAppData !== undefined) return join(localAppData, 'sovrium', 'cache', 'tailwind')
  return join(home, '.cache', 'sovrium', 'tailwind')
}

/** The two halves of an entry's address, both plain file-name segments. */
export interface CompileCacheKey {
  /** Names the engine build: its version, then a digest of everything engine-side. */
  readonly engineDir: string
  /** Digest of everything the app contributes to the compile. */
  readonly inputsDigest: string
}

/**
 * The address of one compile.
 *
 * @param version - The engine version, kept readable in the directory name.
 * @param engineParts - Everything engine-side the bytes depend on: the source
 *   CSS fingerprint, the compile path (native-free or PostCSS), and the code
 *   fingerprint of the compiler itself.
 * @param compileInputs - The app's compile key (design, candidates, scope).
 */
export const compileCacheKeyOf = (
  version: string,
  engineParts: readonly string[],
  compileInputs: string
): CompileCacheKey => ({
  engineDir: `${version.replace(/[^A-Za-z0-9._-]/g, '_')}-${sha256(engineParts.join('\n')).slice(0, 16)}`,
  inputsDigest: sha256(compileInputs),
})

/** Absolute path of an entry under `dir`. */
export const compileCacheEntryPath = (dir: string, key: CompileCacheKey): string =>
  join(dir, key.engineDir, `${key.inputsDigest}.css`)

/** Serialise a stylesheet with its integrity header. */
export const encodeCompileCacheEntry = (css: string): string =>
  `${ENTRY_HEADER_PREFIX}${css.length} ${sha256(css)} */\n${css}`

/**
 * The stylesheet an entry holds, or `undefined` when the header is missing or
 * the body does not match the length and hash it records (a torn or edited
 * file).
 */
export const decodeCompileCacheEntry = (text: string): string | undefined => {
  const header = ENTRY_HEADER_LINE.exec(text)
  if (header === null) return undefined
  const css = text.slice(header[0].length)
  return css.length === Number(header[1]) && sha256(css) === header[2] ? css : undefined
}

const isMissingFile = (cause: unknown): boolean =>
  typeof cause === 'object' && cause !== null && (cause as { code?: unknown }).code === 'ENOENT'

/**
 * Read an entry. A missing file is a plain miss; an unreadable or corrupt one
 * is logged at debug and also answers `undefined`, so the caller recompiles
 * and overwrites it.
 */
export const readCompileCacheEntry = (path: string): Effect.Effect<string | undefined> =>
  Effect.tryPromise({
    // A missing file is the ordinary miss, not a failure worth a log line.
    try: () =>
      readFile(path, 'utf8').catch((cause: unknown) =>
        isMissingFile(cause) ? undefined : Promise.reject(cause)
      ),
    catch: (cause) => new TailwindCompileCacheError({ message: `Could not read ${path}`, cause }),
  }).pipe(
    Effect.map((text) => {
      if (text === undefined) return undefined
      const css = decodeCompileCacheEntry(text)
      if (css === undefined) logDebug('[CSS] compile cache entry failed its integrity check')
      return css
    }),
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logDebug(`[CSS] compile cache entry unreadable: ${String(cause)}`)
      })
    ),
    // effect-swallow: see the tap above. An entry that cannot be read is a
    // cache miss by definition; the caller compiles the stylesheet instead.
    Effect.orElseSucceed(() => undefined)
  )

/**
 * Remove sibling engine directories nobody has written to for
 * {@link STALE_ENGINE_DIR_MS}: what an upgrade leaves behind.
 */
const pruneStaleEngineDirs = (
  dir: string,
  keep: string,
  now: number
): Effect.Effect<void, TailwindCompileCacheError> =>
  Effect.tryPromise({
    try: async () => {
      const names = await readdir(dir)
      await Promise.all(
        names
          .filter((name) => name !== keep)
          .map(async (name) => {
            const info = await stat(join(dir, name))
            if (info.isDirectory() && now - info.mtimeMs > STALE_ENGINE_DIR_MS) {
              await rm(join(dir, name), { recursive: true, force: true })
            }
          })
      )
    },
    catch: (cause) => new TailwindCompileCacheError({ message: `Could not prune ${dir}`, cause }),
  })

/**
 * Write an entry atomically: a uniquely named temporary file in the same
 * directory, then a rename over the final name, so a concurrent reader sees
 * either the whole previous entry or the whole new one. A failure is logged
 * at debug and swallowed: the stylesheet is already compiled and served.
 */
export const writeCompileCacheEntry = (
  dir: string,
  key: CompileCacheKey,
  css: string,
  now: number = Date.now()
): Effect.Effect<void> => {
  const path = compileCacheEntryPath(dir, key)
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  return Effect.tryPromise({
    try: async () => {
      await mkdir(join(dir, key.engineDir), { recursive: true })
      try {
        await writeFile(tmp, encodeCompileCacheEntry(css), 'utf8')
        await rename(tmp, path)
      } catch (cause) {
        // Never leave a half-written temporary file behind.
        await rm(tmp, { force: true }).catch(() => undefined)
        throw cause
      }
    },
    catch: (cause) => new TailwindCompileCacheError({ message: `Could not write ${path}`, cause }),
  }).pipe(
    Effect.andThen(pruneStaleEngineDirs(dir, key.engineDir, now)),
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logDebug(`[CSS] compile cache write skipped: ${String(cause)}`)
      })
    ),
    // effect-swallow: see the tap above. The cache is an optimisation; a
    // read-only or full disk must not fail the request that compiled the CSS.
    Effect.ignore
  )
}

/** Where and whether the cache runs for one compile. */
export interface CompileCacheTarget {
  readonly dir: string
  readonly key: CompileCacheKey
}

/**
 * Serve `compute`'s stylesheet from the disk cache when an entry for `target`
 * exists and is intact; otherwise run `compute`, store its result, and serve
 * it. `target` undefined (the cache is off) runs `compute` alone.
 *
 * @param target - The cache directory and entry key, or `undefined` when off.
 * @param compute - The real compile.
 * @param isCacheable - Whether a computed result may be stored (a fallback
 *   stylesheet served after a failed compile must not outlive the failure).
 */
export const withCompileDiskCache = <E>(
  target: CompileCacheTarget | undefined,
  compute: Effect.Effect<CompiledCSS, E>,
  isCacheable: (compiled: CompiledCSS) => boolean
): Effect.Effect<CompiledCSS, E> =>
  Effect.gen(function* () {
    if (target === undefined) return yield* compute
    const prefix = `${target.key.engineDir}/${target.key.inputsDigest.slice(0, 12)}`
    const cached = yield* readCompileCacheEntry(compileCacheEntryPath(target.dir, target.key))
    if (cached !== undefined) {
      logDebug(`[CSS] compile cache hit ${prefix}`)
      return { css: cached, timestamp: Date.now(), reused: true }
    }
    logDebug(`[CSS] compile cache miss ${prefix}`)
    const compiled = yield* compute
    if (isCacheable(compiled)) yield* writeCompileCacheEntry(target.dir, target.key, compiled.css)
    return compiled
  })

/**
 * A cheap fingerprint of the files the compiler's bytes come from: each
 * path's size and modification time, `missing` for a path that cannot be
 * statted. The compiled binary passes its own executable; a source checkout
 * passes the CSS compiler's modules and the lockfile, so editing the compiler
 * or bumping Tailwind starts a fresh engine directory instead of serving
 * yesterday's output.
 *
 * @param paths - The files to fingerprint, in a stable order.
 */
export const fileStatsFingerprint = (paths: readonly string[]): string =>
  paths
    .map((path) => {
      try {
        const info = statSync(path)
        return `${path}:${info.size}:${info.mtimeMs}`
      } catch {
        return `${path}:missing`
      }
    })
    .join('\n')

/**
 * The compiler source files of a checkout rooted at `root`, sorted; empty when
 * the tree is not there (a bundled build ships no `src/`).
 *
 * @param root - The engine package root.
 */
export const compilerSourceFiles = (root: string): readonly string[] => {
  const dir = join(root, 'src', 'infrastructure', 'css')
  try {
    return [...new Bun.Glob('**/*.ts').scanSync({ cwd: dir, absolute: true })]
      .filter((path) => !path.endsWith('.test.ts'))
      .toSorted()
  } catch {
    return []
  }
}
