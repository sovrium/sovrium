/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import path from 'node:path'
import { Cause, Data, Effect } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { StaticOutputWriter } from '@/application/ports/services/static-output-writer'
import { prebuildSearchIndex } from '@/application/use-cases/server/prebuild-search-index'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { searchIndexDir, searchIndexRoot } from '@/domain/models/process-env/data-dir'
import type { StartOptions, StartServerRequirements } from './start-server-options'
import type { App } from '@/domain/models/app'
import type { Logger } from '@/infrastructure/logging/logger'
import type { Context } from 'effect'

/**
 * The page-search artefacts a server boot prepares: the index directory under
 * the data dir, and the warning for a stale copy the public directory shadows.
 */

/** The page-search directory could not be prepared (mkdir, or a stale sibling removal). */
class SearchIndexDirError extends Data.TaggedError('SearchIndexDirError')<{
  readonly cause: unknown
}> {}

/** Whether a process id still names a running process. */
const isProcessAlive = (pid: number): boolean => {
  try {
    // Signal 0 checks existence without delivering anything. EPERM means the
    // process exists but belongs to another user — still alive.
    // eslint-disable-next-line functional/no-expression-statements -- existence probe, no effect
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Create this process's page-search directory under the data directory and
 * remove the ones left by processes that are no longer running, so a data
 * directory holds one index per live server rather than one per start.
 */
const prepareSearchIndexDir = (
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<string, SearchIndexDirError, StaticOutputWriter> =>
  Effect.gen(function* () {
    const fs = yield* StaticOutputWriter
    const root = searchIndexRoot(env)
    const own = searchIndexDir(env, process.pid)
    yield* fs.makeDirectory(own)
    const entries = yield* fs.readDirectory(root)
    // Only a directory named by a plain process id is ours to judge: a
    // `-1` or `0` would ask `kill` about a whole process group.
    const stale = entries.filter((name) => {
      const pid = Number(name)
      return /^[1-9]\d*$/.test(name) && pid !== process.pid && !isProcessAlive(pid)
    })
    // One removal at a time: a handful of dead-process directories, no pool involved.
    yield* Effect.forEach(stale, (name) => fs.remove(path.join(root, name)), {
      concurrency: 1,
      discard: true,
    })
    return own
  }).pipe(Effect.mapError(({ cause }) => new SearchIndexDirError({ cause })))

/**
 * Warn when the app's own `public/` folder ships a `sovrium-search/` directory.
 *
 * While a page declares a `search-input`, the engine owns `/sovrium-search/*`:
 * the index it builds is mounted before `public/`, so a folder of that name
 * there is never served — most often the stale copy an older version wrote
 * into it. The operator is told once, at start, so a file shipped
 * there on purpose does not vanish in silence.
 */
const warnOnShadowedPublicSearch = (
  publicDir: string | undefined,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<void, never, StaticOutputWriter> =>
  publicDir === undefined
    ? Effect.void
    : StaticOutputWriter.use((fs) => fs.exists(path.join(publicDir, 'sovrium-search'))).pipe(
        Effect.flatMap((shadowed) =>
          shadowed
            ? logger.warn(
                `${publicDir}/sovrium-search/ is not served: the page-search index owns /sovrium-search/*. Remove the folder, or move what it holds.`
              )
            : Effect.void
        )
      )

/**
 * Emit the page-search artifacts before the listener binds, so
 * `/sovrium-search/index.json` is servable from request one.
 *
 * They are written under the DATA directory (`searchIndexDir`), beside the
 * database — never into the app's `public/` folder, which an author commits
 * and `sovrium build` ships. The static-asset route mounts the same directory
 * for `/sovrium-search/*` only. An explicit opt-out of static assets
 * (`--no-publicDir`) still means no search, as it always did.
 *
 * A failure NEVER takes the boot down: the static-asset route then 404s the
 * search paths, which is the same observable behaviour as a config with no
 * page-scoped search at all. The operator gets a diagnostic line and a
 * server. Losing the whole deployment over an unbuildable search index would
 * be a far worse trade than losing search.
 */
export const prepareSearchArtifacts = (
  rawApp: unknown,
  validatedApp: App,
  options: StartOptions,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<void, never, StartServerRequirements> =>
  options.publicDirOptOut || !hasPageSearchComponent(validatedApp)
    ? Effect.void
    : Effect.gen(function* () {
        yield* warnOnShadowedPublicSearch(options.publicDir, logger)
        const dir = yield* prepareSearchIndexDir(yield* ProcessEnv)
        yield* prebuildSearchIndex(rawApp, validatedApp, dir)
      }).pipe(
        Effect.asVoid,
        Effect.catchCause((cause) => logger.warn(`Search index not built: ${Cause.pretty(cause)}`)),
        Effect.withSpan('server.prepare-search-artifacts')
      )
