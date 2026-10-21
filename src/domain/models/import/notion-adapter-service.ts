/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Notion adapter: a Notion snapshot in, a `CanonicalBase` out.
 *
 * It reads the files `sovrium import fetch notion:<databaseId>` wrote, already
 * parsed, by snapshot path:
 *
 * - `raw/databases/<databaseId>.json`: the database, a container of data
 *   sources in the API version the fetch pins;
 * - `raw/data_sources/<id>/schema.json`: one data source's properties. ONE
 *   Sovrium table per data source, the related data sources the fetch followed
 *   included;
 * - `raw/data_sources/<id>/query-NNNN.json`: its rows, page by page. Pages
 *   read in `created_time` windows overlap at the window edge, so a row is
 *   kept once;
 * - `raw/data_sources/<id>/properties/<pageId>/<key>-NNNN.json`: the full value of a
 *   property the query truncated (a relation past 25 links, and the formulas
 *   and rollups that may read it), which replaces the truncated one;
 * - `raw/sovrium-attachments.json`: the fetch's index of the files it
 *   downloaded.
 *
 * A property keeps its type and its type options as Notion states them. Two
 * readings are the adapter's own: a `date` property whose values carry a time
 * is typed `date_time`, and a formula or rollup is given the `resultType` its
 * values state, since the schema states none. A button is not a field: the
 * report names it as present but not readable.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  notionCell,
  notionPersonOf,
  notionPropertyOfFileKey,
  type NotionAsset,
} from './notion-cells-service'
import { attachmentIndexOf, IMPORT_ATTACHMENT_INDEX } from './snapshot-manifest'
import type {
  CanonicalBase,
  CanonicalField,
  CanonicalRecord,
  CanonicalTable,
} from './canonical-base'
import type { TableAdapterResult } from './tabular-adapter-service'

/** The fetch's attachment index. */
export const NOTION_ATTACHMENT_INDEX = IMPORT_ATTACHMENT_INDEX

const SCHEMA = /^raw\/data_sources\/([^/]+)\/schema\.json$/
const QUERY_PAGE = /^raw\/data_sources\/([^/]+)\/query-\d+\.json$/
const PROPERTY_PAGE = /^raw\/data_sources\/([^/]+)\/properties\/([^/]+)\/([0-9a-f]+)-\d+\.json$/

/** What the Notion adapter reads. */
export interface NotionSnapshot {
  readonly databaseId: string
  /** The data source ids in the order the fetch read them. */
  readonly dataSourceIds: readonly string[]
  /** Every `raw/` JSON file of the snapshot, parsed, by snapshot path. */
  readonly files: ReadonlyMap<string, unknown>
}

/** The adapter's result: the base, and what the automations section reports. */
export interface NotionAdapterResult extends TableAdapterResult {
  readonly automationsNeverImportable: readonly { readonly what: string; readonly reason: string }[]
}

type Json = Readonly<Record<string, unknown>>

const objectsOf = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const plainText = (value: unknown): string =>
  objectsOf(value)
    .map((run) => (typeof run['plain_text'] === 'string' ? run['plain_text'] : ''))
    .join('')

const AUTOMATIONS_NEVER_IMPORTABLE: NotionAdapterResult['automationsNeverImportable'] = [
  {
    what: 'Notion automations',
    reason:
      'Notion exposes database automations through no API, MCP server or export, so they cannot be imported.',
  },
]

const BASE_NEVER_IMPORTABLE: CanonicalBase['neverImportable'] = [
  {
    what: 'Notion database views',
    reason:
      "Notion's API serves no view: tables, boards, calendars and their filters are not readable.",
  },
  {
    what: 'Notion page content',
    reason:
      "A row's page body is made of blocks, not properties, and the import does not convert Notion pages yet; the rows keep their properties only.",
  },
]

/** Every query row of a data source, its pages read in order, each row once. */
const rowsOf = (files: ReadonlyMap<string, unknown>, dataSourceId: string): readonly Json[] => {
  const rows = [...files.keys()]
    .filter((path) => QUERY_PAGE.exec(path)?.[1] === dataSourceId)
    .toSorted()
    .flatMap((path) => {
      const page = files.get(path)
      return objectsOf(isRecord(page) ? page['results'] : undefined)
    })
    .filter((row) => row['in_trash'] !== true && row['archived'] !== true)
  return [...new Map(rows.map((row) => [String(row['id']), row] as const)).values()]
}

/**
 * A property's full value, rebuilt from its page-property files: a list of
 * items (relation, people, title, rich text), one item (formula), or a
 * rollup's own result.
 */
const fullValueOf = (pages: readonly unknown[]): Json | undefined => {
  const [first] = pages
  if (!isRecord(first)) return undefined
  if (first['object'] === 'property_item') return first
  const item = isRecord(first['property_item']) ? first['property_item'] : undefined
  const type = item?.['type']
  if (typeof type !== 'string' || item === undefined) return undefined
  if (type === 'rollup') return { id: item['id'], type, rollup: item['rollup'] }
  const values = pages.flatMap((page) =>
    objectsOf(isRecord(page) ? page['results'] : undefined).map((result) => result[type])
  )
  return { id: item['id'], type, [type]: values }
}

/** The full values the fetch walked, by page id and then property id. */
const walkedOf = (
  files: ReadonlyMap<string, unknown>,
  dataSourceId: string
): ReadonlyMap<string, ReadonlyMap<string, Json>> => {
  const walks = [...files.keys()].toSorted().flatMap((path) => {
    const match = PROPERTY_PAGE.exec(path)
    const property = match?.[3] === undefined ? undefined : notionPropertyOfFileKey(match[3])
    return match?.[1] === dataSourceId && match[2] !== undefined && property !== undefined
      ? [{ page: match[2], property, json: files.get(path) }]
      : []
  })
  const byPage = Map.groupBy(walks, (walk) => walk.page)
  return new Map(
    [...byPage.entries()].map(([page, pageWalks]) => {
      const byProperty = Map.groupBy(pageWalks, (walk) => walk.property)
      const values = [...byProperty.entries()].flatMap(([property, files_]) => {
        const value = fullValueOf(files_.map((walk) => walk.json))
        return value === undefined ? [] : [[property, value] as const]
      })
      return [page, new Map(values)] as const
    })
  )
}

/**
 * A row's value of one property: the walked full value when there is one of
 * the property's own type, the query's value otherwise.
 */
const valueIn = (row: Json, field: Json, walked: ReadonlyMap<string, Json> | undefined) => {
  const id = String(field['id'])
  const held = walked?.get(id)
  if (held !== undefined && held['type'] === field['type']) return held
  const properties = isRecord(row['properties']) ? row['properties'] : {}
  return Object.values(properties).find((value) => isRecord(value) && value['id'] === id)
}

/** The type a computed property's values state, as the formula translator names it. */
const resultTypeOf = (rows: readonly Json[], field: Json): string | undefined =>
  rows
    .map((row) => valueIn(row, field, undefined))
    .map((value) => {
      const member = isRecord(value) ? value[String(field['type'])] : undefined
      return isRecord(member) && typeof member['type'] === 'string' ? member['type'] : undefined
    })
    .find((type) => type !== undefined && type !== 'incomplete' && type !== 'unsupported')

/** Whether any value of a `date` property carries a time of day. */
const holdsTime = (rows: readonly Json[], field: Json): boolean =>
  rows.some((row) => {
    const value = valueIn(row, field, undefined)
    const date = isRecord(value) && isRecord(value['date']) ? value['date'] : undefined
    return typeof date?.['start'] === 'string' && date['start'].includes('T')
  })

const sourceTypeOf = (rows: readonly Json[], field: Json): string => {
  const type = String(field['type'] ?? 'unknown') || 'unknown'
  return type === 'date' && holdsTime(rows, field) ? 'date_time' : type
}

const optionsOf = (rows: readonly Json[], field: Json): Json | undefined => {
  const type = String(field['type'])
  const config = isRecord(field[type]) ? field[type] : {}
  if (type !== 'formula' && type !== 'rollup') {
    return Object.keys(config).length === 0 ? undefined : config
  }
  const resultType = resultTypeOf(rows, field)
  return resultType === undefined ? config : { ...config, resultType }
}

const fieldOf = (rows: readonly Json[], field: Json): CanonicalField => {
  const options = optionsOf(rows, field)
  return {
    sourceId: String(field['id']),
    name: String(field['name'] ?? field['id']) || String(field['id']),
    sourceType: sourceTypeOf(rows, field),
    ...(options === undefined ? {} : { options }),
    ...(field['type'] === 'title' ? { primary: true } : {}),
    ...(typeof field['description'] === 'string' && field['description'] !== ''
      ? { description: field['description'] }
      : {}),
  }
}

/** The downloaded files, by the key the fetch named them with. */
const assetsOf = (files: ReadonlyMap<string, unknown>): ReadonlyMap<string, NotionAsset> =>
  attachmentIndexOf(files.get(NOTION_ATTACHMENT_INDEX))

const relationTarget = (field: Json): string | undefined => {
  const config = isRecord(field['relation']) ? field['relation'] : undefined
  return typeof config?.['data_source_id'] === 'string' ? config['data_source_id'] : undefined
}

interface Source {
  readonly id: string
  readonly name: string
  readonly properties: readonly Json[]
  readonly rows: readonly Json[]
  /** The full values the fetch walked, by page id and then property id. */
  readonly walked: ReadonlyMap<string, ReadonlyMap<string, Json>>
}

const recordOf =
  (source: Source, fields: readonly Json[], assets: ReadonlyMap<string, NotionAsset>) =>
  (row: Json): CanonicalRecord => {
    const pageId = String(row['id'])
    const values = Object.fromEntries(
      fields.flatMap((field) => {
        const target = relationTarget(field)
        const value = notionCell(valueIn(row, field, source.walked.get(pageId)), {
          pageId,
          assets,
          ...(target === undefined ? {} : { target }),
        })
        return value === undefined ? [] : [[String(field['id']), value] as const]
      })
    )
    return {
      sourceId: pageId,
      values,
      ...(typeof row['created_time'] === 'string' ? { createdAt: row['created_time'] } : {}),
    }
  }

const tableOf = (source: Source, assets: ReadonlyMap<string, NotionAsset>): CanonicalTable => {
  const fields = source.properties.filter((field) => field['type'] !== 'button')
  return {
    sourceId: source.id,
    name: source.name,
    fields: fields.map((field) => fieldOf(source.rows, field)),
    views: [],
    records: source.rows.map(recordOf(source, fields, assets)),
  }
}

/** The buttons of each data source, named as present but not readable. */
const buttonsOf = (sources: readonly Source[]): CanonicalBase['neverImportable'] =>
  sources.flatMap((source) => {
    const buttons = source.properties.filter((field) => field['type'] === 'button')
    return buttons.length === 0
      ? []
      : [
          {
            what: `Notion buttons in ${source.name}: ${buttons.map((field) => `"${String(field['name'])}"`).join(', ')}`,
            reason:
              "Present, but not readable: Notion's API exposes neither a button's actions nor a way to press it.",
          },
        ]
  })

/** The people the records name, each once by email, sorted. */
const usersOf = (sources: readonly Source[]): CanonicalBase['users'] => {
  const values = sources.flatMap((source) => [
    ...source.rows.flatMap((row) =>
      Object.values(isRecord(row['properties']) ? row['properties'] : {})
    ),
    ...[...source.walked.values()].flatMap((walked) => [...walked.values()]),
  ])
  const people = values.flatMap((value) => {
    if (!isRecord(value)) return []
    const member = value[String(value['type'])]
    return (Array.isArray(member) ? member : [member]).flatMap((user) => {
      const person = notionPersonOf(user)
      return person === undefined ? [] : [person]
    })
  })
  const unique = new Map(people.map((person) => [person.email.toLowerCase(), person] as const))
  return [...unique.values()].toSorted((a, b) => a.email.localeCompare(b.email))
}

/** The data sources in fetch order; a schema the order does not name comes last. */
const sourceIdsOf = (snapshot: NotionSnapshot): readonly string[] => {
  const held = [...snapshot.files.keys()].flatMap((path) => {
    const id = SCHEMA.exec(path)?.[1]
    return id === undefined ? [] : [id]
  })
  const ordered = snapshot.dataSourceIds.filter((id) => held.includes(id))
  return [...ordered, ...held.filter((id) => !ordered.includes(id)).toSorted()]
}

/**
 * One data source: its name as the database lists it (a database's sources
 * share its title), else its own title; its properties, rows and walked values.
 */
const sourceOf = (
  files: ReadonlyMap<string, unknown>,
  listed: ReadonlyMap<string, string>,
  id: string
): Source => {
  const schema = files.get(`raw/data_sources/${id}/schema.json`)
  const json = isRecord(schema) ? schema : {}
  const properties = isRecord(json['properties']) ? Object.values(json['properties']) : []
  return {
    id,
    name: listed.get(id) ?? (plainText(json['title']) || id),
    properties: properties.filter(isRecord),
    rows: rowsOf(files, id),
    walked: walkedOf(files, id),
  }
}

/** Read a Notion snapshot into the canonical base: one table per data source. */
export const adaptNotionSnapshot = (snapshot: NotionSnapshot): NotionAdapterResult => {
  const { files } = snapshot
  const database = files.get(`raw/databases/${snapshot.databaseId}.json`)
  const assets = assetsOf(files)
  const listed = new Map(
    objectsOf(isRecord(database) ? database['data_sources'] : undefined).flatMap((source) =>
      typeof source['id'] === 'string' &&
      typeof source['name'] === 'string' &&
      source['name'] !== ''
        ? [[source['id'], source['name']] as const]
        : []
    )
  )
  const sources = sourceIdsOf(snapshot).map((id) => sourceOf(files, listed, id))
  const tables = sources.map((source) => tableOf(source, assets))
  return {
    base: {
      tool: 'notion',
      sourceId: snapshot.databaseId,
      name: plainText(isRecord(database) ? database['title'] : undefined) || snapshot.databaseId,
      tables,
      users: usersOf(sources),
      neverImportable: [...BASE_NEVER_IMPORTABLE, ...buttonsOf(sources)],
    },
    identities: Object.fromEntries(tables.map((table) => [table.sourceId, 'source-id'] as const)),
    automationsNeverImportable: AUTOMATIONS_NEVER_IMPORTABLE,
  }
}
