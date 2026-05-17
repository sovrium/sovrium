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
 * State Delete Action (type: state, operator: delete)
 *
 * Remove a value from key-value state by key.
 */
export const StateDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('state'),
  operator: Schema.Literal('delete'),
  props: Schema.Struct({
    /** State key to delete */
    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'State key to delete (supports template variables)',
      })
    ),

    /** Optional namespace for key isolation */
    namespace: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9-]*$/),
        Schema.annotations({
          description:
            'Namespace for key isolation (lowercase alphanumeric with hyphens, starts with letter)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'StateDeleteAction',
    title: 'State Delete Action',
    description: 'Remove a value from key-value state by key',
  })
)

/** @public */
export type StateDeleteAction = Schema.Schema.Type<typeof StateDeleteActionSchema>
