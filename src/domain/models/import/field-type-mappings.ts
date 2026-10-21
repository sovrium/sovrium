/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The field-type tables: one per table source, source type → Sovrium field type.
 *
 * ## The table is the whole rule
 *
 * A source field becomes a Sovrium field only through its tool's table here.
 * A source type the table does not list becomes `long-text`, its values kept
 * as text, and the report names the field and its source type. Nothing is
 * approximated into the nearest type that would validate: a mapping that loses
 * something says what in `loss`, and the report prints it as `degraded`.
 *
 * ## Typed against the real catalogue
 *
 * `sovrium` is typed as `FieldType`, the union the table schema itself
 * accepts, so a target that is not a Sovrium field type does not compile.
 *
 * ## Inferred types
 *
 * CSV, XLSX, Google Sheets and Zapier Tables carry no schema. Their columns are
 * typed by inference from the values (and, for Sheets, from `numberFormat` and
 * `dataValidation`), and the inferred kind is the source type looked up here.
 * Inference is shared, so the four tools share one table.
 *
 * Source type names are as each tool's API or export spells them, pinned
 * against the fixtures under `[internal ref]<tool>/`.
 */

import type { ImportSourceTool } from './import-source'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/** One row of a field-type table. */
export interface FieldTypeMapping {
  /** The source type, in the tool's own spelling. */
  readonly source: string
  /** The Sovrium field type it becomes. */
  readonly sovrium: FieldType
  /** What the mapping loses, when it loses something; printed as `degraded`. */
  readonly loss?: string
}

/** The tools whose tables become Sovrium tables. */
export type TableSourceTool = Extract<
  ImportSourceTool,
  | 'airtable'
  | 'notion'
  | 'google-sheets'
  | 'csv'
  | 'xlsx'
  | 'baserow'
  | 'retool-database'
  | 'webflow'
  | 'zapier-tables'
  | 'zite'
>

/** The type an unlisted source type becomes; its values are kept as text. */
export const UNMAPPED_FIELD_TYPE: FieldType = 'long-text'

/** The name of the column every imported table gains, holding the source record id. */
export const SOURCE_ID_FIELD = 'source_id'

/**
 * The kinds inference assigns to a column of a schemaless source, in the order
 * inference tries them. A column is the first kind every non-empty value fits.
 */
export const INFERRED_KINDS = [
  'boolean',
  'integer',
  'decimal',
  'percent',
  'currency',
  'date',
  'datetime',
  'time',
  'email',
  'url',
  'list-validation',
  'checkbox-validation',
  'multiline-text',
  'text',
] as const

const INFERRED: readonly FieldTypeMapping[] = [
  { source: 'boolean', sovrium: 'checkbox' },
  { source: 'integer', sovrium: 'integer' },
  { source: 'decimal', sovrium: 'decimal' },
  { source: 'percent', sovrium: 'percentage' },
  { source: 'currency', sovrium: 'currency' },
  { source: 'date', sovrium: 'date' },
  { source: 'datetime', sovrium: 'datetime' },
  { source: 'time', sovrium: 'time' },
  { source: 'email', sovrium: 'email' },
  { source: 'url', sovrium: 'url' },
  { source: 'list-validation', sovrium: 'single-select' },
  { source: 'checkbox-validation', sovrium: 'checkbox' },
  { source: 'multiline-text', sovrium: 'long-text' },
  { source: 'text', sovrium: 'single-line-text' },
]

const AIRTABLE: readonly FieldTypeMapping[] = [
  { source: 'singleLineText', sovrium: 'single-line-text' },
  { source: 'multilineText', sovrium: 'long-text' },
  {
    source: 'richText',
    sovrium: 'rich-text',
    loss: 'Airtable rich text is Markdown; it is converted to the HTML subset a rich-text field keeps',
  },
  { source: 'email', sovrium: 'email' },
  { source: 'url', sovrium: 'url' },
  { source: 'phoneNumber', sovrium: 'phone-number' },
  { source: 'number', sovrium: 'number' },
  { source: 'percent', sovrium: 'percentage' },
  { source: 'currency', sovrium: 'currency' },
  { source: 'rating', sovrium: 'rating' },
  { source: 'duration', sovrium: 'duration' },
  { source: 'checkbox', sovrium: 'checkbox' },
  { source: 'singleSelect', sovrium: 'single-select' },
  { source: 'multipleSelects', sovrium: 'multi-select' },
  { source: 'date', sovrium: 'date' },
  { source: 'dateTime', sovrium: 'datetime' },
  { source: 'multipleRecordLinks', sovrium: 'relationship' },
  { source: 'multipleLookupValues', sovrium: 'lookup' },
  {
    source: 'rollup',
    sovrium: 'rollup',
    loss: "Airtable does not expose a rollup's formula; the aggregation is read from its options when stated, otherwise the field keeps its last values",
  },
  { source: 'count', sovrium: 'count' },
  {
    source: 'formula',
    sovrium: 'formula',
    loss: 'A formula that does not translate becomes a field of its result type holding the last computed values, its original text quoted in the report',
  },
  { source: 'autoNumber', sovrium: 'autonumber' },
  { source: 'barcode', sovrium: 'barcode' },
  { source: 'multipleAttachments', sovrium: 'multiple-attachments' },
  { source: 'singleCollaborator', sovrium: 'user' },
  { source: 'multipleCollaborators', sovrium: 'user' },
  {
    source: 'createdTime',
    sovrium: 'created-at',
    loss: "The creation instant comes from the source record's createdTime",
  },
  {
    source: 'lastModifiedTime',
    sovrium: 'updated-at',
    loss: "Sovrium keeps this time itself: it starts at the moment of the import, then follows each later change. The source's last-modified time is not kept",
  },
  {
    source: 'createdBy',
    sovrium: 'created-by',
    loss: 'A system column: it names the account that ran the seed',
  },
  {
    source: 'lastModifiedBy',
    sovrium: 'updated-by',
    loss: 'A system column: it names the account that ran the seed',
  },
  {
    source: 'button',
    sovrium: 'button',
    loss: "Only an 'open URL' button maps; a button that runs an Airtable script becomes a TODO",
  },
]

const NOTION: readonly FieldTypeMapping[] = [
  { source: 'title', sovrium: 'single-line-text' },
  {
    source: 'rich_text',
    sovrium: 'long-text',
    loss: 'Notion annotations (bold, colour, mentions) are dropped; the plain text is kept',
  },
  { source: 'number', sovrium: 'number' },
  { source: 'select', sovrium: 'single-select' },
  { source: 'multi_select', sovrium: 'multi-select' },
  { source: 'status', sovrium: 'status' },
  { source: 'date', sovrium: 'date', loss: 'A date range keeps its start' },
  /** A `date` property whose values carry a time of day, as the adapter reads it. */
  { source: 'date_time', sovrium: 'datetime', loss: 'A date range keeps its start' },
  { source: 'people', sovrium: 'user' },
  { source: 'files', sovrium: 'multiple-attachments' },
  { source: 'checkbox', sovrium: 'checkbox' },
  { source: 'url', sovrium: 'url' },
  { source: 'email', sovrium: 'email' },
  { source: 'phone_number', sovrium: 'phone-number' },
  {
    source: 'formula',
    sovrium: 'formula',
    loss: 'A formula that does not translate becomes a field of its result type holding the last computed values, its original expression quoted in the report',
  },
  { source: 'relation', sovrium: 'relationship' },
  { source: 'rollup', sovrium: 'rollup' },
  { source: 'created_time', sovrium: 'created-at' },
  {
    source: 'created_by',
    sovrium: 'created-by',
    loss: 'A system column: it names the account that ran the seed',
  },
  {
    source: 'last_edited_time',
    sovrium: 'updated-at',
    loss: "Sovrium keeps this time itself: it starts at the moment of the import, then follows each later change. The source's last-modified time is not kept",
  },
  {
    source: 'last_edited_by',
    sovrium: 'updated-by',
    loss: 'A system column: it names the account that ran the seed',
  },
  {
    source: 'unique_id',
    sovrium: 'autonumber',
    loss: "The id's text prefix is dropped; the number is kept",
  },
]

/**
 * Baserow, as its export and API type fields. A `date` field that keeps a
 * time is typed by its own option name, `date_include_time`, so its time of
 * day is not cut off.
 */
const BASEROW: readonly FieldTypeMapping[] = [
  { source: 'text', sovrium: 'single-line-text' },
  { source: 'long_text', sovrium: 'long-text' },
  { source: 'url', sovrium: 'url' },
  { source: 'email', sovrium: 'email' },
  { source: 'phone_number', sovrium: 'phone-number' },
  { source: 'number', sovrium: 'number' },
  { source: 'rating', sovrium: 'rating' },
  { source: 'boolean', sovrium: 'checkbox' },
  { source: 'date', sovrium: 'date' },
  { source: 'date_include_time', sovrium: 'datetime' },
  { source: 'duration', sovrium: 'duration' },
  { source: 'single_select', sovrium: 'single-select' },
  { source: 'multiple_select', sovrium: 'multi-select' },
  { source: 'link_row', sovrium: 'relationship' },
  { source: 'lookup', sovrium: 'lookup' },
  { source: 'rollup', sovrium: 'rollup' },
  { source: 'count', sovrium: 'count' },
  {
    source: 'formula',
    sovrium: 'formula',
    loss: 'A formula that does not translate becomes a field of its result type holding the last computed values, its original text quoted in the report',
  },
  { source: 'autonumber', sovrium: 'autonumber' },
  { source: 'file', sovrium: 'multiple-attachments' },
  { source: 'multiple_collaborators', sovrium: 'user' },
  { source: 'created_on', sovrium: 'created-at' },
  {
    source: 'last_modified',
    sovrium: 'updated-at',
    loss: "Sovrium keeps this time itself: it starts at the moment of the import, then follows each later change. The source's last-modified time is not kept",
  },
  {
    source: 'created_by',
    sovrium: 'created-by',
    loss: 'A system column: it names the account that ran the seed',
  },
  {
    source: 'last_modified_by',
    sovrium: 'updated-by',
    loss: 'A system column: it names the account that ran the seed',
  },
  { source: 'uuid', sovrium: 'single-line-text' },
]

/**
 * Retool Database, by PostgreSQL `data_type`. A column holding a one-column
 * foreign key is typed by its constraint, `FOREIGN KEY`, whatever its type.
 */
const RETOOL_DATABASE: readonly FieldTypeMapping[] = [
  { source: 'text', sovrium: 'single-line-text' },
  { source: 'character varying', sovrium: 'single-line-text' },
  { source: 'character', sovrium: 'single-line-text' },
  { source: 'uuid', sovrium: 'single-line-text' },
  { source: 'smallint', sovrium: 'integer' },
  { source: 'integer', sovrium: 'integer' },
  { source: 'bigint', sovrium: 'integer' },
  { source: 'numeric', sovrium: 'decimal' },
  { source: 'real', sovrium: 'decimal' },
  { source: 'double precision', sovrium: 'decimal' },
  { source: 'boolean', sovrium: 'checkbox' },
  { source: 'date', sovrium: 'date' },
  { source: 'timestamp without time zone', sovrium: 'datetime' },
  { source: 'timestamp with time zone', sovrium: 'datetime' },
  { source: 'time without time zone', sovrium: 'time' },
  { source: 'interval', sovrium: 'duration' },
  { source: 'json', sovrium: 'json' },
  { source: 'jsonb', sovrium: 'json' },
  { source: 'ARRAY', sovrium: 'array' },
  { source: 'FOREIGN KEY', sovrium: 'relationship' },
]

/**
 * Webflow CMS, as its Data API v2 types fields. The collection CSV carries no
 * type and is read through the shared inference instead. A `User` field names a
 * Webflow site member, which has no Sovrium account, so it is left unlisted and
 * kept as text.
 */
const WEBFLOW: readonly FieldTypeMapping[] = [
  { source: 'PlainText', sovrium: 'single-line-text' },
  { source: 'RichText', sovrium: 'rich-text' },
  { source: 'Image', sovrium: 'single-attachment' },
  { source: 'MultiImage', sovrium: 'multiple-attachments' },
  { source: 'File', sovrium: 'single-attachment' },
  { source: 'VideoLink', sovrium: 'url' },
  {
    source: 'ExtFileRef',
    sovrium: 'url',
    loss: 'An external file reference keeps its URL; the file it points at is not downloaded',
  },
  { source: 'Link', sovrium: 'url' },
  { source: 'Email', sovrium: 'email' },
  { source: 'Phone', sovrium: 'phone-number' },
  { source: 'Number', sovrium: 'number' },
  { source: 'DateTime', sovrium: 'datetime' },
  { source: 'Switch', sovrium: 'checkbox' },
  { source: 'Color', sovrium: 'color' },
  { source: 'Option', sovrium: 'single-select' },
  { source: 'Reference', sovrium: 'relationship' },
  { source: 'MultiReference', sovrium: 'relationship' },
]

/**
 * Zite databases, as the Zite Database API types fields. Every row is read in
 * Zite's own documentation (its OpenAPI `FieldType` enum, plus `formula` from
 * its field-types page) but not yet observed in a live capture, which re-pins
 * the table. Left unlisted, so kept as text and reported: `source`, a
 * system-set provenance object with no Sovrium equivalent, and the
 * platform-managed types (`rich_text`, `rollup`, `created_at`, `updated_at`,
 * `updated_by`, `user`) no field list is known to return. `duration` is total
 * seconds, as Sovrium stores it.
 */
const ZITE: readonly FieldTypeMapping[] = [
  { source: 'single_line_text', sovrium: 'single-line-text' },
  { source: 'long_text', sovrium: 'long-text' },
  { source: 'email', sovrium: 'email' },
  { source: 'url', sovrium: 'url' },
  { source: 'phone_number', sovrium: 'phone-number' },
  { source: 'number', sovrium: 'number' },
  { source: 'currency', sovrium: 'currency' },
  { source: 'percent', sovrium: 'percentage' },
  { source: 'rating', sovrium: 'rating' },
  { source: 'duration', sovrium: 'duration' },
  { source: 'single_select', sovrium: 'single-select' },
  { source: 'multiple_select', sovrium: 'multi-select' },
  { source: 'checkbox', sovrium: 'checkbox' },
  { source: 'date', sovrium: 'date' },
  { source: 'datetime', sovrium: 'datetime' },
  { source: 'attachments', sovrium: 'multiple-attachments' },
  { source: 'linked_record', sovrium: 'relationship' },
  { source: 'lookup', sovrium: 'lookup' },
  { source: 'autonumber', sovrium: 'autonumber' },
  {
    source: 'formula',
    sovrium: 'formula',
    loss: 'Zite formulas are not translated yet: the field keeps its last computed values, its original expression quoted in the report',
  },
]

/** Every table source's field-type table. */
export const FIELD_TYPE_MAPPINGS: Readonly<Record<TableSourceTool, readonly FieldTypeMapping[]>> = {
  airtable: AIRTABLE,
  notion: NOTION,
  'google-sheets': INFERRED,
  csv: INFERRED,
  xlsx: INFERRED,
  baserow: BASEROW,
  'retool-database': RETOOL_DATABASE,
  webflow: WEBFLOW,
  'zapier-tables': INFERRED,
  zite: ZITE,
}

/** The outcome of looking one source type up. */
export type FieldTypeLookup =
  | { readonly outcome: 'mapped'; readonly sovrium: FieldType }
  | { readonly outcome: 'degraded'; readonly sovrium: FieldType; readonly reason: string }
  | { readonly outcome: 'unmapped'; readonly sovrium: FieldType }

/**
 * Look a source type up in its tool's table.
 *
 * An unlisted type is `unmapped` and falls back to {@link UNMAPPED_FIELD_TYPE};
 * the report names it. A listed type with a `loss` is `degraded`.
 */
export const lookupFieldType = (tool: TableSourceTool, sourceType: string): FieldTypeLookup => {
  const row = FIELD_TYPE_MAPPINGS[tool].find((mapping) => mapping.source === sourceType)
  if (row === undefined) return { outcome: 'unmapped', sovrium: UNMAPPED_FIELD_TYPE }
  if (row.loss !== undefined) return { outcome: 'degraded', sovrium: row.sovrium, reason: row.loss }
  return { outcome: 'mapped', sovrium: row.sovrium }
}
