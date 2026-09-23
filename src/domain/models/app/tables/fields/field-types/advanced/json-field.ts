/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const JsonFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('json').pipe(
      Schema.annotate({
        description: "Constant value 'json' for type discrimination in discriminated unions",
      })
    ),
    schema: Schema.optional(
      Schema.Struct({}).annotate({
        description:
          'JSON Schema the stored value is checked against, so a malformed payload is refused on write.',
      })
    ),
  }),
  Schema.annotate({
    title: 'JSON Field',
    description: 'Stores structured JSON data with optional schema validation.',
    examples: [{ id: 1, name: 'metadata', type: 'json', required: false }],
  })
)

/** @public */
export type JsonField = Schema.Schema.Type<typeof JsonFieldSchema>
