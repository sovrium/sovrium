/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A hidden link or account accepts only what the server would have put in it.
 *
 * A form field hidden in the form's own declaration and bound to a
 * `relationship` or `user` column is filled by the server — from the form's
 * own starting value, or from a page that embeds the form with an
 * `inlinePrefill` — and posted back like any other input. The submission
 * re-derives, for this submitter and at this moment, every value the server
 * could have rendered there, and refuses anything else with the answer a row
 * or an account that does not exist gets, before anything is written.
 *
 * The accepted values of one pinned field are the union of:
 *
 *  - the form's own starting value — a literal is itself, `$user.<prop>` the
 *    submitter's own (nothing when nobody is signed in);
 *  - each page embedding the form with an `inlinePrefill` naming the field, when
 *    the page's `access` admits the submitter: a literal or `$user.<prop>` as
 *    above; `$parent.<col>` / `$record.<col>` any value that column holds on a
 *    record the page would read FOR THIS SUBMITTER — the table's read grant with
 *    their groups and `user_access` roles, its row-level read rule, live rows
 *    only, and the column readable by them;
 *  - an empty value, which files the record under nothing.
 *
 * Which fields are pinned, and from which sources, is read off the
 * configuration (`pinnedFieldsOf`, `formEmbeddingPrefills`); a field whose form-level starting value
 * reads the query string is not pinned. A key a literal or `$user` source
 * accounts for costs no read; any other key costs one existence query per
 * record source — `column = key` under the submitter's read clause, at most one
 * row back — so the cost follows the submission, never the size of the table.
 * The check stops at the first key no source holds, and reads nothing at all
 * when the submission leaves the pinned fields empty.
 */

import { Effect, Option } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { callerReadScope } from '@/application/use-cases/tables/permissions/caller-read-authority'
import { loadCallerIdentity } from '@/application/use-cases/tables/permissions/caller-write-authority'
import {
  classifyPinSource,
  pinnedFieldsOf,
  type PinSource,
} from '@/domain/models/app/forms/hidden-link-pin-service'
import { formEmbeddingPrefills } from '@/domain/models/app/pages/form-embedding-service'
import { checkPageAccess } from '@/domain/models/app/pages/page-access-check'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
} from '@/domain/models/app/tables/read-access-plan-service'
import { submittedKeysOf } from './submit-form-offered-links'
import type { FormOptionVisitor } from './resolve-form-option-sources'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Form } from '@/domain/models/app/forms'
import type { Page } from '@/domain/models/app/pages'

type Requirements = AuthRepository | DataSourceRepository | TableRepository

/** One pinned field, with every source that could have filled it. */
interface HiddenPin {
  readonly column: string
  /** The form's own starting value. */
  readonly formSource: PinSource
  /** Each page that embeds the form with an `inlinePrefill` naming the field. */
  readonly embeddings: readonly { readonly page: Page; readonly source: PinSource }[]
}

/** The pinned fields of `form`, each joined to the pages that fill it. */
const hiddenPinsOf = (app: App, form: Form): readonly HiddenPin[] => {
  const fields = pinnedFieldsOf(app, form)
  if (fields.length === 0) return []
  const pagePrefills = (app.pages ?? []).map((page) => ({
    page,
    prefills: formEmbeddingPrefills(app, page, form.name),
  }))
  return fields.map(({ column, formSource }) => ({
    column,
    formSource,
    embeddings: pagePrefills.flatMap(({ page, prefills }) =>
      prefills
        .filter((prefill) => column in prefill)
        .map((prefill) => ({ page, source: classifyPinSource(prefill[column]) }))
    ),
  }))
}

/** Who is submitting: their visitor facts, and — when signed in — their access session. */
interface Submitter {
  readonly visitor: FormOptionVisitor | undefined
  readonly userId: string | undefined
  /** The session a page's `access` is judged against; absent for anyone not signed in. */
  readonly session: SessionInfo | undefined
}

/** The values a literal or `$user` source holds for this submitter; a record source is read separately. */
const directValues = (source: PinSource, submitter: Submitter): readonly string[] => {
  if (source.kind === 'literal') return source.values
  if (source.kind !== 'user') return []
  const value = submitter.visitor?.[source.prop]
  return typeof value === 'string' || typeof value === 'number' ? [String(value)] : []
}

/** The table a page reads ONE record from, when it does. */
const singleRecordTableOf = (page: Page): string | undefined => {
  const { dataSource } = page as {
    readonly dataSource?: { readonly table?: unknown; readonly mode?: unknown }
  }
  return dataSource?.mode === 'single' && typeof dataSource.table === 'string'
    ? dataSource.table
    : undefined
}

/**
 * The read gate a page applies to `tableName` for this submitter, as a filter
 * clause and a column test — or `undefined` when it reads them nothing. A
 * signed-in submitter meets the records API's gates (`callerReadScope`); anyone
 * else reads only a table open to everyone, with no row-level rule.
 */
const pageReadGate = (
  app: App,
  tableName: string,
  submitter: Submitter
): Effect.Effect<
  | { readonly clause: QueryFilterNode | undefined; readonly readsColumn: (c: string) => boolean }
  | undefined,
  never,
  Requirements
> =>
  Effect.gen(function* () {
    if (submitter.userId !== undefined) {
      const scope = yield* callerReadScope(app, buildSyntheticSession(submitter.userId), tableName)
      if (scope === undefined || scope.clause === 'nothing') return undefined
      return { clause: scope.clause, readsColumn: scope.readsColumn }
    }
    const plan = buildReadAccessPlan({
      app,
      table: app.tables?.find((table) => table.name === tableName),
      principal: readPrincipalFromSession(undefined),
      policy: CANONICAL_READ_POLICY,
    })
    if (!plan.allowed || plan.rowPredicate !== 'none') return undefined
    return { clause: undefined, readsColumn: (column) => !plan.restrictedColumns.has(column) }
  })

/** Whether `page`'s `access` admits the submitter. */
const pageAdmits = (app: App, page: Page, submitter: Submitter): boolean =>
  checkPageAccess(page.access, app, submitter.session).allowed

/** The distinct `(table, column)` records the admitting embeddings of `pin` read from. */
const recordReads = (
  app: App,
  pin: HiddenPin,
  submitter: Submitter
): readonly { readonly tableName: string; readonly column: string }[] => {
  const pairs = pin.embeddings.flatMap(({ page, source }) => {
    if (source.kind !== 'record' || !pageAdmits(app, page, submitter)) return []
    const tableName = singleRecordTableOf(page)
    return tableName === undefined ? [] : [{ tableName, column: source.column }]
  })
  return [...new Map(pairs.map((pair) => [`${pair.tableName}\u0000${pair.column}`, pair])).values()]
}

/** One record source of a pinned field that this submitter may read: a column of a table, under their read clause. */
interface RecordRead {
  readonly tableName: string
  readonly column: string
  readonly clause: QueryFilterNode | undefined
}

/** The record sources of `pin` whose table and column this submitter may read. */
const readableRecordReads = (
  app: App,
  pin: HiddenPin,
  submitter: Submitter
): Effect.Effect<readonly RecordRead[], never, Requirements> =>
  Effect.forEach(recordReads(app, pin, submitter), ({ tableName, column }) =>
    pageReadGate(app, tableName, submitter).pipe(
      Effect.map((gate): readonly RecordRead[] =>
        gate === undefined || (column !== 'id' && !gate.readsColumn(column))
          ? []
          : [{ tableName, column, clause: gate.clause }]
      )
    )
  ).pipe(Effect.map((reads) => reads.flat()))

/**
 * Whether a live record behind `read` holds `key` in its column — one existence
 * query, `column = key` under the submitter's read clause, at most one row back.
 */
const recordHolds = (
  app: App,
  read: RecordRead,
  key: string
): Effect.Effect<boolean, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const primaryKey = app.tables?.find((table) => table.name === read.tableName)?.primaryKey
    const rows = yield* (yield* TableRepository).listRecords({
      session: buildGuestSession(),
      tableName: read.tableName,
      app,
      filter: {
        and: [
          { field: read.column, operator: 'in', value: [key] },
          ...(read.clause === undefined ? [] : [read.clause]),
        ],
      },
      columns: [read.column],
      limit: 1,
      ...(primaryKey === undefined ? {} : { primaryKey }),
    })
    return rows.some((row) => submittedKeysOf(row[read.column]).includes(key))
  })

/**
 * Whether every key submitted for `pin` is one the server could have rendered
 * there for this submitter. Stops at the first key no source holds.
 */
const holdsOnlyRenderedValues = (input: {
  readonly app: App
  readonly pin: HiddenPin
  readonly keys: readonly string[]
  readonly submitter: Submitter
}): Effect.Effect<boolean, DatabaseError, Requirements> =>
  Effect.gen(function* () {
    const { app, pin, keys, submitter } = input
    const direct = new Set([
      ...directValues(pin.formSource, submitter),
      ...pin.embeddings
        .filter(({ page }) => pageAdmits(app, page, submitter))
        .flatMap(({ source }) => directValues(source, submitter)),
    ])
    const pending = [...new Set(keys)].filter((key) => !direct.has(key))
    if (pending.length === 0) return true
    const reads = yield* readableRecordReads(app, pin, submitter)
    if (reads.length === 0) return false
    const unheld = yield* Effect.findFirst(pending, (key) =>
      Effect.findFirst(reads, (read) => recordHolds(app, read, key)).pipe(Effect.map(Option.isNone))
    )
    return Option.isNone(unheld)
  })

/**
 * The submitter as a page's `access` sees them — role, groups, `user_access`
 * roles — or `undefined` for anyone not signed in or no longer standing.
 */
const loadSubmitterSession = (
  app: App,
  userId: string | undefined,
  table: Table
): Effect.Effect<SessionInfo | undefined, never, Requirements> =>
  Effect.gen(function* () {
    if (userId === undefined) return undefined
    const identity = yield* loadCallerIdentity(app, userId, table)
    if (identity === undefined) return undefined
    return {
      userId,
      role: identity.role,
      groups: identity.groups,
      effectiveRoles: identity.effectiveRoles,
      isUnrestricted: identity.ctx.isUnrestricted,
    }
  })

/**
 * The first pinned field whose submitted value is not one the server would
 * have rendered into it for this submitter, or `undefined` when every pinned
 * field holds such a value (or nothing). Reads nothing for a form with no
 * pinned field, or a submission that leaves them empty.
 */
export const findUnpinnedHiddenField = (input: {
  readonly app: App
  readonly form: Form
  readonly mapped: Readonly<Record<string, unknown>>
  readonly visitor: FormOptionVisitor | undefined
  readonly submitterUserId: string | undefined
}): Effect.Effect<string | undefined, DatabaseError, Requirements> =>
  Effect.gen(function* () {
    const { app, form, mapped, visitor, submitterUserId } = input
    const table = app.tables?.find((candidate) => candidate.name === form.submitTo.table)
    if (table === undefined) return undefined
    const named = hiddenPinsOf(app, form)
      .map((pin) => ({ pin, keys: submittedKeysOf(mapped[pin.column]) }))
      .filter((entry) => entry.keys.length > 0)
    if (named.length === 0) return undefined
    const session = yield* loadSubmitterSession(app, submitterUserId, table)
    // A session that no longer stands is judged as nobody: no `$user`, no page.
    const submitter: Submitter = {
      visitor: session === undefined ? undefined : visitor,
      userId: session === undefined ? undefined : submitterUserId,
      session,
    }
    const unpinned = yield* Effect.findFirst(named, ({ pin, keys }) =>
      holdsOnlyRenderedValues({ app, pin, keys, submitter }).pipe(Effect.map((held) => !held))
    )
    return Option.getOrUndefined(Option.map(unpinned, ({ pin }) => pin.column))
  }).pipe(Effect.withSpan('forms.find-unpinned-hidden-field'))
