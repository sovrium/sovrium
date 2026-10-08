/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * How a CSV import into this table behaves.
 *
 * Every road that writes a record fires the table's webhooks and record
 * automations once per row, an import included. `fireEvents: false` is the one
 * named exception, and it is the operator's, not the importer's: an import into
 * this table then fires neither, while every other write to the table — a form,
 * the records API, a batch call, an automation step — fires as usual.
 *
 * @example
 * ```typescript
 * // Loading last year's contacts must not send ten thousand welcome emails.
 * { name: 'contacts', fields: [...], import: { fireEvents: false } }
 * ```
 */
export const TableImportSchema = Schema.Struct({
  fireEvents: Schema.optional(
    Schema.Boolean.annotate({
      description:
        "Whether a CSV import into this table fires the table's webhooks and record automations, once per imported row. `false` makes an import silent; every other way of writing to the table still fires them.",
      defaultNote: 'true',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'TableImport',
    title: 'Import',
    description:
      "How a CSV import into this table behaves. By default an import fires the table's webhooks and record automations once per row, like any other write.",
  })
)

/** @public */
export type TableImport = Schema.Schema.Type<typeof TableImportSchema>
