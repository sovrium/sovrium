/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'

/** One query value: a template string, a number or a boolean. */
const HttpQueryScalarSchema = Schema.Union([TemplateStringSchema, Schema.Finite, Schema.Boolean])

/**
 * Query parameters of an HTTP action, as an object the engine encodes.
 *
 * Values templated into `url` are inserted as they are, so a value holding
 * `&`, `#`, `+` or a space changes the request. Values given here are resolved
 * first and then percent-encoded one by one, and an array repeats its key.
 */
export const HttpQuerySchema = Schema.Record(
  Schema.String,
  Schema.Union([HttpQueryScalarSchema, Schema.Array(HttpQueryScalarSchema)])
).pipe(
  Schema.annotate({
    description:
      'Query parameters, appended to the url after any it already carries. Each value is resolved (templates, $env) and then URL-encoded by the engine, so a search term holding & or a space arrives intact; an array repeats the key (status=a&status=b).',
    examples: [{ email: '{{trigger.data.email}}', limit: 50, status: ['open', 'pending'] }],
  })
)
