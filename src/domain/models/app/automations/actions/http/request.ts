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
 * HTTP Action (type: http, operator: request)
 *
 * Send HTTP requests to external services.
 * This is the primary integration mechanism — no pre-integrated apps.
 */
export const HttpRequestActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('http'),
  operator: Schema.Literal('request'),
  props: Schema.Struct({
    url: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Request URL (supports template variables)' })
    ),
    // Accepts a literal HTTP verb OR a template string (`{{…}}` /
    // `$env.…`) so operators can drive the method off trigger data
    // (APP-AUTOMATION-ACTION-HTTP-REQUEST-002). Plain free-form strings
    // are rejected at decode time so a typo like `'PSOT'` still fails
    // before a request is dispatched.
    method: Schema.Union(
      Schema.Literal('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'),
      Schema.String.pipe(Schema.filter((s) => s.includes('{{') || s.includes('$env')))
    ).pipe(Schema.annotations({ description: 'HTTP method (literal or template string)' })),
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
      ).pipe(Schema.annotations({ description: 'Request body — string or JSON object' }))
    ),
    contentType: Schema.optional(
      Schema.Literal('json', 'form', 'text', 'xml').pipe(
        Schema.annotations({ description: 'Content-Type shorthand (default: json)' })
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
    identifier: 'HttpRequestAction',
    title: 'HTTP Request Action',
    description: 'Send configurable HTTP requests to external services',
  })
)

/** @public */
export type HttpRequestAction = Schema.Schema.Type<typeof HttpRequestActionSchema>
