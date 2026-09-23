/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import { ARRAY_ITEM_TYPE_NAMES, isSupportedArrayItemType } from './array-item-type'

export const ArrayFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('array').pipe(
      Schema.annotate({
        description: "Constant value 'array' for type discrimination in discriminated unions",
      })
    ),
    itemType: Schema.optional(
      Schema.String.pipe(
        // Annotated BEFORE the filter: Effect's JSON Schema generator reads
        // the innermost node, so a description piped after a refinement never
        // reaches the published schema config authors write against.
        Schema.annotate({
          description: `Type of items in the array. One of: ${ARRAY_ITEM_TYPE_NAMES.join(', ')}.`,
        }),
        // Refused HERE, at config validation, rather than by the database.
        // The generator appends `[]` to this value and hands the result to
        // `CREATE TABLE`, so an unrecognised spelling used to surface as a
        // startup DDL failure that stopped the server from booting at all.
        Schema.check(
          Schema.makeFilter(
            (value) =>
              isSupportedArrayItemType(value) ||
              `Invalid itemType '${value}'. An array field's itemType must name a supported element type: ${ARRAY_ITEM_TYPE_NAMES.join(', ')}.`
          )
        )
      )
    ),
    maxItems: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({ description: 'Maximum number of items allowed' }),
        Schema.check(Schema.isGreaterThanOrEqualTo(1))
      )
    ),
  }),
  Schema.annotate({
    title: 'Array Field',
    description: 'Stores arrays of values with optional type and length constraints.',
    examples: [{ id: 1, name: 'tags', type: 'array', itemType: 'string', maxItems: 10 }],
  })
)

/** @public */
export type ArrayField = Schema.Schema.Type<typeof ArrayFieldSchema>
