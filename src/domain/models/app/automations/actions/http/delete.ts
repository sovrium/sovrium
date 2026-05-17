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
 * HTTP DELETE Action (type: http, operator: delete)
 *
 * Convenience operator for DELETE requests. Supports an optional body
 * since some APIs accept a body with DELETE requests (e.g., bulk deletion payloads).
 */
export const HttpDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('http'),
  operator: Schema.Literal('delete'),
  props: Schema.Struct({
    url: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Request URL (supports template variables)' })
    ),
    headers: Schema.optional(
      Schema.Record({ key: Schema.String, value: TemplateStringSchema }).pipe(
        Schema.annotations({
          description: 'Request headers (values support template variables and $env)',
        })
      )
    ),
    body: Schema.optional(
      Schema.Union(
        Schema.String,
        Schema.Record({ key: Schema.String, value: Schema.Unknown })
      ).pipe(
        Schema.annotations({
          description: 'Optional request body — some APIs accept a body with DELETE requests',
        })
      )
    ),
    timeout: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1000, 120_000),
        Schema.annotations({
          description: 'Request timeout in ms (1000-120000, default: 30000)',
        })
      )
    ),
    expectedStatus: Schema.optional(
      Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(100, 599))).pipe(
        Schema.annotations({
          description: 'Expected HTTP status codes (fail if not matched). Default: 200-299',
        })
      )
    ),
    connection: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9-]*$/),
        Schema.annotations({
          description:
            'Connection name for authentication (must reference app.connections[]). Auth headers are auto-injected.',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'HttpDeleteAction',
    title: 'HTTP DELETE Action',
    description:
      'Send DELETE requests to external services — optional body for APIs that accept it',
  })
)

/** @public */
export type HttpDeleteAction = Schema.Schema.Type<typeof HttpDeleteActionSchema>
