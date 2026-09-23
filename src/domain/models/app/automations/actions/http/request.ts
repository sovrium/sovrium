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
  type: Schema.Literal('http').pipe(
    Schema.annotate({
      description: "Constant value 'http' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('request').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'http' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    url: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Request URL (supports template variables)' })
    ),
    // Accepts a literal HTTP verb OR a template string (`{{…}}` /
    // `$env.…`) so operators can drive the method off trigger data
    //. Plain free-form strings
    // are rejected at decode time so a typo like `'PSOT'` still fails
    // before a request is dispatched.
    method: Schema.Union([
      Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']),
      Schema.String.pipe(
        Schema.check(Schema.makeFilter((s) => s.includes('{{') || s.includes('$env')))
      ),
    ]).pipe(Schema.annotate({ description: 'HTTP method (literal or template string)' })),
    headers: Schema.optional(
      Schema.Record(Schema.String, TemplateStringSchema).pipe(
        Schema.annotate({
          description: 'Request headers (values support template variables and $env)',
        })
      )
    ),
    body: Schema.optional(
      Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Unknown)]).pipe(
        Schema.annotate({ description: 'Request body — string or JSON object' })
      )
    ),
    contentType: Schema.optional(
      Schema.Literals(['json', 'form', 'text', 'xml']).pipe(
        Schema.annotate({
          description:
            'Content-Type shorthand. No default: when omitted, http/request sends no Content-Type header of its own',
        })
      )
    ),
    timeout: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Request timeout in ms (1000-120000, default: 15000)',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 120_000 }))
      )
    ),
    connection: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Connection name for authentication (must reference app.connections[]). Auth headers are auto-injected.',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
      )
    ),
  }).annotate({
    description: 'The request: its address, method, headers, body and timeout.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'HttpRequestAction',
    title: 'HTTP Request Action',
    description: 'Send configurable HTTP requests to external services',
  })
)

/** @public */
export type HttpRequestAction = Schema.Schema.Type<typeof HttpRequestActionSchema>
