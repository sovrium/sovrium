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
 * HTTP GET Action (type: http, operator: get)
 *
 * Convenience operator for GET requests. No body field — GET requests
 * should not include a request body per HTTP semantics.
 */
export const HttpGetActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('http'),
  operator: Schema.Literal('get'),
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
    // GET requests should never carry a body (HTTP semantics + spec
    // APP-AUTOMATION-ACTION-HTTP-GET-002). `Schema.Never` makes any
    // non-undefined `body` value fail decode, so the YAML decoder
    // rejects the misuse at startup rather than silently dropping it.
    body: Schema.optional(Schema.Never),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'HttpGetAction',
    title: 'HTTP GET Action',
    description: 'Send GET requests to external services — no body field',
  })
)

/** @public */
export type HttpGetAction = Schema.Schema.Type<typeof HttpGetActionSchema>
