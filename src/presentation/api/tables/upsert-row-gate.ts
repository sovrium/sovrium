/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The row-level gate of `POST /api/tables/:table/records/upsert`.
 *
 * An upsert is a create and an update behind one verb, and it answers to the
 * rules both of those answer to. Checking only the table-level grants would let
 * a member merge onto a row the table's `read`/`write` rules hide from them —
 * and read it back in the response — or hand a row they own to someone else,
 * both of which a PATCH of theirs is refused.
 *
 * Records are grouped by their merge key and each group's fields merged in
 * order, since the upsert applies them in order to the same row. A group that
 * matches rows is an update of every one of them, checked the way a batch
 * update is: each row readable and writable as it stands, and still writable
 * as it will be written — any miss refuses the whole request with `404`. A
 * group that matches nothing is a create, checked against `create.when` as a
 * batch create is.
 *
 * A row the caller's row-level `read` rule hides is never a match
 * ({@link hiddenMergeMatches}): a record matching only hidden rows is a create,
 * answering what a create of it would answer, and the hidden rows are left
 * alone — so neither the counts nor a refusal say that a hidden row holds the
 * key.
 */

import { rawListRecordsProgram } from '@/application/use-cases/tables/raw-list-program'
import { isResolvableColumnName } from '@/domain/models/app/tables/system-fields'
import { findRecordIdsByMergeFields } from '@/infrastructure/layers/table-layer'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import {
  enforceBulkCreateGate,
  enforceBulkMutationGate,
  projectReadPredicateClause,
  resolveGuardForTable,
} from './row-level-guard'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App, Table } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/runtime/context-helpers'
import type { Context } from 'hono'

type Fields = Readonly<Record<string, unknown>>

/** One merge key's records, merged in order, and the rows it would update. */
interface UpsertTarget {
  readonly fields: Fields
  readonly ids: readonly string[]
}

const mergeKeyOf = (fields: Fields, fieldsToMergeOn: readonly string[]): string =>
  JSON.stringify(fieldsToMergeOn.map((name) => fields[name]))

/** The records grouped by merge key, each group's fields merged in the order they apply. */
const mergedByKey = (
  records: readonly { readonly fields: Fields }[],
  fieldsToMergeOn: readonly string[]
): readonly Fields[] => [
  ...records
    .reduce<ReadonlyMap<string, Fields>>((groups, record) => {
      const key = mergeKeyOf(record.fields, fieldsToMergeOn)
      return new Map([...groups, [key, { ...(groups.get(key) ?? {}), ...record.fields }]])
    }, new Map())
    .values(),
]

interface UpsertScope {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly tableName: string
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly fieldsToMergeOn: readonly string[]
}

/**
 * The ids of the rows the records' merge keys match that the caller's
 * row-level `read` rule hides — none on a table without row-level rules or for
 * a caller they do not narrow. Trashed rows are judged like the others: the
 * rule decides, not the trash. A read that fails hides every match.
 */
export async function hiddenMergeMatches(
  input: UpsertScope & { readonly records: readonly { readonly fields: Fields }[] }
): Promise<readonly string[]> {
  const { c, app, table, tableName, userRole, userGroups, session, fieldsToMergeOn } = input
  if (!table?.rowLevelPermissions) return []
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  if (!guard) return []
  const clause = projectReadPredicateClause(table.rowLevelPermissions, guard.current)
  if (clause === 'bypass' || clause === 'no-rlp') return []
  const perKey = await Promise.all(
    mergedByKey(input.records, fieldsToMergeOn).map((fields) =>
      findRecordIdsByMergeFields(tableName, fields, fieldsToMergeOn)
    )
  )
  const matched = [...new Set(perKey.flat())]
  if (matched.length === 0 || clause === 'empty' || clause === undefined) return matched
  const readable = await runOnRequest(
    c,
    rawListRecordsProgram(
      session as UserSession,
      tableName,
      { and: [{ field: 'id', operator: 'in', value: matched }, clause] },
      true
    )
  )
  if (readable._tag === 'Failure') return matched
  const visible = new Set(readable.success.map((row) => String(row.id)))
  return matched.filter((id) => !visible.has(id))
}

/**
 * Refuse an upsert whose writes the caller's row-level rules do not allow, or
 * `undefined` when every create and update it would make is in scope. A table
 * with no row-level rules, and a caller they do not narrow, pass untouched.
 */
export async function enforceUpsertRowGate(
  input: UpsertScope & {
    /** The records as they will be written (fields the role may not write already dropped). */
    readonly records: readonly { readonly fields: Fields }[]
    /** The matched rows the caller's read rule hides ({@link hiddenMergeMatches}). */
    readonly hiddenIds: readonly string[]
  }
): Promise<Response | undefined> {
  const { c, app, table, tableName, userRole, userGroups, session, records, fieldsToMergeOn } =
    input
  const hidden = new Set(input.hiddenIds)
  if (!table?.rowLevelPermissions) return undefined
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  if (!guard) return undefined

  const targets: readonly UpsertTarget[] = await Promise.all(
    mergedByKey(records, fieldsToMergeOn).map(async (fields) => ({
      fields,
      ids: (await findRecordIdsByMergeFields(tableName, fields, fieldsToMergeOn)).filter(
        (id) => !hidden.has(id)
      ),
    }))
  )

  const creates = targets.filter((target) => target.ids.length === 0)
  const createError =
    creates.length === 0
      ? undefined
      : enforceBulkCreateGate({ c, table, guard, records: creates.map((t) => t.fields) })
  if (createError) return createError

  const updates = targets.filter((target) => target.ids.length > 0)
  if (updates.length === 0) return undefined
  return enforceBulkMutationGate({
    c,
    table,
    session,
    tableName,
    ids: updates.flatMap((target) => target.ids),
    guard,
    op: 'write',
    changes: new Map(
      updates.flatMap((target) => target.ids.map((id) => [id, target.fields] as const))
    ),
  })
}

/**
 * The first merge field that resolves to no column of `table`, or undefined when
 * every one of them does — including when the table itself is unknown, which is
 * the TABLE lookup's verdict to give, not this one's.
 *
 * System columns (`id`, the timestamps, the authorship columns) exist without
 * appearing in `fields[]`, so the shared `isResolvableColumnName` predicate is
 * used rather than a bare `fields[]` lookup — the same predicate both halves of
 * the record-filter field check already share, so the two cannot come to
 * opposite verdicts about one name.
 */
export function unresolvableMergeField(
  table: NonNullable<App['tables']>[number] | undefined,
  fieldsToMergeOn: readonly string[]
): string | undefined {
  if (!table) return undefined
  const declaredFieldNames = new Set(table.fields.map((f) => f.name))
  return fieldsToMergeOn.find((name) => !isResolvableColumnName(declaredFieldNames, name))
}

/**
 * The matched rows the caller's row-level read rule hides — no match for the
 * update check, the row gate and the write alike. A merge field naming no
 * column is never looked up: the permission check answers it.
 */
export const hiddenMatchesOf = (
  input: Parameters<typeof hiddenMergeMatches>[0]
): Promise<readonly string[]> =>
  unresolvableMergeField(input.table, input.fieldsToMergeOn) === undefined
    ? hiddenMergeMatches(input)
    : Promise.resolve([])
