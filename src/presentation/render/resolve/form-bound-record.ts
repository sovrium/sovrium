/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record a single-record `form` is handed: narrowed to the fields it
 * lists, and carrying the links its many-to-many fields hold.
 *
 * THE LINKS. A many-to-many field has no column on its table: its value lives in a
 * junction table, so the row `fetchSingleRecord` reads never carries it. An edit
 * form bound to that row therefore opened every many-to-many picker empty —
 * "0 of 5 linked", no chip — although the records API reads the same record
 * with its links (`GET /records/:id` resolves them from the junction). This
 * reads them the same way, for the fields the form lists, and adds them to the
 * record before it is handed to the form.
 *
 * The links arrive as IDS, each a string. That is the one shape the picker's
 * value encoding reads (`readLinkedIds`): an array of `{ id, … }` objects would
 * be JSON-encoded whole and read back as "[object Object]". The names the chips
 * show are resolved by the picker itself, from the ids.
 */

import { fieldNamesMatch } from '@/domain/models/app/tables/field-name-matching'
import { readRowsForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReadAccessPlan } from '@/domain/models/app/tables/read-access-plan-service'

/**
 * The columns a record carries whatever a form lists: its id (the address a
 * save writes to) and its save token, under both spellings the row can have.
 */
const RECORD_IDENTITY_KEYS: ReadonlySet<string> = new Set(['id', 'updatedAt', 'updated_at'])

/** The names a form lists; empty when it lists none, which means every field. */
function listedFieldNames(component: Component): readonly string[] {
  const { fields } = component as { readonly fields?: readonly { readonly field?: string }[] }
  return (fields ?? []).flatMap((f) => (typeof f.field === 'string' ? [f.field] : []))
}

/**
 * The record a `form` serialises into the page, narrowed to the fields it
 * lists (all of them when it lists none) plus {@link RECORD_IDENTITY_KEYS}.
 *
 * A form prefills its inputs from `_record`, and `_record` reaches the HTML
 * whole — as the island's props — whatever the inputs show. So a column the
 * form does not list has no business in it, however readable it is. Names are
 * matched the way the form's own field resolver matches them
 * (`fieldNamesMatch`), so `firstName` in the form still finds `first_name`.
 * Every other component keeps the record it was given.
 */
export function narrowRecordToComponent(
  component: Component,
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  if (component.type !== 'form') return record
  const listed = listedFieldNames(component)
  if (listed.length === 0) return record
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => RECORD_IDENTITY_KEYS.has(key) || listed.some((name) => fieldNamesMatch(key, name))
    )
  )
}

/** A many-to-many field to read the links of. */
export interface FormManyToManyField {
  readonly fieldName: string
  readonly relatedTable: string
}

type AppTable = NonNullable<App['tables']>[number]

/**
 * The many-to-many fields of `table` a `form` shows and this visitor may read:
 * the ones it lists (all of them when it lists none), less the plan's
 * restricted columns. Empty for any other component type.
 */
export function formManyToManyFields(
  component: Component,
  table: AppTable,
  plan: ReadAccessPlan | undefined
): readonly FormManyToManyField[] {
  if (component.type !== 'form') return []
  const listed = listedFieldNames(component)
  return table.fields.flatMap((field) => {
    const { relationType, relatedTable } = field as {
      readonly relationType?: string
      readonly relatedTable?: string
    }
    if (field.type !== 'relationship' || relationType !== 'many-to-many') return []
    if (typeof relatedTable !== 'string') return []
    if (plan?.restrictedColumns.has(field.name) === true) return []
    if (listed.length > 0 && !listed.some((name) => fieldNamesMatch(field.name, name))) return []
    return [{ fieldName: field.name, relatedTable }]
  })
}

/** Who the linked rows are read for, and through which database. */
interface LinkReader {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/**
 * The linked ids the visitor may read in `relatedTable`, in their linked
 * order, read in ONE gated read ({@link readRowsForCaller}): a link to a row
 * of a table she may not read, to a row its row-level rule hides from her, or
 * to a row in the trash is dropped. The form would otherwise key, count and —
 * through the picker's label lookup — name a row the records API refuses.
 */
async function readableLinkedIds(
  ids: readonly (string | number)[],
  relatedTable: string,
  reader: LinkReader
): Promise<readonly string[]> {
  const keys = ids.map(String)
  if (keys.length === 0) return []
  const { rows } = await readRowsForCaller({
    ...reader,
    tableName: relatedTable,
    query: { filter: [{ field: 'id', operator: 'in', value: keys }], fields: ['id'] },
  })
  const readable = new Set(rows.map((row) => String(row['id'])))
  return keys.filter((id) => readable.has(id))
}

/**
 * `record` with the ids it links through each of `manyToManyFields`, as strings — `[]`
 * for a field it links nothing through — narrowed to the linked rows the
 * visitor may read. Unchanged when there is nothing to read, the record has no
 * id, or the database adapter cannot read links.
 */
export async function withManyToManyLinks(
  record: Readonly<Record<string, unknown>>,
  ctx: LinkReader & {
    readonly tableName: string
    readonly manyToManyFields: readonly FormManyToManyField[]
  }
): Promise<Readonly<Record<string, unknown>>> {
  const { manyToManyFields: fields, db, tableName } = ctx
  const { id } = record
  if (fields.length === 0 || db.fetchManyToManyLinks === undefined) return record
  if (typeof id !== 'string' && typeof id !== 'number') return record
  const links = await db.fetchManyToManyLinks(tableName, String(id), fields)
  const entries = await Promise.all(
    fields.map(
      async ({ fieldName, relatedTable }) =>
        [fieldName, await readableLinkedIds(links[fieldName] ?? [], relatedTable, ctx)] as const
    )
  )
  return { ...record, ...Object.fromEntries(entries) }
}
