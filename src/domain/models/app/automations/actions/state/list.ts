/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const StateListActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('state'),
  operator: Schema.Literal('list'),
  props: Schema.Struct({
    prefix: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Key prefix to filter by (supports template variables)',
        })
      )
    ),

    namespace: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9-]*$/),
        Schema.annotations({
          description:
            'Namespace for key isolation (lowercase alphanumeric with hyphens, starts with letter)',
        })
      )
    ),

    limit: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.positive(),
        Schema.annotations({
          description: 'Maximum number of keys to return',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'StateListAction',
    title: 'State List Action',
    description: 'List keys in key-value state, optionally filtered by prefix',
  })
)

export type StateListAction = Schema.Schema.Type<typeof StateListActionSchema>
