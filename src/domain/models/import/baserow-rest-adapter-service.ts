/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The adapter of a Baserow snapshot written by `sovrium import fetch`: the
 * REST API's own pages, read with a database token.
 *
 * ```
 * raw/tables.json                         GET /api/database/tables/all-tables/
 * raw/tables/<tableId>/fields.json        GET /api/database/fields/table/<tableId>/
 * raw/tables/<tableId>/rows-0001.json …   GET /api/database/rows/table/<tableId>/?user_field_names=true
 * raw/sovrium-attachments.json            the fetch's index of the files it downloaded
 * ```
 *
 * A row is keyed by field name (`user_field_names=true`) or, from an older
 * fetch, by `field_<id>`; both are read. Unlike the export ZIP, the API fills
 * computed cells, so a formula kept as values keeps them.
 *
 * What a database token cannot read is reported, never guessed: views and
 * automations need a signed-in user, and a collaborator comes back as a name
 * without an email, so no account can be seeded for it.
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
import { IMPORT_ATTACHMENT_INDEX } from './snapshot-manifest'
import type { CanonicalBase, CanonicalField, CanonicalTable } from './canonical-base'
import type { TableAdapterResult } from './tabular-adapter-service'

/** The snapshot path of the table list. */
export const BASEROW_TABLES_PATH = 'raw/tables.json'

/** The snapshot path of a table's fields. */
export const baserowFieldsPath = (tableId: string): string => `raw/tables/${tableId}/fields.json`

/** The snapshot path of a table's rows page, 1-based. */
export const baserowRowsPath = (tableId: string, page: number): string =>
  `raw/tables/${tableId}/rows-${String(page).padStart(4, '0')}.json`

/** The fetch's own index of the attachments it downloaded. */
export const ATTACHMENT_INDEX_PATH = IMPORT_ATTACHMENT_INDEX

/** What a Baserow database token cannot read at all. */
export const BASEROW_REST_NEVER_IMPORTABLE: CanonicalBase['neverImportable'] = [
  {
    what: 'Baserow views',
    reason:
      'The API serves views to a signed-in user only, never to a database token. Import the workspace export ZIP to bring them.',
  },
  {
    what: 'Baserow automations',
    reason:
      'The API serves automations to a signed-in user only, never to a database token. Import the workspace export ZIP to bring them.',
  },
  {
    what: 'Baserow collaborator emails',
    reason:
      'The API names a collaborator by name only, so no account is seeded for it. The workspace export ZIP carries the emails.',
  },
]

const ROWS_PAGE = /^raw\/tables\/([^/]+)\/rows-(\d{4})\.json$/

/** The snapshot asset of each downloaded file, by the internal name the source gave it. */
const assetIndex = (index: unknown): ReadonlyMap<string, string> =>
  new Map(
    arrayOf(index)
      .filter(isRecord)
      .flatMap((entry) =>
        typeof entry['source'] === 'string' && typeof entry['asset'] === 'string'
          ? [[entry['source'], entry['asset']] as const]
          : []
      )
  )

/** Every row of a table, page after page. */
const rowsOf = (raw: ReadonlyMap<string, unknown>, tableId: string): readonly Json[] =>
  [...raw.keys()]
    .filter((path) => ROWS_PAGE.exec(path)?.[1] === tableId)
    .toSorted()
    .flatMap((path) => {
      const page = raw.get(path)
      return arrayOf(isRecord(page) ? page['results'] : undefined).filter(isRecord)
    })

/** A row's cell for a field: by its name, else by `field_<id>`. */
const cellReader =
  (row: Json) =>
  (field: CanonicalField): unknown =>
    Object.hasOwn(row, field.name) ? row[field.name] : row[`field_${field.sourceId}`]

const tableOf = (
  raw: ReadonlyMap<string, unknown>,
  listed: Json,
  context: CellContext
): CanonicalTable | undefined => {
  const sourceId = idOf(listed['id'])
  if (sourceId === undefined) return undefined
  const fields = arrayOf(raw.get(baserowFieldsPath(sourceId)))
    .filter(isRecord)
    .flatMap((field) => {
      const canonical = baserowField(field)
      return canonical === undefined ? [] : [canonical]
    })
  return {
    sourceId,
    name: typeof listed['name'] === 'string' && listed['name'] !== '' ? listed['name'] : sourceId,
    fields,
    views: [],
    records: rowsOf(raw, sourceId).flatMap((row) => {
      const record = baserowRecord(row, fields, cellReader(row), context)
      return record === undefined ? [] : [record]
    }),
  }
}

/**
 * A Baserow REST snapshot as one base: the tables of one database.
 *
 * @param raw - every `raw/` file of the snapshot, parsed, by snapshot path.
 * @param databaseId - the database the fetch read; the snapshot's first source id.
 */
export const adaptBaserowSnapshot = (
  raw: ReadonlyMap<string, unknown>,
  databaseId: string
): TableAdapterResult => {
  const assets = assetIndex(raw.get(ATTACHMENT_INDEX_PATH))
  const context: CellContext = { assetOf: (name) => assets.get(name) }
  const listed = arrayOf(raw.get(BASEROW_TABLES_PATH))
    .filter(isRecord)
    .filter((table) => idOf(table['database_id']) === databaseId)
    .toSorted((a, b) => Number(a['order'] ?? 0) - Number(b['order'] ?? 0))
  const tables = listed.flatMap((table) => {
    const canonical = tableOf(raw, table, context)
    return canonical === undefined ? [] : [canonical]
  })
  return {
    base: {
      tool: 'baserow',
      sourceId: databaseId,
      name: `Baserow database ${databaseId}`,
      tables,
      users: usersOf(tables.flatMap((table) => table.records)),
      neverImportable: BASEROW_REST_NEVER_IMPORTABLE,
    },
    identities: Object.fromEntries(tables.map((table) => [table.sourceId, 'source-id'] as const)),
  }
}
