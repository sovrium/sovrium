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
 */

import { findRecordIdsByMergeFields } from '@/infrastructure/layers/table-layer'
import {
  enforceBulkCreateGate,
  enforceBulkMutationGate,
  resolveGuardForTable,
} from './row-level-guard'
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

/**
 * Refuse an upsert whose writes the caller's row-level rules do not allow, or
 * `undefined` when every create and update it would make is in scope. A table
 * with no row-level rules, and a caller they do not narrow, pass untouched.
 */
export async function enforceUpsertRowGate(input: {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly tableName: string
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  /** The records as they will be written (fields the role may not write already dropped). */
  readonly records: readonly { readonly fields: Fields }[]
  readonly fieldsToMergeOn: readonly string[]
}): Promise<Response | undefined> {
  const { c, app, table, tableName, userRole, userGroups, session, records, fieldsToMergeOn } =
    input
  if (!table?.rowLevelPermissions) return undefined
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })
  if (!guard) return undefined

  const targets: readonly UpsertTarget[] = await Promise.all(
    mergedByKey(records, fieldsToMergeOn).map(async (fields) => ({
      fields,
      ids: await findRecordIdsByMergeFields(tableName, fields, fieldsToMergeOn),
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
