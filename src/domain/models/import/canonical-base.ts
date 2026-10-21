/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `CanonicalBase` — the one shape every table source is parsed into.
 *
 * ## N sources, one mapper
 *
 * Airtable, Notion, Google Sheets, CSV and XLSX, Baserow, Retool Database,
 * Webflow CMS and Zapier Tables each get a pure adapter that turns what the
 * snapshot holds into this shape. ONE mapper then turns this shape into
 * `tables[]` entries and seed files. An adapter never writes Sovrium config
 * itself, so there is one set of mapping rules, not nine.
 *
 * ## The source's words are kept, not translated
 *
 * A field keeps its `sourceType` and its `options` exactly as the source states
 * them. Translating is the mapper's job, through the committed mapping table
 * (`field-type-mappings.ts`): an adapter that pre-translated would hide a lossy
 * mapping inside a parser, where the report cannot see it.
 *
 * ## Identity
 *
 * Every table, field, view and record carries the source's own id. A record's
 * `sourceId` becomes its seed `key` and its `source_id` column, so links
 * resolve through the seed's `@table.key` references and a re-import merges on
 * the same rows rather than duplicating them.
 */

import { Schema } from 'effect'
import { ImportSourceToolSchema } from './import-source'

/** A link from one record to another, by the source ids of both. */
export const CanonicalLinkSchema = Schema.Struct({
  kind: Schema.Literal('link').annotate({ description: 'A link to another record' }),
  table: Schema.String.annotate({ description: "The linked table's source id" }),
  record: Schema.String.annotate({ description: "The linked record's source id" }),
}).annotate({
  identifier: 'CanonicalLink',
  description: 'A reference to another record of the same base.',
})

/** An attachment, already downloaded into the snapshot's `assets/` folder. */
export const CanonicalAttachmentSchema = Schema.Struct({
  kind: Schema.Literal('attachment').annotate({ description: 'A file attached to a record' }),
  asset: Schema.optional(
    Schema.String.annotate({
      description:
        'The file inside the snapshot, `assets/<sha256>.<ext>`; absent when the attachment was skipped or its URL refused',
    }).check(Schema.isPattern(/^assets\/[0-9a-f]{64}(?:\.[A-Za-z0-9]+)?$/))
  ),
  filename: Schema.String.annotate({ description: 'The file name the source showed' }),
  mimeType: Schema.optional(
    Schema.String.annotate({ description: 'The media type the source declared' })
  ),
}).annotate({
  identifier: 'CanonicalAttachment',
  description: 'One attachment of a record, by its place in the snapshot.',
})

/** A collaborator, by email: it becomes a `user` value and a seeded account. */
export const CanonicalUserRefSchema = Schema.Struct({
  kind: Schema.Literal('user').annotate({ description: 'A collaborator of the source tool' }),
  email: Schema.String.annotate({ description: "The collaborator's email address" }).check(
    Schema.isPattern(/^[^\s@]+@[^\s@]+$/)
  ),
}).annotate({
  identifier: 'CanonicalUserRef',
  description: 'A collaborator named in a record, by email.',
})

/** A plain value: text, a finite number, a boolean, or nothing. */
export const CanonicalScalarSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]).annotate({
  identifier: 'CanonicalScalar',
  description: 'A plain cell value. Dates are ISO 8601 strings, as the source served them.',
})

const CanonicalItemSchema = Schema.Union([
  CanonicalScalarSchema,
  CanonicalLinkSchema,
  CanonicalAttachmentSchema,
  CanonicalUserRefSchema,
])

/** One cell: a scalar, a link, an attachment, a user, or a list of them. */
export const CanonicalValueSchema = Schema.Union([
  CanonicalItemSchema,
  Schema.Array(CanonicalItemSchema),
]).annotate({
  identifier: 'CanonicalValue',
  description:
    'The value of one field of one record. A multiple-select, a multi-link or an attachment list is an array.',
})

export type CanonicalValue = Schema.Schema.Type<typeof CanonicalValueSchema>

/** One field (column) of a source table. */
export const CanonicalFieldSchema = Schema.Struct({
  sourceId: Schema.String.annotate({ description: "The field's id in the source" }),
  name: Schema.String.annotate({ description: 'The field name the source showed' }).check(
    Schema.isMinLength(1)
  ),
  sourceType: Schema.String.annotate({
    description:
      "The field type in the source's own words, the key of the mapping table (`multipleRecordLinks`, `rich_text`, an inferred `decimal`)",
  }).check(Schema.isMinLength(1)),
  options: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        "The source's type options, verbatim: select choices, number precision, a link's target table, a formula's text",
    })
  ),
  primary: Schema.optional(
    Schema.Boolean.annotate({ description: "Whether this is the source table's primary field" })
  ),
  description: Schema.optional(
    Schema.String.annotate({ description: 'The help text the source attached to the field' })
  ),
}).annotate({
  identifier: 'CanonicalField',
  description: 'One field of a source table, in the source’s own words.',
})

export type CanonicalField = Schema.Schema.Type<typeof CanonicalFieldSchema>

/** A view of a source table: its kind, and for a grid its filters and sorts. */
export const CanonicalViewSchema = Schema.Struct({
  sourceId: Schema.String.annotate({ description: "The view's id in the source" }),
  name: Schema.String.annotate({ description: 'The view name the source showed' }),
  kind: Schema.Literals([
    'grid',
    'kanban',
    'calendar',
    'gallery',
    'form',
    'list',
    'timeline',
    'other',
  ]).annotate({
    description:
      'What the view shows. Only a grid maps to a table view; every other kind, a form view included, is reported and not imported',
  }),
  filters: Schema.Array(
    Schema.Struct({
      field: Schema.String.annotate({ description: "The filtered field's source id" }),
      operator: Schema.String.annotate({
        description: "The filter operator in the source's own words",
      }),
      value: Schema.optional(Schema.Unknown.annotate({ description: 'The filter operand' })),
    })
  ).annotate({ description: 'The filters, all of which must hold' }),
  sorts: Schema.Array(
    Schema.Struct({
      field: Schema.String.annotate({ description: "The sorted field's source id" }),
      direction: Schema.Literals(['asc', 'desc']).annotate({ description: 'The sort order' }),
    })
  ).annotate({ description: 'The sorts, first one first' }),
  visibleFields: Schema.Array(Schema.String).annotate({
    description: 'The source ids of the fields the view shows, in order',
  }),
}).annotate({
  identifier: 'CanonicalView',
  description: 'One saved view of a source table.',
})

/** One record (row) of a source table. */
export const CanonicalRecordSchema = Schema.Struct({
  sourceId: Schema.String.annotate({
    description: "The record's id in the source; its seed key and its `source_id` value",
  }).check(Schema.isMinLength(1)),
  values: Schema.Record(Schema.String, CanonicalValueSchema).annotate({
    description: 'The cell values, keyed by field source id. An empty cell is absent',
  }),
  createdAt: Schema.optional(
    Schema.String.annotate({ description: 'When the source created the record, ISO 8601' })
  ),
}).annotate({
  identifier: 'CanonicalRecord',
  description: 'One record of a source table, its values keyed by field.',
})

export type CanonicalRecord = Schema.Schema.Type<typeof CanonicalRecordSchema>

/** One source table: its fields, its views and its records. */
export const CanonicalTableSchema = Schema.Struct({
  sourceId: Schema.String.annotate({ description: "The table's id in the source" }),
  name: Schema.String.annotate({ description: 'The table name the source showed' }).check(
    Schema.isMinLength(1)
  ),
  fields: Schema.Array(CanonicalFieldSchema).annotate({
    description: 'The fields, in the order the source listed them',
  }),
  views: Schema.Array(CanonicalViewSchema).annotate({ description: 'The saved views' }),
  records: Schema.Array(CanonicalRecordSchema).annotate({
    description: 'The records, in the order the source served them',
  }),
}).annotate({
  identifier: 'CanonicalTable',
  description: 'One table of a source base.',
})

export type CanonicalTable = Schema.Schema.Type<typeof CanonicalTableSchema>

/** Something the source holds that no adapter can ever read. */
export const NeverImportableSchema = Schema.Struct({
  what: Schema.String.annotate({
    description: 'What the source holds, as the source names it',
    examples: ['Airtable automations', 'Airtable Interfaces', 'Zapier Interfaces'],
  }),
  reason: Schema.String.annotate({ description: 'Why no export or API exposes it' }),
}).annotate({
  identifier: 'NeverImportable',
  description: 'A part of the source app that no export file and no API exposes.',
})

/** The decoded result of one table-source adapter. */
export const CanonicalBaseSchema = Schema.Struct({
  tool: ImportSourceToolSchema,
  sourceId: Schema.String.annotate({
    description: 'The base, database, spreadsheet, site or file the tables came from',
  }),
  name: Schema.String.annotate({ description: 'Its name in the source' }),
  tables: Schema.Array(CanonicalTableSchema).annotate({ description: 'The tables it holds' }),
  users: Schema.Array(
    Schema.Struct({
      email: Schema.String.annotate({ description: "The collaborator's email address" }),
      name: Schema.optional(Schema.String.annotate({ description: "The collaborator's name" })),
    })
  ).annotate({
    description:
      'The collaborators the records name, each once. They become seeded accounts with no password and no invitation',
  }),
  neverImportable: Schema.Array(NeverImportableSchema).annotate({
    description: 'What the source holds that cannot be read at all',
  }),
}).annotate({
  identifier: 'CanonicalBase',
  title: 'Canonical Base',
  description:
    'The intermediate model of a migrated base: what a table-source adapter produces and the one table mapper reads.',
})

export type CanonicalBase = Schema.Schema.Type<typeof CanonicalBaseSchema>
