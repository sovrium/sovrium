/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Autonumber field — a database-assigned sequence.
 *
 * The column is emitted as SERIAL (Postgres) / INTEGER AUTOINCREMENT (SQLite),
 * so the value is allocated by the database on insert and starts at 1. There is
 * deliberately nothing to configure: `prefix` / `startFrom` / `digits` used to
 * be accepted here and were read by no code path, which made a config that set
 * them silently wrong. A human-facing reference (`INV-01000`) is composed by a
 * `formula` field over this column.
 */
export const AutonumberFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('autonumber'),
  }),
  Schema.annotate({
    title: 'Autonumber Field',
    description: 'Auto-incrementing number field assigned by the database.',
    examples: [
      {
        id: 1,
        name: 'invoice_number',
        type: 'autonumber',
      },
    ],
  })
)

/** @public */
export type AutonumberField = Schema.Schema.Type<typeof AutonumberFieldSchema>
