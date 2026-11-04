/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record a page binds — a page `dataSource` in single mode, a collection
 * page's record, a component bound in single mode — as the records API reads
 * it for its reader: with the ids it links through each many-to-many and
 * one-to-many field she may read, and the labels her fields read by
 * (`_display`).
 *
 * Neither kind of to-many field has a column on its table: a many-to-many's
 * links live in a junction table, a one-to-many's in the related table's key
 * pointing back. So the row a page reads never carries them. Without this, a
 * `record-field` or a `description-list` entry on the field drew the empty
 * dash, `$record.<field>` resolved to nothing and an `id in $record.<field>`
 * filter listed nothing, on a record linking several others.
 *
 * For the fields a page's `repeat` iterates, the record also carries the
 * linked rows themselves (`linked-rows.ts`), so each copy reads its record.
 */

import { toManyLinksRefusedTo } from '@/domain/models/app/tables/related-field-read-service'
import { resolveRelationshipForeignKey } from '@/domain/models/app/tables/relationship-foreign-key'
import { relatedReaderFor } from '@/domain/models/app/tables/row-read-admission-service'
import {
  readableLinkedIds,
  readableManyToManyFields,
  withManyToManyLinks,
} from './form-bound-record'
import { LINKED_ROWS_KEY } from './linked-rows'
import { resolveRenderPlan } from './read-plan-gates'
import { withRecordLabels } from './record-display-labels'
import { readRowsForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { ReadAccessPlan } from '@/domain/models/app/tables/read-access-plan-service'

type RecordRow = Readonly<Record<string, unknown>>
type AppTable = NonNullable<App['tables']>[number]

/** Who a bound record is read for, through which database, and from which table. */
interface BoundRecordReader {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
  readonly tableName: string
  /** The fields a `repeat` on the page iterates: their linked rows are read too. */
  readonly repeated?: ReadonlySet<string> | undefined
}

/** A one-to-many field to read the links of: the related table and its key back here. */
interface BoundOneToManyField {
  readonly fieldName: string
  readonly relatedTable: string
  readonly reciprocalField: string
}

/**
 * The one-to-many fields of `table` this visitor may read — less the plan's
 * restricted columns and the links into a table she may not read
 * ({@link toManyLinksRefusedTo}), exactly as a many-to-many is narrowed — each
 * with the related table's column pointing back, the one the schema resolves
 * ({@link resolveRelationshipForeignKey}). A field whose key cannot be
 * resolved reads nothing.
 */
function readableOneToManyFields(
  table: AppTable,
  {
    plan,
    app,
    session,
  }: Pick<BoundRecordReader, 'app' | 'session'> & {
    readonly plan: ReadAccessPlan | undefined
  }
): readonly BoundOneToManyField[] {
  const refused = toManyLinksRefusedTo(app, table.name, relatedReaderFor(session))
  return table.fields.flatMap((field) => {
    const relation = field as { readonly relationType?: string; readonly relatedTable?: string }
    const { relatedTable } = relation
    if (field.type !== 'relationship' || relation.relationType !== 'one-to-many') return []
    if (typeof relatedTable !== 'string') return []
    if (plan?.restrictedColumns.has(field.name) === true || refused.has(field.name)) return []
    const key = resolveRelationshipForeignKey({
      relationshipField: field as Parameters<
        typeof resolveRelationshipForeignKey
      >[0]['relationshipField'],
      parentTableName: table.name,
      childTable: app.tables?.find((candidate) => candidate.name === relatedTable),
    })
    return key.resolved
      ? [{ fieldName: field.name, relatedTable, reciprocalField: key.column }]
      : []
  })
}

/**
 * `record` with the ids of the rows pointing at it through each of `fields`,
 * as strings, narrowed to the rows the visitor may read — `[]` for a field
 * nothing points through. Unchanged with no field, no id, or an adapter that
 * cannot read them.
 */
async function withOneToManyLinks(
  record: RecordRow,
  fields: readonly BoundOneToManyField[],
  reader: BoundRecordReader
): Promise<RecordRow> {
  const { id } = record
  const fetchLinks = reader.db.fetchOneToManyLinks
  if (fields.length === 0 || fetchLinks === undefined) return record
  if (typeof id !== 'string' && typeof id !== 'number') return record
  const links = (await fetchLinks({ sourceIds: [id], fields }))[String(id)] ?? {}
  const entries = await Promise.all(
    fields.map(
      async ({ fieldName, relatedTable }) =>
        [fieldName, await readableLinkedIds(links[fieldName] ?? [], relatedTable, reader)] as const
    )
  )
  return { ...record, ...Object.fromEntries(entries) }
}

/**
 * `record` carrying, under {@link LINKED_ROWS_KEY}, the linked rows of each
 * to-many field a `repeat` iterates, in the order of its ids — each read as
 * the visitor, less the columns she may not read. Unchanged when none is.
 */
async function withRepeatedRows(
  record: RecordRow,
  fields: readonly { readonly fieldName: string; readonly relatedTable: string }[],
  reader: BoundRecordReader
): Promise<RecordRow> {
  const repeated = fields.filter(
    ({ fieldName }) => reader.repeated?.has(fieldName) === true && Array.isArray(record[fieldName])
  )
  if (repeated.length === 0) return record
  const entries = await Promise.all(
    repeated.map(async ({ fieldName, relatedTable }) => {
      const ids = (record[fieldName] as readonly unknown[]).map(String)
      if (ids.length === 0) return [fieldName, []] as const
      const { rows } = await readRowsForCaller({
        ...reader,
        tableName: relatedTable,
        query: { filter: [{ field: 'id', operator: 'in', value: ids }] },
      })
      const byId = new Map(rows.map((row) => [String(row['id']), row]))
      return [fieldName, ids.flatMap((linked) => byId.get(linked) ?? [])] as const
    })
  )
  return { ...record, [LINKED_ROWS_KEY]: Object.fromEntries(entries) }
}

/**
 * `record` with the ids it links through each to-many field of its table the
 * reader may read, narrowed to the linked rows she may read — and the rows of
 * those a `repeat` iterates. Unchanged for a table declaring none, or an
 * undeclared one.
 */
async function withReadableLinks(record: RecordRow, reader: BoundRecordReader): Promise<RecordRow> {
  const { app, session, tableName } = reader
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return record
  const plan = resolveRenderPlan({ matchedTable: table, app, session })
  const manyToManyFields = readableManyToManyFields(table, { plan, app, session })
  const oneToManyFields = readableOneToManyFields(table, { plan, app, session })
  const linked = await withOneToManyLinks(
    await withManyToManyLinks(record, { ...reader, manyToManyFields }),
    oneToManyFields,
    reader
  )
  return withRepeatedRows(linked, [...manyToManyFields, ...oneToManyFields], reader)
}

/** `record` with its readable links, then the labels they and its other fields read by. */
export async function withLinksAndLabels(
  record: RecordRow,
  reader: BoundRecordReader
): Promise<RecordRow> {
  return withRecordLabels(await withReadableLinks(record, reader), reader)
}

/** {@link withLinksAndLabels} for one reader and table, as a projection of its records. */
export const linksAndLabelsFor =
  (reader: BoundRecordReader) =>
  async (record: RecordRow): Promise<RecordRow> =>
    withLinksAndLabels(record, reader)
