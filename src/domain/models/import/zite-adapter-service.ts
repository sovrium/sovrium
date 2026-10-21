/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Zite adapter: a Zite database snapshot in, a `CanonicalBase` out — one
 * table per Zite table.
 *
 * It reads the files `sovrium import fetch zite:<databaseId>` wrote, already
 * parsed, by snapshot path:
 *
 * - `raw/database.json`: the database, its tables with their fields and views;
 * - `raw/tables/<tableId>/fields.json`: a table's fields in display order,
 *   preferred over the database's copy when present;
 * - `raw/tables/<tableId>/records-NNNN.json`: the record pages, read in order,
 *   each record's values in `data` keyed by field id;
 * - `raw/sovrium-attachments.json`: the fetch's index of the files it
 *   downloaded, keyed by attachment URL.
 *
 * Values are read per type, pinned under `[internal ref]`
 * (facts c1 to c3, d4 to d7):
 *
 * - **linked_record** is a list of record ids: each becomes a link to that
 *   record of the table `template.tableId` names.
 * - **attachments** is `[{ url, filename }]`: each becomes the file the fetch
 *   downloaded, or its file name alone when the download was skipped.
 * - An empty value (`""`, `null`, `[]`) is an empty cell; `false` is a value.
 * - Anything structured that is not one of these (the system `source` field)
 *   is kept as its JSON text.
 *
 * Zite's template keys are translated into the keys the mapper reads:
 * `tableId`/`inverseFieldId` to `linkedTableId`/`inverseLinkFieldId`, a
 * lookup's `linkedRecordFieldId`/`lookupFieldId` to
 * `recordLinkFieldId`/`fieldIdInLinkedTable`, a select's `options` to
 * `choices`, `maxRating` to `max`, a currency's `currencySymbol` and
 * `decimalPlaces` to `symbol` and `precision`, a duration's `format` to
 * `durationFormat`, and a formula's `expression` and `resultType` to
 * `expression` and `result.type`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { attachmentIndexOf, IMPORT_ATTACHMENT_INDEX } from './snapshot-manifest'
import type { AirtableAsset } from './airtable-cells-service'
import type {
  CanonicalBase,
  CanonicalField,
  CanonicalTable,
  CanonicalValue,
} from './canonical-base'
import type { TableAdapterResult } from './tabular-adapter-service'

/** The database file of a Zite snapshot. */
export const ZITE_DATABASE_PATH = 'raw/database.json'

const RECORD_PAGE = /^raw\/tables\/([^/]+)\/records-\d+\.json$/

/** What the Zite adapter reads. */
export interface ZiteSnapshot {
  readonly databaseId: string
  /** Every `raw/` JSON file of the snapshot, parsed, by snapshot path. */
  readonly files: ReadonlyMap<string, unknown>
}

type Json = Readonly<Record<string, unknown>>
type Item = Exclude<CanonicalValue, readonly unknown[]>
type CanonicalView = CanonicalTable['views'][number]

const objectsOf = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const stringsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const NEVER_IMPORTABLE: CanonicalBase['neverImportable'] = [
  {
    what: 'Zite workflows',
    reason:
      "Zite workflows are TypeScript code in the app's repository, not database content; the Database API does not expose them.",
  },
  {
    what: 'Zite apps',
    reason: 'A Zite app is generated code with no export a migration can read.',
  },
]

/** One template key renamed, when the template states it. */
const renamed = (template: Json, from: string, to: string): Json =>
  template[from] === undefined ? {} : { [to]: template[from] }

const TEMPLATE_KEYS: Readonly<Record<string, (template: Json) => Json>> = {
  linked_record: (template) => ({
    ...renamed(template, 'tableId', 'linkedTableId'),
    ...renamed(template, 'inverseFieldId', 'inverseLinkFieldId'),
    ...renamed(template, 'allowMultiple', 'allowMultiple'),
  }),
  lookup: (template) => ({
    ...renamed(template, 'linkedRecordFieldId', 'recordLinkFieldId'),
    ...renamed(template, 'lookupFieldId', 'fieldIdInLinkedTable'),
  }),
  single_select: (template) => ({
    choices: objectsOf(template['options']).map((option) => ({
      name: String(option['label'] ?? option['value']),
      ...(typeof option['color'] === 'string' ? { color: option['color'] } : {}),
    })),
  }),
  rating: (template) => renamed(template, 'maxRating', 'max'),
  currency: (template) => ({
    ...renamed(template, 'currencySymbol', 'symbol'),
    ...renamed(template, 'decimalPlaces', 'precision'),
  }),
  percent: (template) => renamed(template, 'decimalPlaces', 'precision'),
  duration: (template) => renamed(template, 'format', 'durationFormat'),
  formula: (template) => ({
    ...renamed(template, 'expression', 'expression'),
    ...(typeof template['resultType'] === 'string'
      ? { result: { type: template['resultType'] } }
      : {}),
  }),
}
const MULTI_SELECT_KEYS = TEMPLATE_KEYS['single_select']

const optionsOf = (field: Json): Readonly<Record<string, unknown>> | undefined => {
  const template = isRecord(field['template']) ? field['template'] : {}
  const type = String(field['type'])
  const translate = type === 'multiple_select' ? MULTI_SELECT_KEYS : TEMPLATE_KEYS[type]
  const options = translate === undefined ? template : translate(template)
  return Object.keys(options).length === 0 ? undefined : options
}

const fieldOf = (field: Json, primaryId: unknown): CanonicalField => {
  const options = optionsOf(field)
  return {
    sourceId: String(field['id']),
    name: String(field['name'] ?? field['id']),
    sourceType: String(field['type'] ?? 'unknown') || 'unknown',
    ...(options === undefined ? {} : { options }),
    ...(field['id'] === primaryId ? { primary: true } : {}),
    ...(typeof field['description'] === 'string' && field['description'] !== ''
      ? { description: field['description'] }
      : {}),
  }
}

/** The downloaded files, by attachment URL. */
const assetsOf = (files: ReadonlyMap<string, unknown>): ReadonlyMap<string, AirtableAsset> =>
  attachmentIndexOf(files.get(IMPORT_ATTACHMENT_INDEX))

const scalarOf = (value: unknown): Item | undefined => {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value
  return value === null || value === undefined ? undefined : JSON.stringify(value)
}

const listed = (items: readonly Item[]): CanonicalValue | undefined =>
  items.length === 0 ? undefined : items

/** One `data` value as a canonical value, or `undefined` for an empty cell. */
const cellOf = (
  field: Json,
  raw: unknown,
  assets: ReadonlyMap<string, AirtableAsset>
): CanonicalValue | undefined => {
  const type = String(field['type'])
  const template = isRecord(field['template']) ? field['template'] : {}
  if (type === 'linked_record') {
    const table = String(template['tableId'] ?? '')
    return listed(
      stringsOf(Array.isArray(raw) ? raw : [raw])
        .filter((id) => id !== '')
        .map((record) => ({ kind: 'link', table, record }))
    )
  }
  if (type === 'attachments') {
    return listed(
      objectsOf(raw).flatMap((file): readonly Item[] => {
        if (typeof file['url'] !== 'string') return []
        const held = assets.get(file['url'])
        const named =
          typeof file['filename'] === 'string' && file['filename'] !== ''
            ? file['filename']
            : (file['url'].split('/').at(-1) ?? 'file')
        return [
          {
            kind: 'attachment',
            filename: held?.filename ?? named,
            ...(held === undefined ? {} : { asset: held.asset }),
          },
        ]
      })
    )
  }
  if (Array.isArray(raw)) return listed(raw.flatMap((item) => scalarOf(item) ?? []))
  return scalarOf(raw)
}

/** A grid view: the fields it shows in its order, and its sorts. */
const viewOf = (view: Json): CanonicalView => {
  const config = isRecord(view['config']) ? view['config'] : {}
  const hidden = new Set(stringsOf(config['hiddenFieldIds']))
  return {
    sourceId: String(view['id']),
    name: String(view['name'] ?? view['id']),
    kind: view['type'] === 'grid' ? 'grid' : 'other',
    filters: [],
    sorts: objectsOf(config['sorts']).flatMap((sort) => {
      const field = sort['fieldId'] ?? sort['field']
      return typeof field === 'string'
        ? [
            {
              field,
              direction: sort['direction'] === 'desc' ? ('desc' as const) : ('asc' as const),
            },
          ]
        : []
    }),
    visibleFields: stringsOf(config['orderedFieldIds']).filter((id) => !hidden.has(id)),
  }
}

/** Every record of a table, its pages read in order. */
const recordsOf = (files: ReadonlyMap<string, unknown>, tableId: string): readonly Json[] =>
  [...files.keys()]
    .filter((path) => RECORD_PAGE.exec(path)?.[1] === tableId)
    .toSorted()
    .flatMap((path) => {
      const page = files.get(path)
      return objectsOf(isRecord(page) ? page['records'] : undefined)
    })

const tableOf = (
  files: ReadonlyMap<string, unknown>,
  table: Json,
  assets: ReadonlyMap<string, AirtableAsset>
): CanonicalTable => {
  const id = String(table['id'])
  const listing = files.get(`raw/tables/${id}/fields.json`)
  const fields = objectsOf(isRecord(listing) ? listing['fields'] : table['fields'])
  const records = recordsOf(files, id).map((record) => {
    const data = isRecord(record['data']) ? record['data'] : {}
    const values = Object.fromEntries(
      fields.flatMap((field) => {
        const value = cellOf(field, data[String(field['id'])], assets)
        return value === undefined ? [] : [[String(field['id']), value] as const]
      })
    )
    return {
      sourceId: String(record['id']),
      values,
      ...(typeof record['createdAt'] === 'string' ? { createdAt: record['createdAt'] } : {}),
    }
  })
  return {
    sourceId: id,
    name: String(table['name'] ?? id),
    fields: fields.map((field) => fieldOf(field, table['primaryFieldId'])),
    views: objectsOf(table['views']).map(viewOf),
    records,
  }
}

/** Read a Zite database snapshot into the canonical base. */
export const adaptZiteSnapshot = (snapshot: ZiteSnapshot): TableAdapterResult => {
  const database = snapshot.files.get(ZITE_DATABASE_PATH)
  const described = isRecord(database) ? database : {}
  const assets = assetsOf(snapshot.files)
  const tables = objectsOf(described['tables']).map((table) =>
    tableOf(snapshot.files, table, assets)
  )
  return {
    base: {
      tool: 'zite',
      sourceId: snapshot.databaseId,
      name: typeof described['name'] === 'string' ? described['name'] : snapshot.databaseId,
      tables,
      users: [],
      neverImportable: NEVER_IMPORTABLE,
    },
    identities: Object.fromEntries(tables.map((table) => [table.sourceId, 'source-id'] as const)),
  }
}
