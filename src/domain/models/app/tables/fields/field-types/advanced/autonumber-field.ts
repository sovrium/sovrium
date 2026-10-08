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
 * The value is allocated by the database on every insert, whether or not the
 * field is `required`, and starts at 1. On PostgreSQL the column is a `SERIAL`.
 * On SQLite it is `INTEGER PRIMARY KEY AUTOINCREMENT` only when the field is the
 * primary key; otherwise it is a plain `INTEGER` that an `AFTER INSERT` trigger
 * fills with the largest number already assigned plus one. There is
 * deliberately nothing to configure: `prefix` / `startFrom` / `digits` are
 * refused, because no code path would read them and a config that set them
 * would be silently wrong. A human-facing reference (`INV-01000`) is composed by a
 * `formula` field over this column.
 */
export const AutonumberFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('autonumber').pipe(
      Schema.annotate({
        description: "Constant value 'autonumber' for type discrimination in discriminated unions",
      })
    ),
  }),
  Schema.annotate({
    title: 'Autonumber Field',
    description:
      'Auto-incrementing number field assigned by the database on every insert, whether or not the field is `required`, on SQLite as on PostgreSQL.',
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
