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
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { GUEST_USER_ID } from '@/domain/models/app/auth/guest-session'
import { SIGNED_OUT_VISITOR_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import {
  callerTableGate,
  gateAdmitsRecord,
  type CallerReader,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { admitsRow } from '@/domain/models/app/tables/row-read-admission-service'
import { readerListsEveryRow, readerRowsOf, rowsReaderMayNotList } from '../row-read-admission'
import { loadCallerIdentity } from './caller-write-authority'
import { loadCurrentUserContext, rowRuleScopeOf } from './row-level-enforcement'
import type { LinkReader } from '../linked-row-visibility'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

type Requirements = AuthRepository | DataSourceRepository | TableRepository

/** A reader, and the context `table`'s rules judge her by (`loadCurrentUserContext`). */
export interface LoadedCallerReader {
  readonly reader: CallerReader
  readonly context: CurrentUserContext
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
      context: identity.ctx,
    }
  }).pipe(Effect.withSpan('tables.load-caller-reader'))

/** A visitor who is not signed in, as the records API's list reads her. */
const guestLinkReader = (): LinkReader => ({
  session: buildGuestSession(),
  role: SIGNED_OUT_VISITOR_ROLE,
  groups: [],
})

/**
 * Whether `reader`'s list of `tableName` admits `record` (`readerRowsOf`): on a
 * table where she reads only the rows a grant admits, a row no grant of hers
 * names is not one she may read, and a write naming it names a missing row.
 */
const listAdmits = (
  app: App,
  tableName: string,
  reader: LinkReader,
  record: Readonly<Record<string, unknown>>
): Effect.Effect<boolean, never, DataSourceRepository> =>
  Effect.map(
    rowsReaderMayNotList(app, tableName, reader, [String(record['id'])]),
    (unlisted) => unlisted.length === 0
  )

/**
 * Whether the caller `userId` names — `undefined` for someone not signed in —
 * may read `record` of `tableName`: the table's read grant over the roles that
 * count on it, then its row-level read rule. An app with no `auth` block is the
 * full-access model. A table that is not declared, and every lookup fault,
 * answer `false`, and so does a record her list of the table does not admit —
 * one no grant of hers names, on a table where she reads only granted rows.
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
      // Signed out: nothing about her resolves, but a rule naming no one is
      // still answered by its lookups, as the records API answers it.
      const guest = { userId: GUEST_USER_ID, role: GUEST_USER_ID, isUnrestricted: false }
      const scope = rowRuleScopeOf(table, app.tables)
      const context = yield* loadCurrentUserContext(guest, table.rowLevelPermissions, scope)
      return (
        gateAdmitsRecord(callerTableGate(app, tableName, undefined), record, context) &&
        (yield* listAdmits(app, tableName, guestLinkReader(), record))
      )
    }
    const judge = yield* callerRecordJudge(app, table, userId)
    return judge.admits(record)
  }).pipe(
    Effect.withSpan('tables.caller-reads-record', { attributes: { 'table.name': input.tableName } })
  )

/**
 * How the signed-in caller `userId` names reads `table`'s records — the
 * questions {@link callerReadsRecord} asks of one record, asked ONCE for the
 * table so a door judging many of its records loads her and her grants once:
 * `admits` is the table's read grant and row-level rule, then her list's row
 * admission; `listsAnyRow` is whether that list admits her a row at all. No
 * one to read as — an account gone, banned, or unreadable — admits nothing.
 */
export interface CallerRecordJudge {
  readonly admits: (record: Readonly<Record<string, unknown>>) => boolean
  readonly listsAnyRow: boolean
}

const ADMITS_NOTHING: CallerRecordJudge = { admits: () => false, listsAnyRow: false }

export const callerRecordJudge = (
  app: App,
  table: Table,
  userId: string
): Effect.Effect<CallerRecordJudge, never, Requirements> =>
  Effect.gen(function* () {
    if (!app.auth) return { admits: () => true, listsAnyRow: true }
    const loaded = yield* loadCallerReader(app, userId, table)
    if (loaded === undefined) return ADMITS_NOTHING
    const { reader, context } = loaded
    const gate = callerTableGate(app, table.name, reader)
    if (gate.kind === 'refused') return ADMITS_NOTHING
    const linkReader = {
      session: buildSyntheticSession(userId),
      role: reader.role,
      groups: reader.groups,
    }
    // A reader whose list admits every row lists every id, at no grant query.
    const { admission } = readerListsEveryRow(app, table.name, linkReader)
      ? { admission: { kind: 'every-row' } as const }
      : yield* readerRowsOf(app, table.name, linkReader)
    return {
      admits: (record) =>
        gateAdmitsRecord(gate, record, context) && admitsRow(admission, String(record['id'])),
      listsAnyRow: admission.kind !== 'no-row',
    }
  }).pipe(
    Effect.withSpan('tables.caller-record-judge', { attributes: { 'table.name': table.name } })
  )

/**
 * Whether the signed-in caller `userId` names may list `tableName` at all: the
 * app declares the table, its read grant lets her in over the roles that count
 * on it, and her list of it admits her at least one row (`readerRowsOf`). A
 * table the app does not declare answers `false` before anything is read, so
 * an undeclared name never reaches the database; every lookup fault answers
 * `false` too.
 */
export const callerListsTable = (input: {
  readonly app: App
  readonly tableName: string
  readonly userId: string
}): Effect.Effect<boolean, never, Requirements> =>
  Effect.gen(function* () {
    const { app, tableName, userId } = input
    const table = app.tables?.find((t) => t.name === tableName)
    if (table === undefined) return false
    const judge = yield* callerRecordJudge(app, table, userId)
    return judge.listsAnyRow
  }).pipe(
    Effect.withSpan('tables.caller-lists-table', { attributes: { 'table.name': input.tableName } })
  )
