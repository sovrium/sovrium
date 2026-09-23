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
  type: Schema.Literal('state').pipe(
    Schema.annotate({
      description: "Constant value 'state' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('get').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'state' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** State key to retrieve */
    key: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'State key to retrieve (supports template variables)',
      })
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
  }).annotate({
    description: 'Which stored value is read, and from which namespace.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'StateGetAction',
    title: 'State Get Action',
    description: 'Retrieve a value from key-value state by key',
  })
)

/** @public */
export type StateGetAction = Schema.Schema.Type<typeof StateGetActionSchema>
