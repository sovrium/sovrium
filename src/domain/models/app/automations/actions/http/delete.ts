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
  type: Schema.Literal('http').pipe(
    Schema.annotate({
      description: "Constant value 'http' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('delete').pipe(
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
        Schema.annotate({
          description: 'Optional request body — some APIs accept a body with DELETE requests',
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
    description: 'The DELETE request: its address, headers, body and timeout.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'HttpDeleteAction',
    title: 'HTTP DELETE Action',
    description:
      'Send DELETE requests to external services — optional body for APIs that accept it',
  })
)

/** @public */
export type HttpDeleteAction = Schema.Schema.Type<typeof HttpDeleteActionSchema>
