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
 * HTTP PATCH Action (type: http, operator: patch)
 *
 * Convenience operator for PATCH requests. Defaults Content-Type to
 * application/json when a body is provided. PATCH semantics signal
 * partial resource update.
 */
export const HttpPatchActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('http').pipe(
    Schema.annotate({
      description: "Constant value 'http' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('patch').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'http' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    url: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Request URL (supports template variables)' })
    ),
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
          howTo:
            'Set it and the request carries the matching `Content-Type` AND encodes the body to match. A `Content-Type` written in `headers` always wins.',
          description:
            'Content-Type shorthand. No default: when omitted, a JSON-shaped body still sends application/json, and a string body sends no Content-Type header',
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
          howTo:
            'Prefer a connection over writing a secret into `headers`: Sovrium attaches the right `Authorization` header for you, and refreshes OAuth2 tokens as they expire.',
          description:
            'Connection name for authentication (must reference app.connections[]). Auth headers are auto-injected.',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
      )
    ),
  }).annotate({
    description: 'The PATCH request: its address, headers, body and timeout.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'HttpPatchAction',
    title: 'HTTP PATCH Action',
    description:
      'Send PATCH requests to external services — partial resource update with JSON default',
  })
)

/** @public */
export type HttpPatchAction = Schema.Schema.Type<typeof HttpPatchActionSchema>
