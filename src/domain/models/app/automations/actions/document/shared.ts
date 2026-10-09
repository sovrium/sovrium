/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AssetPathSchema } from '../../../asset-path'
import { type TemplateContext, TemplateStringSchema, templateBodySchema } from '../../template'

/**
 * The contracts every `document/*` and `pdf/*` action shares, and that
 * `email/send` reuses for its template and its attachments.
 *
 * One input road (`TemplateSource`, `FileRef`) and one output road
 * (`DocumentOutput`) for every generated file, so the security review has one
 * of each to audit.
 */

// ─── Template sources ──────────────────────────────────────────────────────

/** `{ asset }` — a private file declared in the top-level `assets` list. */
const AssetSourceSchema = Schema.Struct({
  asset: AssetPathSchema.pipe(
    Schema.annotate({
      description:
        "Path of a file declared in the top-level `assets` list (e.g. 'templates/invoice.html'). Shipped with the config and never served.",
    })
  ),
})

/** `{ key, bucket? }` — a file stored in a bucket, replaceable at run time. */
const BucketSourceSchema = Schema.Struct({
  key: TemplateStringSchema.pipe(
    Schema.annotate({ description: 'Storage key of the file (supports template variables)' })
  ),
  bucket: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Declared bucket holding the file. A template read from a bucket is treated as written by whoever may upload to it.',
      })
    )
  ),
})

/**
 * Where an action reads its template from.
 *
 * `inline` is template TEXT, so it carries the `templateContext` annotation:
 * the run's generic pass leaves it alone and the action renders it with the
 * escaping its output needs. `asset` and `key` are addresses, resolved like
 * any prop.
 */
export const templateSourceSchema = (context: TemplateContext) =>
  Schema.Union([
    AssetSourceSchema,
    BucketSourceSchema,
    Schema.Struct({ inline: templateBodySchema(context) }),
  ]).pipe(
    Schema.annotate({
      title: 'Template Source',
      description:
        'Where the template is read from: { asset: <path> } (a private file in `assets`), { key, bucket? } (a file in a bucket), or { inline: <text> } (written in the config). It reads the action `data` only.',
    })
  )

/** A text template whose output is HTML (HTML or SVG documents, email bodies). */
export const HtmlTemplateSourceSchema = templateSourceSchema('html')

/**
 * Where a BINARY template (`.docx`) is read from: an asset or a bucket file —
 * a binary template cannot be written inline.
 */
export const BinaryTemplateSourceSchema = Schema.Union([
  AssetSourceSchema,
  BucketSourceSchema,
]).pipe(
  Schema.annotate({
    title: 'Binary Template Source',
    description:
      'Where a binary template (a .docx) is read from: { asset: <path> } or { key, bucket? }.',
  })
)

/**
 * The template's whole context.
 *
 * NOT annotated as template text: `data` is resolved by the run's generic pass
 * like any prop, which is how it receives the run's values —
 * `'{{steps.fetchLines.result}}'` stays the array it names.
 */
export const TemplateDataSchema = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.annotate({
    description:
      'Values the template reads by name ({{invoice.number}}). Resolved like any prop, so "{{steps.fetchLines.result}}" stays an array. The template sees these values and nothing else.',
  })
)

/** Whether a render may fetch remote sub-resources, through the guarded egress. */
export const AllowRemoteAssetsSchema = Schema.Boolean.pipe(
  Schema.annotate({
    defaultNote: 'false',
    description:
      'Allow the template to load remote images, fonts and stylesheets. Off by default: only `assets` and inline data: URLs load. When on, the engine fetches each URL through the guarded egress, which refuses private-network addresses unless the operator allows them.',
  })
)

/**
 * The language a template renders in: which `languages.translations` entry
 * `{{t 'key'}}` reads, and the locale dates, numbers and amounts are
 * formatted in.
 *
 * A literal must be a declared language code (checked with the app-level
 * rules); a templated value resolving to an undeclared code renders in the
 * default language rather than failing the step.
 */
export const TemplateLocaleSchema = TemplateStringSchema.pipe(
  Schema.annotate({
    defaultNote: 'the default language of `languages`',
    description:
      "Language the template renders in: a code declared in `languages.supported` (e.g. 'fr'), or a template resolving to one (e.g. '{{trigger.data.lang}}'). It picks the translations {{t 'key'}} prints and the locale dates, numbers and amounts are formatted in.",
  })
)

// ─── File references ───────────────────────────────────────────────────────

/** `{ record }` — the file held in a record's attachment field. */
const RecordFileRefSchema = Schema.Struct({
  record: Schema.Struct({
    table: Schema.String.pipe(Schema.annotate({ description: 'Table holding the record' })),
    id: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Record id (supports template variables)' })
    ),
    field: Schema.String.pipe(
      Schema.annotate({
        description: 'Attachment field (single-attachment or multiple-attachments)',
      })
    ),
    index: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          defaultNote: '0',
          description: 'Which file of a multiple-attachments field, counting from 0',
        }),
        Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isInt())
      )
    ),
  }).pipe(Schema.annotate({ description: "The file in a record's attachment field" })),
})

/**
 * A file an action reads.
 *
 * The same six forms everywhere a file is an input — a `pdf/merge` input, an
 * email attachment — so an author learns one vocabulary.
 */
export const FileRefSchema = Schema.Union([
  TemplateStringSchema.pipe(Schema.annotate({ description: 'A storage key' })),
  Schema.Struct({
    key: TemplateStringSchema.pipe(Schema.annotate({ description: 'Storage key of the file' })),
    bucket: Schema.String.pipe(
      Schema.annotate({ description: 'Declared bucket holding the file' })
    ),
  }),
  Schema.Struct({
    step: Schema.String.pipe(
      Schema.annotate({ description: 'Name of a previous step whose output is the file' })
    ),
  }),
  AssetSourceSchema,
  RecordFileRefSchema,
  Schema.Struct({
    url: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'URL fetched through the guarded egress, with a timeout and a size cap; private-network addresses are refused unless the operator allows them',
      })
    ),
  }),
]).pipe(
  Schema.annotate({
    identifier: 'FileRef',
    title: 'File Reference',
    description:
      "A file an action reads: a storage key, { key, bucket }, { step: <name> } (a previous step's file), { asset: <path> }, { record: { table, id, field, index? } } or { url }.",
  })
)

/** @public */
export type FileRef = Schema.Schema.Type<typeof FileRefSchema>

/**
 * A list of files: written out, or one template resolving to a list at run
 * time (a loop's outputs), which is why the second form exists.
 */
export const fileRefListSchema = <S extends Schema.Top>(item: S) =>
  Schema.Union([
    Schema.Array(item).pipe(
      Schema.annotate({ description: 'The files, in order' }),
      Schema.check(Schema.isMinLength(1))
    ),
    TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'One template resolving to a list of files at run time (e.g. "{{steps.renderLabels.results}}")',
      })
    ),
  ])

// ─── Output ────────────────────────────────────────────────────────────────

/** What happens when a file already sits at the output key. */
export const IF_EXISTS_POLICIES = ['overwrite', 'suffix', 'skip', 'fail'] as const

/**
 * Where a generated file is written.
 *
 * - no `attachTo` → temporary: under `tmp/automations/` (a `key` is placed
 *   under that prefix), in no bucket, served by no route, swept after
 *   `STORAGE_TEMP_CLEANUP_AFTER`; a `bucket` without `attachTo` is refused by
 *   `validate`;
 * - `attachTo` → into the record's attachment field, in THE FIELD's bucket
 *   (`system` when the column names none); a different explicit `bucket` is
 *   refused by `validate`. An attached file is erased with its record.
 *
 * `overwrite` and `skip` only take a file this automation generated.
 */
export const DocumentOutputSchema = Schema.Struct({
  filename: TemplateStringSchema.pipe(
    Schema.annotate({
      description: 'Name of the file, with its extension (supports template variables)',
    })
  ),
  bucket: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The bucket of the attachTo field, which it must match; refused without attachTo. Without attachTo the file is temporary and belongs to no bucket.',
      })
    )
  ),
  key: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Storage key to write at. A temporary file is written under tmp/automations/ (exports/a.xlsx becomes tmp/automations/exports/a.xlsx). Without it the key is <uuid>-<filename> in the field bucket, or a temporary key.',
      })
    )
  ),
  ifExists: Schema.optional(
    Schema.Literals(IF_EXISTS_POLICIES).pipe(
      Schema.annotate({
        defaultNote: 'overwrite',
        description:
          'When a file already sits at the key: overwrite, suffix (name-1.ext … name-1000.ext, then the step fails), skip (keep it and return it; with attachTo, attach it only for a run acting for a person) or fail. overwrite and skip only take a file this automation generated, never a person upload or another automation file.',
      })
    )
  ),
  attachTo: Schema.optional(
    Schema.Struct({
      table: Schema.String.pipe(Schema.annotate({ description: 'Table holding the record' })),
      record: TemplateStringSchema.pipe(
        Schema.annotate({ description: 'Record id (supports template variables)' })
      ),
      field: Schema.String.pipe(
        Schema.annotate({
          description:
            'Attachment field to write into; the file goes to the bucket this field is bound to',
        })
      ),
      mode: Schema.optional(
        Schema.Literals(['replace', 'append']).pipe(
          Schema.annotate({
            defaultNote: 'replace on single-attachment, append on multiple-attachments',
            description:
              'replace swaps the field content and deletes the replaced file unless another record still names it; append adds the file beside the existing ones (multiple-attachments only)',
          })
        )
      ),
    }).pipe(Schema.annotate({ description: "Write the file into a record's attachment field" }))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DocumentOutput',
    title: 'Document Output',
    description:
      'Where a generated file is written: temporary storage (default), a bucket, or a record attachment field.',
  })
)

/** @public */
export type DocumentOutput = Schema.Schema.Type<typeof DocumentOutputSchema>

/**
 * The result of every `document/*` and `pdf/*` step, usable downstream as a
 * `{ step: <name> }` file reference.
 *
 * @public
 */
export const DocumentResultSchema = Schema.Struct({
  key: Schema.String.pipe(Schema.annotate({ description: 'Storage key of the file' })),
  bucket: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Bucket holding the file; absent for a temporary file' })
    )
  ),
  filename: Schema.String.pipe(Schema.annotate({ description: 'Name of the file' })),
  contentType: Schema.String.pipe(Schema.annotate({ description: 'MIME type of the file' })),
  size: Schema.Finite.pipe(Schema.annotate({ description: 'Size in bytes' })),
  pages: Schema.optional(
    Schema.Finite.pipe(Schema.annotate({ description: 'Page count, for a PDF' }))
  ),
  width: Schema.optional(
    Schema.Finite.pipe(Schema.annotate({ description: 'Width in pixels, for an image' }))
  ),
  height: Schema.optional(
    Schema.Finite.pipe(Schema.annotate({ description: 'Height in pixels, for an image' }))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DocumentResult',
    title: 'Document Result',
    description: 'What a document or PDF step returns',
  })
)

/** @public */
export type DocumentResult = Schema.Schema.Type<typeof DocumentResultSchema>
