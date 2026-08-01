/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const AutonumberFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('autonumber'),
    })
  ),
  Schema.annotations({
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

export type AutonumberField = Schema.Schema.Type<typeof AutonumberFieldSchema>
