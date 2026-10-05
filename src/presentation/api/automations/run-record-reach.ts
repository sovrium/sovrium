/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a reader who does not read every run may read of the records a run
 * captured with the engine's authority — a record step's output, a record
 * trigger's captured record.
 *
 * Two judgements, both hers through the records API:
 *
 *  - the SCHEMA: she reads the table, every column of it, and every related
 *    value its columns carry (none into a table or field she may not read);
 *  - the ROWS: her row-level rules admit each record, every record its
 *    relationships name, and every record a lookup it carries reads through,
 *    at every hop ({@link rowsReadWholeBy}).
 *
 * A related row captured whole (a record trigger expands a relationship into
 * the linked row's columns) is judged the same way, as a read of its own table.
 */

import { buildSyntheticSession } from '@/application/use-cases/automations/build-guest-session'
import { rowsReadWholeBy } from '@/application/use-cases/tables/rows-read-whole'
import {
  tableEffectiveRoles,
  type TableGateCaller,
} from '@/application/use-cases/tables/user-groups'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { relatedValuesRefusedTo } from '@/domain/models/app/tables/lookup-link-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export type AppTable = NonNullable<App['tables']>[number]

type Row = Readonly<Record<string, unknown>>

/** Who a run's captured records are judged for: a signed-in reader, or an agent's declared role. */
export interface Reader extends TableGateCaller {
  /** The signed-in reader whose row-level rules apply; absent for an agent. */
  readonly userId?: string
}

/** How many related rows deep a captured record is followed before it is withheld unjudged. */
const MAX_EXPANDED_DEPTH = 8

/** The records API's table read gate for `reader`. */
export const readsTable = (app: App, table: AppTable, reader: Reader): boolean =>
  hasReadPermissionForRoles(
    table as Parameters<typeof hasReadPermissionForRoles>[0],
    tableEffectiveRoles(table, reader),
    app as Parameters<typeof hasReadPermissionForRoles>[2]
  )

/** The columns of `table` the records API shows `reader` (none when it refuses her). */
export const readableColumns = (app: App, table: AppTable, reader: Reader): ReadonlySet<string> => {
  const plan = buildReadAccessPlan({
    app,
    table: {
      name: table.name,
      fields: table.fields,
      permissions: table.permissions as TableLike['permissions'],
    },
    principal: {
      role: reader.role,
      effectiveRoles: tableEffectiveRoles(table, reader),
      isAuthenticated: true,
    },
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return new Set()
  return new Set(plan.columnWhitelist ?? table.fields.map((field) => field.name))
}

/** Every related value of `table` `reader` may not read ({@link relatedValuesRefusedTo}). */
export const refusedTo = (app: App, table: AppTable, reader: Reader): ReadonlySet<string> =>
  relatedValuesRefusedTo(app, table.name, {
    role: reader.role,
    groups: reader.groups,
    signedOut: false,
  })

/**
 * True when `reader` reads `table` and every one of `columns`, and no related
 * value among them is refused to her — the schema half of a whole read.
 */
export const readsColumns = (
  app: App,
  table: AppTable,
  columns: ReadonlySet<string>,
  reader: Reader
): boolean => {
  if (!readsTable(app, table, reader)) return false
  const hers = readableColumns(app, table, reader)
  const refused = refusedTo(app, table, reader)
  return [...columns].every((column) => hers.has(column) && !refused.has(column))
}

/** The rows a captured relationship value expands into: an object, or a list of them. */
const expandedRows = (value: unknown): readonly Row[] => {
  if (Array.isArray(value)) return value.flatMap(expandedRows)
  if (value === null || typeof value !== 'object') return []
  return Object.keys(value).some((key) => key !== 'id') ? [value as Row] : []
}

/** Each declared table `table`'s relationships expand into, with the rows `records` carry. */
const expandedByTable = (
  app: App,
  table: AppTable,
  records: readonly Row[]
): readonly (readonly [AppTable, readonly Row[]])[] =>
  table.fields
    .filter((field) => field.type === 'relationship')
    .flatMap((field) => {
      const relatedName = (field as { readonly relatedTable?: unknown }).relatedTable
      const related = app.tables?.find((candidate) => candidate.name === relatedName)
      const rows = records.flatMap((record) => expandedRows(record[field.name]))
      return related === undefined || rows.length === 0 ? [] : [[related, rows] as const]
    })

/**
 * True when `reader`'s own read of `records` of `table` would carry everything
 * they carry: the whole table's schema, and every row ({@link rowsReadWholeBy})
 * — each related row captured whole judged as a read of its own table. A
 * reader with no signed-in identity, or rows nested past
 * {@link MAX_EXPANDED_DEPTH}, cannot be judged: not whole.
 */
export const recordsReadWhole = async (input: {
  readonly c: Context
  readonly app: App
  readonly table: AppTable
  readonly records: readonly Row[]
  readonly reader: Reader
  readonly depth?: number
}): Promise<boolean> => {
  const { c, app, table, records, reader } = input
  const depth = input.depth ?? 0
  if (reader.userId === undefined || depth > MAX_EXPANDED_DEPTH) return false
  const columns = new Set(table.fields.map((field) => field.name))
  if (!readsColumns(app, table, columns, reader)) return false
  const linkReader = {
    session: buildSyntheticSession(reader.userId),
    role: reader.role,
    groups: reader.groups,
  }
  const rowsWhole = await runDomainPromise(
    c,
    rowsReadWholeBy(app, table.name, records, linkReader)
  ).catch(() => false)
  if (!rowsWhole) return false
  // Sequential: each related table may cost reads on the shared pool.
  return expandedByTable(app, table, records).reduce<Promise<boolean>>(
    async (verdict, [related, rows]) =>
      (await verdict) &&
      recordsReadWhole({ c, app, table: related, records: rows, reader, depth: depth + 1 }),
    Promise.resolve(true)
  )
}
