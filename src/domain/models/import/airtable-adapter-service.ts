/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Airtable adapter: an Airtable snapshot in, a `CanonicalBase` out.
 *
 * It reads the files `sovrium import fetch airtable:<baseId>` wrote, already
 * parsed, by snapshot path:
 *
 * - `raw/meta/tables.json`: the base schema, every table with its fields (type
 *   and options verbatim) and its views;
 * - `raw/tables/<tableId>/records-NNNN.json`: the record pages, read in page
 *   order;
 * - `raw/sovrium-attachments.json`: the fetch's index of the attachments it
 *   downloaded, which ties an Airtable attachment id to its `assets/` file.
 *
 * Records may be keyed by field name (Airtable's default) or by field id
 * (`returnFieldsByFieldId`): a cell is found by id first, then by name. Each
 * cell is read by `airtable-cells-service`. The collaborators the records name
 * become the base's users, each once, sorted by email.
 *
 * What the Web API does not expose is named, never invented: automations and
 * interfaces are readable through Airtable's MCP server, which this release
 * does not read; scripts are reachable through no documented API.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { airtableCell, type AirtableAsset } from './airtable-cells-service'
import { attachmentIndexOf, IMPORT_ATTACHMENT_INDEX } from './snapshot-manifest'
import type {
  CanonicalBase,
  CanonicalField,
  CanonicalRecord,
  CanonicalTable,
  CanonicalValue,
} from './canonical-base'
import type { TableAdapterResult } from './tabular-adapter-service'

/** The schema file of an Airtable snapshot. */
export const AIRTABLE_SCHEMA_PATH = 'raw/meta/tables.json'

/** The fetch's attachment index. */
export const AIRTABLE_ATTACHMENT_INDEX = IMPORT_ATTACHMENT_INDEX

type CanonicalView = CanonicalTable['views'][number]

const RECORD_PAGE = /^raw\/tables\/([^/]+)\/records-\d+\.json$/

/** What the Airtable adapter reads. */
export interface AirtableSnapshot {
  readonly baseId: string
  /** Every `raw/` JSON file of the snapshot, parsed, by snapshot path. */
  readonly files: ReadonlyMap<string, unknown>
}

/** The adapter's result: the base, and what the automations section reports. */
export interface AirtableAdapterResult extends TableAdapterResult {
  readonly automationsNeverImportable: readonly { readonly what: string; readonly reason: string }[]
}

type Json = Readonly<Record<string, unknown>>

const objectsOf = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const MCP_REASON = 'readable through the Airtable MCP server, not yet imported'

const BASE_NEVER_IMPORTABLE: CanonicalBase['neverImportable'] = [
  {
    what: 'Airtable Interfaces',
    reason: `Airtable's Web API does not expose interface pages; they are ${MCP_REASON}.`,
  },
  {
    what: 'Airtable scripts',
    reason:
      "Neither Airtable's Web API nor its documented MCP tools expose the scripting extension or script actions, so they are not yet imported.",
  },
]

const AUTOMATIONS_NEVER_IMPORTABLE: AirtableAdapterResult['automationsNeverImportable'] = [
  {
    what: 'Airtable automations',
    reason: `Airtable's Web API does not expose automations; they are ${MCP_REASON}.`,
  },
]

const VIEW_KINDS: Readonly<Record<string, CanonicalView['kind']>> = {
  grid: 'grid',
  kanban: 'kanban',
  calendar: 'calendar',
  gallery: 'gallery',
  form: 'form',
  timeline: 'timeline',
  list: 'list',
}

const fieldOf = (field: Json): CanonicalField => ({
  sourceId: String(field['id']),
  name: String(field['name'] ?? field['id']),
  sourceType: String(field['type'] ?? 'unknown') || 'unknown',
  ...(isRecord(field['options']) ? { options: field['options'] } : {}),
  ...(typeof field['description'] === 'string' ? { description: field['description'] } : {}),
})

/**
 * A view: its kind, and for a grid the fields it shows. The Web API exposes
 * neither filters nor sorts.
 */
const viewOf = (view: Json): CanonicalView => ({
  sourceId: String(view['id']),
  name: String(view['name'] ?? view['id']),
  kind: VIEW_KINDS[String(view['type'])] ?? 'other',
  filters: [],
  sorts: [],
  visibleFields: Array.isArray(view['visibleFieldIds'])
    ? view['visibleFieldIds'].filter((id): id is string => typeof id === 'string')
    : [],
})

/** The downloaded attachments, by Airtable attachment id. */
const assetsOf = (files: ReadonlyMap<string, unknown>): ReadonlyMap<string, AirtableAsset> =>
  attachmentIndexOf(files.get(AIRTABLE_ATTACHMENT_INDEX))

/** Every record of a table, its pages read in order. */
const recordsOf = (files: ReadonlyMap<string, unknown>, tableId: string): readonly Json[] =>
  [...files.keys()]
    .filter((path) => RECORD_PAGE.exec(path)?.[1] === tableId)
    .toSorted()
    .flatMap((path) => {
      const page = files.get(path)
      return objectsOf(isRecord(page) ? page['records'] : undefined)
    })

const recordOf = (
  record: Json,
  fields: readonly Json[],
  assets: ReadonlyMap<string, AirtableAsset>
): CanonicalRecord => {
  const cells = isRecord(record['fields']) ? record['fields'] : {}
  const values = Object.fromEntries(
    fields.flatMap((field) => {
      const id = String(field['id'])
      const raw = id in cells ? cells[id] : cells[String(field['name'])]
      const value = airtableCell(String(field['type']), raw, {
        options: isRecord(field['options']) ? field['options'] : undefined,
        assets,
      })
      return value === undefined ? [] : [[id, value] as const]
    })
  )
  return {
    sourceId: String(record['id']),
    values,
    ...(typeof record['createdTime'] === 'string' ? { createdAt: record['createdTime'] } : {}),
  }
}

const COLLABORATOR_TYPES: ReadonlySet<string> = new Set([
  'singleCollaborator',
  'multipleCollaborators',
])

const collaboratorsOf = (raw: readonly Json[]): readonly Json[] =>
  raw.flatMap((table) =>
    objectsOf(table['fields']).filter((field) => COLLABORATOR_TYPES.has(String(field['type'])))
  )

/**
 * The name each person a cell names carries, by lower-cased email: a
 * collaborator cell is `{ id, email, name }`. The first name seen is kept.
 */
const namesOf = (records: readonly Json[]): ReadonlyMap<string, string> =>
  new Map(
    records
      .flatMap((record) => Object.values(isRecord(record['fields']) ? record['fields'] : {}))
      .flatMap((cell) => (Array.isArray(cell) ? cell : [cell]))
      .flatMap((item) => {
        if (!isRecord(item)) return []
        const { email, name } = item
        return typeof email === 'string' && typeof name === 'string' && name.trim() !== ''
          ? [[email.toLowerCase(), name.trim()] as const]
          : []
      })
      .toReversed()
  )

/**
 * The collaborators named in collaborator fields, each once, sorted by email,
 * with the name the source gives them when it gives one.
 */
const usersOf = (
  tables: readonly CanonicalTable[],
  collaborators: ReadonlySet<string>,
  names: ReadonlyMap<string, string>
): CanonicalBase['users'] => {
  const emails = tables.flatMap((table) =>
    table.records.flatMap((record) =>
      Object.entries(record.values)
        .filter(([fieldId]) => collaborators.has(fieldId))
        .flatMap(
          ([, value]) => (Array.isArray(value) ? value : [value]) as readonly CanonicalValue[]
        )
        .flatMap((item) =>
          isRecord(item) && item['kind'] === 'user' ? [String(item['email'])] : []
        )
    )
  )
  const unique = new Map(emails.map((email) => [email.toLowerCase(), email] as const))
  return [...unique.values()].toSorted().map((email) => {
    const name = names.get(email.toLowerCase())
    return name === undefined ? { email } : { email, name }
  })
}

/** Read an Airtable snapshot into the canonical base. */
export const adaptAirtableSnapshot = (snapshot: AirtableSnapshot): AirtableAdapterResult => {
  const schema = snapshot.files.get(AIRTABLE_SCHEMA_PATH)
  const raw = objectsOf(isRecord(schema) ? schema['tables'] : undefined)
  const assets = assetsOf(snapshot.files)
  const tables: readonly CanonicalTable[] = raw.map((table) => {
    const id = String(table['id'])
    const fields = objectsOf(table['fields'])
    return {
      sourceId: id,
      name: String(table['name'] ?? id),
      fields: fields.map(fieldOf),
      views: objectsOf(table['views']).map(viewOf),
      records: recordsOf(snapshot.files, id).map((record) => recordOf(record, fields, assets)),
    }
  })
  const collaborators = new Set(collaboratorsOf(raw).map((field) => String(field['id'])))
  const recordsOfTable = (table: Json) => recordsOf(snapshot.files, String(table['id']))
  return {
    base: {
      tool: 'airtable',
      sourceId: snapshot.baseId,
      name: snapshot.baseId,
      tables,
      users: usersOf(tables, collaborators, namesOf(raw.flatMap(recordsOfTable))),
      neverImportable: BASE_NEVER_IMPORTABLE,
    },
    identities: Object.fromEntries(tables.map((table) => [table.sourceId, 'source-id'] as const)),
    automationsNeverImportable: AUTOMATIONS_NEVER_IMPORTABLE,
  }
}
