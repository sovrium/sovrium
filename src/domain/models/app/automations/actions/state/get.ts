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
 * State Get Action (type: state, operator: get)
 *
 * Retrieve a value from key-value state by key.
 * Optionally scoped to a namespace for multi-tenant isolation.
 */
export const StateGetActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('state'),
  operator: Schema.Literal('get'),
  props: Schema.Struct({
    /** State key to retrieve */
    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'State key to retrieve (supports template variables)',
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
    identifier: 'StateGetAction',
    title: 'State Get Action',
    description: 'Retrieve a value from key-value state by key',
  })
)

/** @public */
export type StateGetAction = Schema.Schema.Type<typeof StateGetActionSchema>
