/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three verbs that change a record's EXISTENCE rather than its contents —
 * restore, soft-delete, and permanent delete.
 *
 * None of them writes a field, so none of them touches the authorship stamp,
 * the many-to-many split, or the attachment-URL enrichment the write programs
 * next door are mostly made of. What they share instead is the soft-delete
 * state machine: `deleted_at` is the only column any of them reads or moves,
 * and the interesting cases are all about that column already being in the
 * wrong state — a restore of a row that was never deleted, a delete that has to
 * report whether it nulled a reference or refused on one.
 *
 * {@link restoreRecordProgram} is the only one that echoes a record, so it is
 * the only one that filters fields; its siblings return a count or a boolean,
 * which is exactly why a read-permission leak could survive in it for as long
 * as it did. The single-record address refusal comes from
 * `read-record-programs.ts` — see its docstring for why every verb under
 * `/records/:recordId` raises it.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { NotFoundError, ValidationError } from '@/domain/errors'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { refuseWhenNoSingleIdAddress } from './read-record-programs'
import { transformRecord } from './record-transformer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { RestoreRecordResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

export function restoreRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params?: {
    readonly app?: App
    readonly userRole?: string
  }
): Effect.Effect<
  RestoreRecordResponse,
  DatabaseError | NotFoundError | ValidationError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    yield* refuseWhenNoSingleIdAddress(params?.app, tableName)
    const record = yield* repo.restoreRecord(session, tableName, recordId)
    // Special error marker for non-deleted records (vs. missing rows).
    if (record && '_error' in record && record._error === 'not_deleted')
      return yield* Effect.fail(new ValidationError('Record is not deleted'))
    if (!record) return yield* Effect.fail(new NotFoundError('Record not found'))

    // The restore echo is a record-bearing response and must strip fields the
    // caller may not read, exactly like the GET/PATCH/POST echoes. The only
    // gate on this route is `permissions.delete`, so without this a role that
    // may restore a row but may not read one of its columns got that column
    // back in the echo. `restoreRecordProgram` previously took no `app` and no
    // `userRole` and therefore structurally could not filter. Its batch sibling
    // returns a count and has no such shape, which is why the leak survived.
    const { app, userRole } = params ?? {}
    const readable =
      app && userRole ? filterReadableFields({ app, tableName, userRole, record }) : record

    return {
      success: true as const,
      record: transformRecord(readable, app ? { app, tableName } : undefined),
    }
  }).pipe(Effect.withSpan('tables.restore-record-program'))
}

/** Soft-delete a record. Wraps Infrastructure for layer architecture. */
export function deleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  app?: App
): Effect.Effect<
  { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
  DatabaseError | ValidationError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    yield* refuseWhenNoSingleIdAddress(app, tableName)
    return yield* repo.deleteRecord(session, tableName, recordId, app)
  }).pipe(Effect.withSpan('tables.delete-record-program'))
}

/** Permanently delete a record. Wraps Infrastructure for layer architecture. */
export function permanentlyDeleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, DatabaseError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.permanentlyDeleteRecord(session, tableName, recordId)
  }).pipe(Effect.withSpan('tables.permanently-delete-record-program'))
}
