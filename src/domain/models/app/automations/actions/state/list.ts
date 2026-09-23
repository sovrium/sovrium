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
 * State List Action (type: state, operator: list)
 *
 * List keys in key-value state, optionally filtered by prefix.
 * Returns an array of matching keys.
 */
export const StateListActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('state').pipe(
    Schema.annotate({
      description: "Constant value 'state' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('list').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'state' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Key prefix to filter by */
    prefix: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Key prefix to filter by (supports template variables)',
        })
      )
    ),

    /** Optional namespace for key isolation */
    namespace: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Namespace for key isolation (lowercase alphanumeric with hyphens, starts with letter)',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
      )
    ),

    /** Maximum number of keys to return */
    limit: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum number of keys to return',
        }),
        Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
      )
    ),
  }).annotate({
    description: 'Which stored values are listed, from which namespace, and how many at most.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'StateListAction',
    title: 'State List Action',
    description: 'List keys in key-value state, optionally filtered by prefix',
  })
)

/** @public */
export type StateListAction = Schema.Schema.Type<typeof StateListActionSchema>
