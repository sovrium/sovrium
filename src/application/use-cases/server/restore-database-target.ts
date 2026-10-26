/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'
import { SQLITE_ENTRY, type BackupManifest } from './backup-manifest'
import {
  checkPostgresTargetIsEmpty,
  notEmptyReason,
  refuseCodeConfig,
  UNREACHABLE_POSTGRES,
  type PostgresTarget,
} from './restore-cross-dialect'
import { restoreRefusal } from './restore-refusal'

// Local on purpose: an exported Effect-returning helper must open a span (Effect Span Census).
const refuse = (reason: string, guidance: string) => Effect.fail(restoreRefusal(reason, guidance))

/** What the database check reads of a restore request. */
interface DatabaseRequest {
  /** `DATABASE_URL` when it names a PostgreSQL database. */
  readonly postgresUrl: string | undefined
  readonly force: boolean
}

/**
 * A PostgreSQL dump goes into an empty database, or — with `--force` — over
 * the app's objects in a populated one. Read-only; resolves with whether the
 * replay must replace what the database holds.
 */
const checkPostgresTargetIsReplaceable = (databaseUrl: string, force: boolean) =>
  Effect.gen(function* () {
    const workspace = yield* BackupWorkspace
    const state = yield* workspace.inspectPostgresTarget(databaseUrl)
    if (!state.reachable) {
      return yield* refuse(UNREACHABLE_POSTGRES.reason, UNREACHABLE_POSTGRES.guidance)
    }
    if (state.relations.length === 0) return false
    if (force) return true
    return yield* refuse(
      notEmptyReason(state.relations),
      "Pass --force to replace the app's data in it (the app's schemas and tables are dropped and the dump replayed, in one transaction), or point DATABASE_URL at an empty database."
    )
  })

/** Where the archive's database goes: across dialects, and whether a PostgreSQL replay replaces. */
interface DatabaseTarget {
  /** The PostgreSQL target of a cross-dialect restore, with what it already held. */
  readonly crossDialect: PostgresTarget | undefined
  /** A PostgreSQL dump replayed over the app's objects, dropped in the same transaction. */
  readonly replacePostgres: boolean
}

const SAME_DIALECT: DatabaseTarget = { crossDialect: undefined, replacePostgres: false }

/**
 * The database the archive holds must have somewhere to go on this machine:
 * a SQLite file, an empty PostgreSQL database, or — with `--force` — a
 * PostgreSQL database a dump replaces.
 */
export const checkDatabaseTarget = Effect.fn('server.restore-check-database-target')(function* (
  request: DatabaseRequest,
  manifest: Readonly<BackupManifest>
) {
  const workspace = yield* BackupWorkspace
  if (manifest.database.path === SQLITE_ENTRY) {
    if (request.postgresUrl === undefined) return SAME_DIALECT
    yield* refuseCodeConfig(manifest)
    const preExisting = yield* checkPostgresTargetIsEmpty(request.postgresUrl)
    const crossDialect = { databaseUrl: request.postgresUrl, ...preExisting }
    return { crossDialect, replacePostgres: false } satisfies DatabaseTarget
  }
  if (request.postgresUrl === undefined) {
    return yield* refuse(
      'The backup holds a PostgreSQL dump and DATABASE_URL names no PostgreSQL database',
      'Set DATABASE_URL to the PostgreSQL database to restore into.'
    )
  }
  if (!(yield* workspace.hasExecutable('psql'))) {
    return yield* refuse(
      'The PostgreSQL client tool psql is not on PATH, so the dump cannot be replayed',
      "Install the PostgreSQL client tools (pg_dump and psql), then run 'sovrium restore' again."
    )
  }
  const populated = yield* checkPostgresTargetIsReplaceable(request.postgresUrl, request.force)
  return { crossDialect: undefined, replacePostgres: populated } satisfies DatabaseTarget
})
