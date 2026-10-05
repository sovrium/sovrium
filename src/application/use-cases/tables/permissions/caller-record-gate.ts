/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The caller-record gate, for a use-case that knows the caller only by her id.
 *
 * The decision is the domain's ({@link callerTableGate}); what a use-case owes
 * it is the reader — the WHOLE of her, as the records API and the page that
 * drew the record know her: her role as the account holds it, her email, her
 * groups, the roles her assignments give her, whether her role is the app's
 * top one, and her assignments. {@link loadCallerReader} gathers it once, from
 * `loadCallerIdentity` (the gathering the automations and AI chat already
 * answer to), so no door judges her on an id and a role alone.
 *
 * Every lookup fails closed: an account that is gone or banned has no reader, a
 * role that cannot be read refuses, and assignments that cannot be read count
 * as none — the rule then admits nothing it would have scoped to them. A fault
 * therefore answers as a record she may not read, never as an error.
 *
 * It DECLARES its requirements (standing rule E1).
 */

import { Effect } from 'effect'
import {
  callerTableGate,
  gateAdmitsRecord,
  type CallerReader,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { loadCallerIdentity } from './caller-write-authority'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'

type Requirements = AuthRepository | DataSourceRepository | TableRepository

/** A reader, and the record ids her assignments name per scope table `table`'s rules read. */
export interface LoadedCallerReader {
  readonly reader: CallerReader
  readonly assignments: ReadonlyMap<string, readonly string[]>
}

/**
 * The reader `userId` names, gathered for `table` — or `undefined` when there
 * is no one to read as (the account is gone, banned, or its role unreadable).
 */
export const loadCallerReader = (
  app: App,
  userId: string,
  table: Table
): Effect.Effect<LoadedCallerReader | undefined, never, Requirements> =>
  Effect.gen(function* () {
    const identity = yield* loadCallerIdentity(app, userId, table)
    if (identity === undefined) return undefined
    return {
      reader: {
        userId,
        role: identity.role,
        email: identity.ctx.email,
        groups: identity.groups,
        accessRoles: identity.accessRoles,
        isUnrestricted: identity.ctx.isUnrestricted,
      },
      assignments: identity.ctx.assignments,
    }
  }).pipe(Effect.withSpan('tables.load-caller-reader'))

/**
 * Whether the caller `userId` names — `undefined` for someone not signed in —
 * may read `record` of `tableName`: the table's read grant over the roles that
 * count on it, then its row-level read rule. An app with no `auth` block is the
 * full-access model. A table that is not declared, and every lookup fault,
 * answer `false`.
 */
export const callerReadsRecord = (input: {
  readonly app: App
  readonly tableName: string
  readonly userId: string | undefined
  readonly record: Readonly<Record<string, unknown>>
}): Effect.Effect<boolean, never, Requirements> =>
  Effect.gen(function* () {
    const { app, tableName, userId, record } = input
    if (!app.auth) return true
    const table = app.tables?.find((t) => t.name === tableName)
    if (table === undefined) return false
    if (userId === undefined) {
      return gateAdmitsRecord(callerTableGate(app, tableName, undefined), record, new Map())
    }
    const loaded = yield* loadCallerReader(app, userId, table)
    if (loaded === undefined) return false
    return gateAdmitsRecord(
      callerTableGate(app, tableName, loaded.reader),
      record,
      loaded.assignments
    )
  }).pipe(
    Effect.withSpan('tables.caller-reads-record', { attributes: { 'table.name': input.tableName } })
  )
