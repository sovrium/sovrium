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
  type: Schema.Literal('http').pipe(
    Schema.annotate({
      description: "Constant value 'http' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('get').pipe(
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
    // GET requests should never carry a body (HTTP semantics + spec
    // [internal ref]). `Schema.Never` makes any
    // non-undefined `body` value fail decode, so the YAML decoder
    // rejects the misuse at startup rather than silently dropping it.
    body: Schema.optionalKey(
      // `Schema.Never` discards its own annotations when emitted to JSON
      // Schema; the `UndefinedOr` wrapper carries them instead.
      Schema.UndefinedOr(Schema.Never).annotate({
        description: 'Refused: a GET request carries no body. Use `http`/`post` instead.',
      })
    ),
  }).annotate({
    description: 'The GET request: its address, headers and timeout.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'HttpGetAction',
    title: 'HTTP GET Action',
    description: 'Send GET requests to external services — no body field',
  })
)

/** @public */
export type HttpGetAction = Schema.Schema.Type<typeof HttpGetActionSchema>
