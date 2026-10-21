/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Webflow CMS adapter: a Webflow snapshot in, a `CanonicalBase` out — one
 * table per CMS collection.
 *
 * It reads the files `sovrium import fetch webflow:<siteId>` wrote, already
 * parsed, by snapshot path:
 *
 * - `raw/collections.json`: the collections, in the site's order;
 * - `raw/collections/<id>/schema.json`: one collection's fields, each with its
 *   `type`, `slug` and `validations`;
 * - `raw/collections/<id>/items-NNNN.json`: the item pages, read in order,
 *   each item's values in `fieldData` keyed by field SLUG;
 * - `raw/sovrium-attachments.json`: the fetch's index of the files it
 *   downloaded, keyed by Webflow file id.
 *
 * Values are read per type, pinned under
 * `[internal ref]` (facts c4 to c6):
 *
 * - **Reference** is one item id, **MultiReference** a list of them: each
 *   becomes a link to that item of the collection `validations.collectionId`
 *   names.
 * - **Option** holds an option id: it becomes the option's name, from
 *   `validations.options`.
 * - **Image** and **File** are `{ fileId, url, alt }`, **MultiImage** a list:
 *   each becomes the file the fetch downloaded. The URL is never kept.
 * - **Color** is any CSS colour; a colour field holds `#rrggbb`, so `#rgb`,
 *   `rgb()` and `rgba()` are rewritten to it. A transparency is dropped and a
 *   colour that cannot be written so is left out; both are reported.
 * - **ExtFileRef** keeps its URL; **User** (`Person_<id>`, a site member with
 *   no Sovrium account) and any other type stay as their text.
 *
 * The type of each field is decided by the mapper, through Webflow's
 * field-type table; this adapter only translates option names into the keys
 * the mapper reads (`linkedTableId`, `choices`).
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { attachmentIndexOf, IMPORT_ATTACHMENT_INDEX } from './snapshot-manifest'
import type { AirtableAsset } from './airtable-cells-service'
import type { CanonicalField, CanonicalTable, CanonicalValue } from './canonical-base'
import type { TableAdapterResult } from './tabular-adapter-service'

/** The collection list of a Webflow snapshot. */
export const WEBFLOW_COLLECTIONS_PATH = 'raw/collections.json'

/** The fetch's attachment index. */

const ITEM_PAGE = /^raw\/collections\/([^/]+)\/items-\d+\.json$/

/** What the Webflow adapter reads. */
export interface WebflowSnapshot {
  readonly siteId: string
  /** Every `raw/` JSON file of the snapshot, parsed, by snapshot path. */
  readonly files: ReadonlyMap<string, unknown>
}

type Json = Readonly<Record<string, unknown>>
type Item = Exclude<CanonicalValue, readonly unknown[]>

const objectsOf = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const validationsOf = (field: Json): Json =>
  isRecord(field['validations']) ? field['validations'] : {}

/** The options the mapper reads, from a field's validations. */
const optionsOf = (field: Json): Readonly<Record<string, unknown>> | undefined => {
  const validations = validationsOf(field)
  const type = String(field['type'])
  if (
    (type === 'Reference' || type === 'MultiReference') &&
    typeof validations['collectionId'] === 'string'
  ) {
    return { linkedTableId: validations['collectionId'] }
  }
  if (type === 'Option') {
    return {
      choices: objectsOf(validations['options']).map((option) => ({
        name: String(option['name']),
      })),
    }
  }
  return Object.keys(validations).length === 0 ? undefined : validations
}

const fieldOf = (field: Json): CanonicalField => {
  const options = optionsOf(field)
  return {
    sourceId: String(field['slug'] ?? field['id']),
    name: String(field['displayName'] ?? field['slug'] ?? field['id']),
    sourceType: String(field['type'] ?? 'unknown') || 'unknown',
    ...(options === undefined ? {} : { options }),
    ...(field['slug'] === 'name' ? { primary: true } : {}),
    ...(typeof field['helpText'] === 'string' && field['helpText'] !== ''
      ? { description: field['helpText'] }
      : {}),
  }
}

/** The downloaded files, by Webflow file id. */
const assetsOf = (files: ReadonlyMap<string, unknown>): ReadonlyMap<string, AirtableAsset> =>
  attachmentIndexOf(files.get(IMPORT_ATTACHMENT_INDEX))

const fileOf = (value: unknown, assets: ReadonlyMap<string, AirtableAsset>): Item | undefined => {
  if (!isRecord(value) || typeof value['url'] !== 'string') return undefined
  const held = assets.get(String(value['fileId'] ?? value['url']))
  const named = value['url'].split('/').at(-1) ?? 'file'
  return {
    kind: 'attachment',
    filename: held?.filename ?? (named || 'file'),
    ...(held === undefined ? {} : { asset: held.asset }),
  }
}

const HEX6 = /^#[0-9a-f]{6}$/i
const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX8 = /^(#[0-9a-f]{6})([0-9a-f]{2})$/i
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i

const hexByte = (part: string | undefined): string =>
  Math.min(255, Number(part ?? 0))
    .toString(16)
    .padStart(2, '0')

type ColorRead = { readonly hex: string; readonly alphaDropped: boolean }

/** One way a CSS colour may be written, read as `#rrggbb`. */
const COLOR_READERS: readonly ((value: string) => ColorRead | undefined)[] = [
  (value) => (HEX6.test(value) ? { hex: value.toLowerCase(), alphaDropped: false } : undefined),
  (value) => {
    const [, r = '', g = '', b = ''] = HEX3.exec(value) ?? []
    return r === ''
      ? undefined
      : { hex: `#${r}${r}${g}${g}${b}${b}`.toLowerCase(), alphaDropped: false }
  },
  (value) => {
    const [, hex = '', alpha = ''] = HEX8.exec(value) ?? []
    return hex === ''
      ? undefined
      : { hex: hex.toLowerCase(), alphaDropped: alpha.toLowerCase() !== 'ff' }
  },
  (value) => {
    const rgb = RGB.exec(value)
    if (rgb === null) return undefined
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4])
    return {
      hex: `#${hexByte(rgb[1])}${hexByte(rgb[2])}${hexByte(rgb[3])}`,
      alphaDropped: alpha < 1,
    }
  },
]

/** A CSS colour as `#rrggbb`, whether a transparency was dropped, or `undefined`. */
export const webflowColorOf = (value: string): ColorRead | undefined =>
  COLOR_READERS.reduce<ColorRead | undefined>(
    (found, read) => found ?? read(value.trim()),
    undefined
  )

const textOf = (value: unknown): Item | undefined => {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value
  if (isRecord(value) && typeof value['url'] === 'string') return value['url']
  return value === null || value === undefined ? undefined : JSON.stringify(value)
}

interface Cells {
  readonly assets: ReadonlyMap<string, AirtableAsset>
}

const listOrNothing = (items: readonly Item[]): CanonicalValue | undefined =>
  items.length === 0 ? undefined : items

type CellReader = (raw: unknown, field: Json, cells: Cells) => CanonicalValue | undefined

const linkOf = (field: Json, id: unknown): Item | undefined =>
  typeof id === 'string' && id !== ''
    ? { kind: 'link', table: String(validationsOf(field)['collectionId'] ?? ''), record: id }
    : undefined

/** The types read otherwise than as their text, by Webflow type. */
const CELL_READERS: Readonly<Record<string, CellReader>> = {
  Reference: (raw, field) => linkOf(field, raw),
  MultiReference: (raw, field) =>
    listOrNothing((Array.isArray(raw) ? raw : []).flatMap((id) => linkOf(field, id) ?? [])),
  Option: (raw, field) => {
    const option = objectsOf(validationsOf(field)['options']).find(
      (candidate) => candidate['id'] === raw
    )
    return typeof option?.['name'] === 'string' ? option['name'] : textOf(raw)
  },
  Color: (raw) => (typeof raw === 'string' ? webflowColorOf(raw)?.hex : textOf(raw)),
  Image: (raw, _field, cells) => fileOf(raw, cells.assets),
  File: (raw, _field, cells) => fileOf(raw, cells.assets),
  MultiImage: (raw, _field, cells) =>
    listOrNothing(
      (Array.isArray(raw) ? raw : []).flatMap((file) => fileOf(file, cells.assets) ?? [])
    ),
}

/** One `fieldData` value as a canonical value, or `undefined` for an empty cell. */
const cellOf = (field: Json, raw: unknown, cells: Cells): CanonicalValue | undefined => {
  if (raw === undefined || raw === null) return undefined
  const read = CELL_READERS[String(field['type'])]
  return read === undefined ? textOf(raw) : read(raw, field, cells)
}

/** Every item of a collection, its pages read in order. */
const itemsOf = (files: ReadonlyMap<string, unknown>, collectionId: string): readonly Json[] =>
  [...files.keys()]
    .filter((path) => ITEM_PAGE.exec(path)?.[1] === collectionId)
    .toSorted()
    .flatMap((path) => {
      const page = files.get(path)
      return objectsOf(isRecord(page) ? page['items'] : undefined)
    })

const tableOf = (
  files: ReadonlyMap<string, unknown>,
  listed: Json,
  cells: Cells
): CanonicalTable => {
  const id = String(listed['id'])
  const schema = files.get(`raw/collections/${id}/schema.json`)
  const described = isRecord(schema) ? schema : listed
  const fields = objectsOf(described['fields'])
  const records = itemsOf(files, id).map((item) => {
    const data = isRecord(item['fieldData']) ? item['fieldData'] : {}
    const values = Object.fromEntries(
      fields.flatMap((field) => {
        const value = cellOf(field, data[String(field['slug'])], cells)
        return value === undefined ? [] : [[String(field['slug'] ?? field['id']), value] as const]
      })
    )
    return {
      sourceId: String(item['id']),
      values,
      ...(typeof item['createdOn'] === 'string' ? { createdAt: item['createdOn'] } : {}),
    }
  })
  return {
    sourceId: id,
    name: String(described['displayName'] ?? listed['displayName'] ?? id),
    fields: fields.map(fieldOf),
    views: [],
    records,
  }
}

type Note = NonNullable<TableAdapterResult['notes']>[number]

/** What colour rewriting lost, per Color field: a note each, naming the values. */
const colorNotes = (files: ReadonlyMap<string, unknown>, listed: Json): readonly Note[] => {
  const id = String(listed['id'])
  const schema = files.get(`raw/collections/${id}/schema.json`)
  const described = isRecord(schema) ? schema : listed
  const table = String(described['displayName'] ?? id)
  const items = itemsOf(files, id)
  return objectsOf(described['fields'])
    .filter((field) => field['type'] === 'Color')
    .flatMap((field) => {
      const values = items.flatMap((item) => {
        const value = isRecord(item['fieldData'])
          ? item['fieldData'][String(field['slug'])]
          : undefined
        return typeof value === 'string' && value !== '' ? [value] : []
      })
      const dropped = values.filter((value) => webflowColorOf(value) === undefined)
      const faded = values.filter((value) => webflowColorOf(value)?.alphaDropped === true)
      const source = `${table}.${String(field['displayName'] ?? field['slug'])}`
      return [
        ...(faded.length === 0
          ? []
          : [
              {
                domain: 'data' as const,
                source,
                kind: 'other' as const,
                reason: `A colour field holds no transparency: ${faded.join(', ')} kept its colour without it.`,
                fallback: '#rrggbb',
              },
            ]),
        ...(dropped.length === 0
          ? []
          : [
              {
                domain: 'data' as const,
                source,
                kind: 'other' as const,
                reason: `A colour field holds #rrggbb only: ${dropped.join(', ')} could not be written so and was left out.`,
              },
            ]),
      ]
    })
}

/** Read a Webflow CMS snapshot into the canonical base. */
export const adaptWebflowSnapshot = (snapshot: WebflowSnapshot): TableAdapterResult => {
  const listing = snapshot.files.get(WEBFLOW_COLLECTIONS_PATH)
  const cells = { assets: assetsOf(snapshot.files) }
  const collections = objectsOf(isRecord(listing) ? listing['collections'] : undefined)
  const tables = collections.map((listed) => tableOf(snapshot.files, listed, cells))
  return {
    base: {
      tool: 'webflow',
      sourceId: snapshot.siteId,
      name: snapshot.siteId,
      tables,
      users: [],
      neverImportable: [],
    },
    identities: Object.fromEntries(tables.map((table) => [table.sourceId, 'source-id'] as const)),
    notes: collections.flatMap((listed) => colorNotes(snapshot.files, listed)),
  }
}
