/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The adapter of a Baserow workspace export ZIP: its `database` application
 * members as one `CanonicalBase`.
 *
 * - Every table of every database member becomes a canonical table, its
 *   fields, its views and its rows (`field_<id>` keys) read as the export
 *   writes them: select values are option ids, links are row ids,
 *   collaborators are emails, files name a member of the same ZIP.
 * - **Computed values are not in the export.** Baserow writes every formula,
 *   lookup, rollup and count cell as `null` and recomputes them on import, so
 *   a calculation that cannot be rebuilt here is kept as an EMPTY column of
 *   its result type, and the report quotes the original.
 * - A table's name is unique across the base: two databases holding a table
 *   of the same name keep both, the second named after its database.
 * - Workspace members, roles, webhooks and integrations' credentials are not
 *   in the export; the report says so.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  baserowField,
  baserowRecord,
  idOf,
  usersOf,
  type CellContext,
  type Json,
} from './baserow-field-service'
import { baserowView } from './baserow-view-service'
import type { CanonicalBase, CanonicalTable } from './canonical-base'
import type { TableAdapterResult } from './tabular-adapter-service'

/** What a Baserow workspace export never carries, by its own documentation. */
export const BASEROW_EXPORT_NEVER_IMPORTABLE: CanonicalBase['neverImportable'] = [
  {
    what: 'Baserow workspace members, roles and permissions',
    reason: 'A workspace export carries the applications only, never who may use them.',
  },
  {
    what: 'Baserow database webhooks',
    reason: 'A workspace export does not include webhooks.',
  },
  {
    what: 'Baserow dashboards and application builder pages',
    reason: 'Only databases and automations are read from a workspace export.',
  },
]

const tableOf = (table: Json, context: CellContext, name: string): CanonicalTable | undefined => {
  const sourceId = idOf(table['id'])
  if (sourceId === undefined) return undefined
  const fields = arrayOf(table['fields'])
    .filter(isRecord)
    .flatMap((field) => {
      const canonical = baserowField(field)
      return canonical === undefined ? [] : [canonical]
    })
  const rows = arrayOf(table['rows']).filter(isRecord)
  return {
    sourceId,
    name,
    fields,
    views: arrayOf(table['views'])
      .filter(isRecord)
      .flatMap((view) => {
        const canonical = baserowView(view, fields)
        return canonical === undefined ? [] : [canonical]
      }),
    records: rows.flatMap((row) => {
      const record = baserowRecord(row, fields, (field) => row[`field_${field.sourceId}`], context)
      return record === undefined ? [] : [record]
    }),
  }
}

/** Every table of the database members, each with the name it is shown under. */
const namedTables = (
  databases: readonly Json[]
): readonly { readonly table: Json; readonly name: string }[] => {
  const all = databases.flatMap((database) =>
    arrayOf(database['tables'])
      .filter(isRecord)
      .map((table) => ({
        table,
        own: typeof table['name'] === 'string' && table['name'] !== '' ? table['name'] : 'Table',
        database: typeof database['name'] === 'string' ? database['name'] : '',
      }))
  )
  return all.map((one, index) => {
    const clash = all.findIndex((other) => other.own === one.own) !== index
    return { table: one.table, name: clash ? `${one.database} ${one.own}`.trim() : one.own }
  })
}

/** Whether a member is a Baserow `database` application. */
export const isBaserowDatabase = (document: unknown): document is Json =>
  isRecord(document) && document['type'] === 'database' && Array.isArray(document['tables'])

/**
 * The database members of a Baserow export as one base.
 *
 * @param databases - the parsed `database__…json` members, in manifest order.
 * @param context - resolves a user file's internal name to its snapshot asset.
 */
export const adaptBaserowExport = (
  databases: readonly Json[],
  context: CellContext
): TableAdapterResult => {
  const tables = namedTables(databases).flatMap(({ table, name }) => {
    const canonical = tableOf(table, context, name)
    return canonical === undefined ? [] : [canonical]
  })
  const [first] = databases
  const base: CanonicalBase = {
    tool: 'baserow',
    sourceId: idOf(first?.['id']) ?? 'baserow',
    name: typeof first?.['name'] === 'string' ? first['name'] : 'Baserow',
    tables,
    users: usersOf(tables.flatMap((table) => table.records)),
    neverImportable: BASEROW_EXPORT_NEVER_IMPORTABLE,
  }
  return {
    base,
    identities: Object.fromEntries(tables.map((table) => [table.sourceId, 'source-id'] as const)),
  }
}
