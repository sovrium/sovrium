/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import {
  CrossDialectCopyFailure,
  SchemaBuildFailure,
  type SchemaBuildRequest,
} from '@/application/ports/services/backup-workspace'
import { copySqliteIntoPostgres } from '@/infrastructure/database/sqlite-to-postgres-copy'
import { SqliteToPostgresCopyError } from '@/infrastructure/database/sqlite-to-postgres-copy-statements'
import { startMigrateChild, stopMigrateChild } from '@/infrastructure/process/migrate-child'

/**
 * The two long-running steps of a SQLite-to-PostgreSQL restore, as the backup
 * port runs them: each schema build in a child process, and the row copy.
 * Both settle before an interruption completes — the child is stopped and
 * awaited, the copy aborted and rolled back — so nothing either holds on the
 * database outlives the restore that started it.
 */

/**
 * Run `sovrium migrate` against one database in a child process; its output on
 * failure. Interrupting the build stops the child and waits for it to exit.
 */
export const buildSchemaInChild = (request: SchemaBuildRequest) =>
  Effect.acquireUseRelease(
    // Starting can throw — the child's directories cannot be created, or the
    // program cannot be spawned — and that is a build that did not happen.
    Effect.try({
      try: () =>
        startMigrateChild({
          databaseUrl: request.databaseUrl,
          configPath: request.configPath,
          dataDirectory: join(request.scratchDirectory, `${request.dialect}-data`),
          workingDirectory: dirname(request.configPath),
        }),
      catch: (cause) =>
        new SchemaBuildFailure({
          dialect: request.dialect,
          output: cause instanceof Error ? cause.message : String(cause),
        }),
    }),
    (child) =>
      Effect.tryPromise({
        try: () => child.outcome,
        catch: (cause) =>
          new SchemaBuildFailure({
            dialect: request.dialect,
            output: cause instanceof Error ? cause.message : String(cause),
          }),
      }).pipe(
        Effect.flatMap((outcome) =>
          outcome.ok
            ? Effect.void
            : Effect.fail(
                new SchemaBuildFailure({ dialect: request.dialect, output: outcome.output })
              )
        )
      ),
    // effect-promise: total -- stopMigrateChild only kills and awaits `exited`, which never rejects
    (child) => Effect.promise(() => stopMigrateChild(child))
  )

const asCopyFailure = (cause: unknown): CrossDialectCopyFailure =>
  cause instanceof SqliteToPostgresCopyError
    ? new CrossDialectCopyFailure({
        table: cause.table,
        column: cause.column,
        rowId: cause.rowId,
        problem: cause.problem,
      })
    : new CrossDialectCopyFailure({
        table: 'the database',
        column: undefined,
        rowId: undefined,
        problem: cause instanceof Error ? cause.message : String(cause),
      })

/**
 * Copy the rows, naming the table, column and row a failure stopped at.
 * Interrupting the copy aborts it between batches and waits until its
 * transaction has rolled back, so nothing it holds outlives it.
 */
export const copyRows = (
  sqlitePath: string,
  databaseUrl: string,
  uploads: ReadonlyMap<string, Uint8Array> | undefined
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const controller = new AbortController()
      const copy = copySqliteIntoPostgres(sqlitePath, databaseUrl, uploads, controller.signal)
      // Observed here so an abandoned copy never surfaces as an unhandled rejection.
      copy.catch(() => undefined)
      return { controller, copy }
    }),
    ({ copy }) =>
      Effect.tryPromise({ try: () => copy, catch: asCopyFailure }).pipe(
        Effect.map((tables) => tables.reduce((total, table) => total + table.rows, 0))
      ),
    ({ controller, copy }) =>
      // effect-promise: total -- both branches of the settled copy resolve to undefined
      Effect.promise(() => {
        controller.abort()
        return copy.then(
          () => undefined,
          () => undefined
        )
      })
  )
