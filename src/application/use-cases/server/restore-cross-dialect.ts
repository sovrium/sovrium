/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join, relative, isAbsolute } from 'node:path'
import { Console, Effect } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'
import { PROJECT_PREFIX, SQLITE_ENTRY, type BackupManifest } from './backup-manifest'
import { restoreRefusal } from './restore-refusal'
import type {
  CrossDialectCopyFailure,
  SchemaBuildFailure,
} from '@/application/ports/services/backup-workspace'

// Local on purpose: an exported Effect-returning helper must open a span (Effect Span Census).
const refuse = (reason: string, guidance: string, detail?: readonly string[]) =>
  Effect.fail(restoreRefusal(reason, guidance, detail))

/**
 * Restoring a SQLite backup into an empty PostgreSQL database.
 *
 * The rows cannot be replayed — there is no dump, and the two dialects store
 * the same schema differently — so the restore rebuilds the schema and copies:
 *
 * 1. The database `DATABASE_URL` names must be empty ({@link checkPostgresTargetIsEmpty}).
 *    `--force` never relaxes this: it is about files.
 * 2. The backup's SQLite copy and its config tree are extracted to a private
 *    (`0700`) scratch directory, removed in every outcome: it holds every row
 *    in clear.
 * 3. The SQLite copy is brought forward with this engine's SQLite migrations
 *    and the config's tables, so an archive taken by an older engine copies
 *    between two identical schemas.
 * 4. The PostgreSQL schema is built the way `sovrium migrate` builds it.
 * 5. The rows are copied in one transaction — and, when the restored server
 *    will keep its uploads in the database, the archive's uploads with them.
 *
 * Steps 3 and 4 run as child processes (the database layer is process-wide and
 * dialect-locked); every step's failure after the PostgreSQL build started
 * empties the database again, so the operator can fix the cause and retry.
 * Nothing is written to the project or data directory before this returns.
 */

const CREATE_EMPTY_DATABASE =
  "Create a new, empty database, point DATABASE_URL at it, and run 'sovrium restore' again."

/** Config files that are code: importing one runs it. */
const CODE_CONFIG = /\.(ts|mts|js|mjs)$/

/**
 * Refuse a backup whose config is code. Building the schema imports the config,
 * and an archive can come from anywhere: no code from it runs during a restore.
 * A same-dialect restore never builds a schema, so it is not concerned.
 */
export const refuseCodeConfig = Effect.fn('server.restore-refuse-code-config')(function* (
  manifest: Readonly<BackupManifest>
) {
  if (!CODE_CONFIG.test(manifest.app.config)) return undefined
  return yield* refuse(
    `The backup's config ${manifest.app.config} is code, and a SQLite backup is restored into PostgreSQL only from a YAML or JSON config`,
    'Restore it into SQLite first (unset DATABASE_URL; that runs no code), review the config and write it as YAML or JSON, take a new backup, and restore that one.'
  )
})

/** The refusal headline for a PostgreSQL database that holds relations, tables first. */
export const notEmptyReason = (relations: readonly string[]): string => {
  const count = relations.length
  return `DATABASE_URL names a PostgreSQL database that is not empty (it holds ${count} ${count === 1 ? 'table' : 'tables'}, among them ${relations[0] ?? ''})`
}

/** The refusal for a PostgreSQL database that cannot be reached. */
export const UNREACHABLE_POSTGRES = {
  reason: 'Sovrium could not connect to the PostgreSQL database DATABASE_URL names',
  guidance:
    "Check DATABASE_URL and that the database server accepts connections, then run 'sovrium restore' again.",
} as const

/**
 * Refuse unless the PostgreSQL database is reachable and empty. Read-only, and
 * after the five refusals every restore runs. Resolves with the engine schemas
 * that already exist, so a cleanup keeps them.
 */
export const checkPostgresTargetIsEmpty = Effect.fn('server.restore-check-postgres-target')(
  function* (databaseUrl: string) {
    const workspace = yield* BackupWorkspace
    const state = yield* workspace.inspectPostgresTarget(databaseUrl)
    if (!state.reachable) {
      return yield* refuse(UNREACHABLE_POSTGRES.reason, UNREACHABLE_POSTGRES.guidance)
    }
    if (state.relations.length === 0) {
      return {
        preExistingSchemas: state.preExistingSchemas,
        preExistingRoutines: state.preExistingRoutines,
      }
    }
    return yield* refuse(
      notEmptyReason(state.relations),
      `${CREATE_EMPTY_DATABASE} A SQLite backup restores only into an empty PostgreSQL database; --force does not change that.`
    )
  }
)

/** Where an archive entry lands inside the scratch directory, or `undefined` if it would escape it. */
const scratchPathOf = (scratch: string, entry: string): string | undefined => {
  const target = join(scratch, entry)
  const within = relative(scratch, target)
  return within.startsWith('..') || isAbsolute(within) ? undefined : target
}

/** The output of a failed child step, as detail lines worth showing. */
const outputLines = (output: string): readonly string[] =>
  output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-20)

/** The headline clause for a copy that stopped, naming the table, row and column. */
const copyStoppedReason = (failure: Readonly<CrossDialectCopyFailure>): string =>
  [
    `The copy into PostgreSQL stopped at the table ${failure.table}`,
    failure.rowId === undefined ? '' : `, row ${failure.rowId}`,
    failure.column === undefined ? '' : `, column ${failure.column}`,
    `: ${failure.problem}`,
  ].join('')

/**
 * What a cleanup needs: the database, and what it already held before the
 * restore — the engine schemas and the routines — so only the restore's own
 * objects are removed.
 */
export interface PostgresTarget {
  readonly databaseUrl: string
  readonly preExistingSchemas: readonly string[]
  readonly preExistingRoutines: readonly string[]
}

const RECREATE =
  "The PostgreSQL database could not be emptied again: drop and recreate it before running 'sovrium restore' again."

/** Empty the database again; `false` when it could not be, the cause logged. */
const emptyAgain = (target: Readonly<PostgresTarget>) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    return yield* workspace
      .dropCreatedObjects(target.databaseUrl, target.preExistingSchemas, target.preExistingRoutines)
      .pipe(
        Effect.as(true),
        Effect.tapCause((cause) =>
          Effect.logWarning('restore: the PostgreSQL database could not be emptied again', cause)
        ),
        // Swallowed on purpose: the operator is told to recreate the database instead.
        Effect.orElseSucceed(() => false)
      )
  })

/**
 * The cleanup an interrupted restore runs: empty the database again, and say
 * so when it could not be, since the interruption message cannot.
 */
export const emptyAgainOnInterrupt = (target: Readonly<PostgresTarget>) =>
  emptyAgain(target).pipe(
    Effect.flatMap((emptied) => (emptied ? Effect.void : Console.error(`Warning: ${RECREATE}`))),
    Effect.withSpan('server.restore-empty-postgres-on-interrupt')
  )

/**
 * Empty the PostgreSQL database after a failed build, copy or file write, then
 * refuse with `reason`. When it cannot be emptied, the guidance says to
 * recreate it.
 */
export const emptyAgainThenRefuse = Effect.fn('server.restore-empty-postgres-again')(function* (
  target: Readonly<PostgresTarget>,
  reason: string,
  fix: string,
  detail?: readonly string[]
) {
  const emptied = yield* emptyAgain(target)
  return yield* refuse(
    reason,
    emptied ? `The PostgreSQL database is empty again. ${fix}` : `${RECREATE} ${fix}`,
    detail
  )
})

/** Extract the config tree and the SQLite database into the scratch directory. */
const extractToScratch = (
  scratch: string,
  manifest: BackupManifest,
  entries: ReadonlyMap<string, Uint8Array>
) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const wanted = manifest.files.filter(
      (file) => file.path === SQLITE_ENTRY || file.path.startsWith(PROJECT_PREFIX)
    )
    const escaping = wanted.find((file) => scratchPathOf(scratch, file.path) === undefined)
    const configPath = scratchPathOf(scratch, manifest.app.config)
    if (escaping !== undefined || configPath === undefined) {
      return yield* refuse(
        `The entry ${escaping?.path ?? manifest.app.config} points outside the backup, so the archive is damaged`,
        'Restore from another copy of the backup.'
      )
    }
    yield* Effect.forEach(wanted, (file) =>
      workspace.writeFile(join(scratch, file.path), entries.get(file.path) ?? new Uint8Array())
    )
    return { configPath, sqlitePath: join(scratch, SQLITE_ENTRY) }
  })

/** Everything one cross-dialect restore works from. */
interface CrossDialectInput {
  readonly target: PostgresTarget
  readonly manifest: BackupManifest
  readonly entries: ReadonlyMap<string, Uint8Array>
  readonly uploads: ReadonlyMap<string, Uint8Array> | undefined
}

/** Steps 3 to 5, inside an existing scratch directory. */
const buildAndCopy = (
  scratch: string,
  { target, manifest, entries, uploads }: Readonly<CrossDialectInput>
) =>
  Effect.gen(function* () {
    const { databaseUrl } = target
    const workspace = yield* BackupWorkspace
    const { configPath, sqlitePath } = yield* extractToScratch(scratch, manifest, entries)

    yield* workspace
      .buildSchema({
        dialect: 'sqlite',
        databaseUrl: `file:${sqlitePath}`,
        configPath,
        scratchDirectory: scratch,
      })
      .pipe(
        Effect.catchTag('SchemaBuildFailure', (failure: Readonly<SchemaBuildFailure>) =>
          refuse(
            "The backup's SQLite database could not be brought forward to this engine's schema",
            'Resolve what the migration reported above, then run the command again.',
            outputLines(failure.output)
          )
        )
      )

    // From here on the PostgreSQL database holds what this restore created: an
    // interruption empties it again before the scratch directory goes.
    return yield* Effect.gen(function* () {
      yield* workspace
        .buildSchema({ dialect: 'postgres', databaseUrl, configPath, scratchDirectory: scratch })
        .pipe(
          Effect.catchTag('SchemaBuildFailure', (failure: Readonly<SchemaBuildFailure>) =>
            emptyAgainThenRefuse(
              target,
              'The PostgreSQL schema could not be built',
              "Resolve what the migration reported above, then run 'sovrium restore' again.",
              outputLines(failure.output)
            )
          )
        )

      return yield* workspace
        .copySqliteToPostgres(sqlitePath, databaseUrl, uploads)
        .pipe(
          Effect.catchTag('CrossDialectCopyFailure', (failure: Readonly<CrossDialectCopyFailure>) =>
            emptyAgainThenRefuse(
              target,
              copyStoppedReason(failure),
              "Correct that value in the install the backup came from, take a new backup, and run 'sovrium restore' again."
            )
          )
        )
    }).pipe(Effect.onInterrupt(() => emptyAgainOnInterrupt(target)))
  })

/**
 * Put the rows of a SQLite backup into the empty PostgreSQL database at
 * `databaseUrl`. `uploads` (storage key → bytes) is given when the restored
 * server keeps its files in the database: they are loaded in the same
 * transaction. Resolves with the number of rows copied, having written
 * nothing outside a scratch directory it removes; fails with nothing kept.
 */
export const restoreSqliteIntoPostgres = Effect.fn('server.restore-sqlite-into-postgres')(
  function* (
    target: Readonly<PostgresTarget>,
    manifest: Readonly<BackupManifest>,
    entries: ReadonlyMap<string, Uint8Array>,
    uploads: ReadonlyMap<string, Uint8Array> | undefined
  ) {
    const workspace = yield* BackupWorkspace
    return yield* Effect.acquireUseRelease(
      workspace.createPrivateDirectory,
      (scratch) => buildAndCopy(scratch, { target, manifest, entries, uploads }),
      (scratch) =>
        workspace.removePath(scratch).pipe(
          Effect.tapCause((cause) =>
            Effect.logWarning('restore: the temporary directory could not be removed', cause)
          ),
          // Swallowed on purpose: the restore's outcome stands; the warning names the leftover.
          Effect.ignore
        )
    )
  }
)
