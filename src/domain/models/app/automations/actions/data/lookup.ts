/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Data Lookup Action (type: data, operator: lookup)
 *
 * Find the first record in an array whose `key` field equals `value`.
 * Returns `null` when no record matches.
 */
export const DataLookupActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('lookup'),
  props: Schema.Struct({
    /** Template reference to the array of records to search */
    input: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the array of records to search' })
    ),

    /** Field name to match against */
    key: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Field name to match against' })
    ),

    /** Value the `key` field must equal (supports template variables) */
    value: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Value the key field must equal (supports templates)' })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataLookupAction',
    title: 'Data Lookup Action',
    description: 'Find the first record in an array matching a key-value pair',
  })
)

/** @public */
export type DataLookupAction = Schema.Schema.Type<typeof DataLookupActionSchema>
