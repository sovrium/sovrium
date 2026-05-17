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
 * State Set Action (type: state, operator: set)
 *
 * Store a value in key-value state. Supports optional TTL for automatic expiry
 * and namespace for multi-tenant isolation.
 */
export const StateSetActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('state'),
  operator: Schema.Literal('set'),
  props: Schema.Struct({
    /** State key to set */
    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'State key to set (supports template variables)',
      })
    ),

    /** Value to store */
    value: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Value to store (supports template variables)',
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

    /** Time-to-live for automatic expiry */
    ttl: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^\d+\s*(ms|s|m|h|d)$/),
        Schema.annotations({
          description:
            'Time-to-live for automatic expiry: number + unit (ms, s, m, h, d). Examples: "30s", "1h", "7d"',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'StateSetAction',
    title: 'State Set Action',
    description: 'Store a value in key-value state with optional TTL',
  })
)

/** @public */
export type StateSetAction = Schema.Schema.Type<typeof StateSetActionSchema>
