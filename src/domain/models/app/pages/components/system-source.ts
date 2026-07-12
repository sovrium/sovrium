/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterBindingSchema } from './data-source'


export const SystemSourceSchema = Schema.Struct({
  endpoint: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Read endpoint path to fetch rows from (e.g. /api/admin/automations/runs)',
      examples: ['/api/admin/automations/runs'],
    })
  ),
  rowsKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of the rows array in the response envelope (default: 'items')",
    })
  ),
  idKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of each row's unique id (default: 'id')",
    })
  ),
  totalKey: Schema.optional(
    Schema.String.annotations({
      description: 'Key of the total-count in the envelope; falls back to rows length if absent',
    })
  ),
  query: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
    }).annotations({
      description: 'Static query params merged into every request to the endpoint',
    })
  ),
  bindTo: Schema.optional(
    Schema.String.annotations({
      description:
        'ID of a sibling shared filter/period selector whose published params are merged into every request to endpoint (the dynamic counterpart to the static query)',
    })
  ),
  sharedFilter: Schema.optional(
    SharedFilterBindingSchema.annotations({
      description:
        'Companion to bindTo: the shared selector params merged (dynamically) into every request to endpoint, alongside the static query. Inert without bindTo.',
    })
  ),
}).annotations({
  title: 'System Source',
  description:
    'Read-endpoint binding: feed a data-bound component from a system endpoint instead of a DB table',
})

export type SystemSource = Schema.Schema.Type<typeof SystemSourceSchema>
