/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The gates a bulk create and an upsert pass before they write, shared by the
 * records API's batch and upsert routes and the CSV import's route — so an
 * import is judged row by row exactly as the batch call it replaces: the same
 * table and row-level grants, the same field write audiences, the same
 * readonly and per-value rules.
 */

import { Effect, Schema } from 'effect'
import { judgeTableGrant } from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import {
  buildEffectiveRoles,
  tableEffectiveRoles,
} from '@/application/use-cases/tables/user-groups'
import {
  findWritableComputedFieldWrites,
  readonlyFieldWriteMessage,
} from '@/domain/models/app/tables/computed-field-write-validation'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { decodeJsonBody } from '@/presentation/api/runtime/request-body'
import { checkBatchFieldPermissions, validateBulkFieldValues } from './batch-permission-helpers'
import {
  createVerdictResponse,
  enforceBulkCreateGate,
  guardForTable,
  resolveAccessRolesFor,
} from './row-level-guard'
import { validateReadonlyFields, validateUpsertRequest } from './upsert-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type Records = readonly { readonly fields: Record<string, unknown> }[]

/** What a size pre-guard reads of a body it has not validated. */
type PreGuardBody = { readonly ids?: readonly unknown[]; readonly records?: readonly unknown[] }

/**
 * Read the request body for a SIZE PRE-GUARD, without throwing on a body that
 * is not JSON.
 *
 * The three batch handlers below each read the body twice: once here, to decide
 * whether the payload exceeds the 1000-entry cap, and once inside
 * `validateRequest` for the real decode. Only the second read is protected. A
 * bare `await c.req.json()` therefore turns a malformed body into a
 * `SyntaxError` that escapes the handler, reaches `createHonoApp`'s `.onError`,
 * and comes back 500 `INTERNAL_ERROR` with a `reportException` alongside it —
 * a caller's typo paging the operator for a fault that is not the server's.
 *
 * Degrading to `{}` lets the pre-guard decline (it sees no oversized array) and
 * hands the same input to `validateRequest`, which already owns the correct
 * answer for it: 400 `{ code: 'VALIDATION_ERROR', message: 'Invalid JSON body' }`.
 * The repair belongs here and not in `.onError`, which must keep reporting
 * genuine server faults as 500s.
 *
 * The parse is repeated rather than shared because Hono caches the request TEXT
 * and re-runs `JSON.parse` per call, so the second read throws independently of
 * this one — which is exactly what makes the fall-through safe.
 */
export const readPreGuardBody = (c: Context): Effect.Effect<PreGuardBody> =>
  // effect-promise: total -- `decodeJsonBody` reads a body that is not JSON as none.
  Effect.promise(() => decodeJsonBody(c, Schema.Unknown)).pipe(
    Effect.map(({ raw }) => (raw ?? {}) as PreGuardBody)
  )

/**
 * Refuse a batch that names a computed field the caller may write, on any of
 * its records — the first in the table's field order — with one `400` for the
 * whole request, so none of it is written. A computed field she may not write
 * is the field write rule's: refused or stripped as any field she may not
 * write. Run after the table- and row-level gates, so the name reaches only a
 * caller who may write the table.
 */
function refuseComputedFieldWrites(c: Context, app: App, records: Records): Response | undefined {
  const { tableName, userRole, userGroups } = getTableContext(c)
  const writer = { role: userRole, groups: userGroups }
  const payloads = records.map((record) => record.fields)
  const [first] = findWritableComputedFieldWrites(app, tableName, writer, payloads)
  if (first === undefined) return undefined
  const message = readonlyFieldWriteMessage(first)
  return c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400)
}

/**
 * Resolve the create-authorisation gate for batch create. Returns the
 * guard context (when the table is row-level scoped) so callers can chain
 * the per-row predicate check, or `undefined` for non-row-level tables.
 *
 * PARITY WITH THE SINGLE-RECORD PATH IS THE CONTRACT, and it is a three-part
 * contract, and omitting any part is its own defect. `checkCreateGate` (`../record/record-write-handlers.ts`) is the
 * reference implementation:
 *
 *  1. INHERITANCE. `app.tables` is the resolution set. Without it a table
 *     declaring `permissions: { inherit: '<parent>' }` resolves as if it had no
 *     create rule at all, so an inherited admin-only grant read as UNRESTRICTED
 *     on the batch path while the single-record path refused — the same request,
 *     two verdicts.
 *  2. GROUP GRANTS. A bare `userRole` can never match a `group:<name>` entry,
 *     because the group overlay exists only in the effective-role set built by
 *     `buildEffectiveRoles`. Passing the raw role leaves every group grant
 *     silently inert here while it works on the single-record route.
 *  3. S1 ANTI-ENUMERATION. A caller who also lacks READ access gets 404, not
 *     403 — a 403 confirms the table exists to someone with no business knowing
 *     it does.
 *
 * Fixing (1) alone is the trap: it closes the inheritance hole and leaves the
 * group hole open, while looking like the finding is closed.
 */
const resolveBatchCreateAuth = (input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  /** Group names the user belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly records: readonly { readonly fields: Record<string, unknown> }[]
}) =>
  Effect.map(
    guardForTable(
      input.session,
      { userRole: input.userRole, userGroups: input.userGroups },
      input.app.tables?.find((t) => t.name === input.tableName),
      input.app
    ),
    (guard) => {
      const { c, app, tableName, userRole, userGroups, records } = input
      const table = app.tables?.find((t) => t.name === tableName)
      if (guard) {
        return enforceBulkCreateGate({
          c,
          table,
          guard,
          records: records.map((r) => r.fields),
        })
      }
      // S1 anti-enumeration, mirroring the single-record path: no read access
      // collapses the denial to 404 so the table's existence is not disclosed.
      const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
      const caller = { effectiveRoles, allTables: app, signedOut: false }
      return createVerdictResponse(c, judgeTableGrant(table, 'create', caller))
    }
  )

/**
 * Every gate a bulk create passes, in order: the table and row-level create
 * grant, the field write audiences, then the readonly and per-value rules. The
 * single-record route gets the per-value rules from `validateRecordCreation`;
 * a bulk route has to ask, or an undeclared `multi-select` option and a
 * relationship past `maxLinked` reach the database. Resolves the refusal, or
 * `undefined` when the create may proceed.
 */
export const guardBatchCreate = (c: Context, app: App, records: Records) =>
  Effect.gen(function* () {
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const table = app.tables?.find((t) => t.name === tableName)
    const refusal =
      (yield* resolveBatchCreateAuth({
        c,
        app,
        tableName,
        userRole,
        userGroups,
        session,
        records,
      })) ??
      checkBatchFieldPermissions({ records, app, tableName, userRole, userGroups, c }) ??
      validateReadonlyFields(table, records, c) ??
      refuseComputedFieldWrites(c, app, records)
    return refusal ?? (yield* validateBulkFieldValues(c, app, records))
  })

/**
 * The rules a batch update's records pass once its table and row-level gates
 * have admitted them, in order: the readonly columns, a computed field the
 * caller may write, then the per-value rules — all before the field write
 * strip, and over every record, so a refusal writes none of the batch.
 */
export const guardBatchUpdateValues = (c: Context, app: App, records: Records) => {
  const table = app.tables?.find((t) => t.name === getTableContext(c).tableName)
  const refusal =
    validateReadonlyFields(table, records, c) ?? refuseComputedFieldWrites(c, app, records)
  return refusal ? Effect.succeed(refusal) : validateBulkFieldValues(c, app, records)
}

/**
 * Every gate an upsert passes: a merge field the caller may not read is refused
 * first, then a caller who may not create in the table, `id` is never written, the readonly and per-value rules BEFORE the
 * permission checks, then the create and update grants and the required fields
 * (`validateUpsertRequest`), which strip the fields the caller may not write,
 * and last a computed field she may write.
 *
 * The merge-field refusal is the one a filter on that field gets — `404`, the
 * table-missing body — and it comes before any lookup, so it reads the same
 * whether or not a row holds the value: matching on a field is reading it.
 */
export const guardUpsert = (
  c: Context,
  app: App,
  records: Records,
  fieldsToMergeOn: readonly string[]
) =>
  Effect.gen(function* () {
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const table = app.tables?.find((t) => t.name === tableName)
    const caller = { role: userRole, groups: userGroups }
    if (fieldsToMergeOn.some((field) => !isFieldReadableByCaller(app, tableName, caller, field))) {
      return { success: false as const, response: notFound(c) }
    }
    // Every upsert may create, so the create grant is judged before anything is
    // read: a caller it refuses — a visitor of an app with no sign-in included,
    // on a table opening only reads to everyone — gets the missing-table 404
    // before a value rule or a merge lookup reaches the database.
    const accessRoles = yield* resolveAccessRolesFor(session, table ? [table] : [])
    const roles = tableEffectiveRoles(table, { role: userRole, groups: userGroups, accessRoles })
    const grant = judgeTableGrant(table, 'create', {
      effectiveRoles: roles,
      allTables: app,
      signedOut: false,
    })
    if (grant._tag !== 'Allowed') {
      return { success: false as const, response: notFound(c) }
    }
    // `id` is always readonly, with an upsert-specific message.
    if (records.some((record) => 'id' in record.fields)) {
      const message = 'Cannot set readonly field: id'
      return {
        success: false as const,
        response: c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400),
      }
    }
    const fieldGuard =
      validateReadonlyFields(table, records, c) ?? (yield* validateBulkFieldValues(c, app, records))
    if (fieldGuard) return { success: false as const, response: fieldGuard }
    const validation = yield* validateUpsertRequest({
      ...{ c, app, tableName, userRole, userGroups, session },
      records,
      fieldsToMergeOn,
    })
    // A computed field is judged after the create and update grants, so a caller
    // who may do neither gets their refusal, never a column's name.
    const computed = validation.success ? refuseComputedFieldWrites(c, app, records) : undefined
    return computed ? { success: false as const, response: computed } : validation
  })
