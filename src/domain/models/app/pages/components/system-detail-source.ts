/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const SystemDetailSourceSchema = Schema.Struct({
  endpoint: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description:
        'Detail endpoint path to fetch one record from. The bound record id is injected into the `:param` placeholder (e.g. /api/admin/automations/runs/:runId)',
      examples: ['/api/admin/automations/runs/:runId'],
    })
  ),
  param: Schema.optional(
    Schema.String.annotations({
      description:
        "Param injected into the endpoint's `:param` placeholder — the clicked row id (record-drawer) or the route parameter (page mode:single). Default 'id'.",
      examples: ['runId', 'id', 'submissionId'],
    })
  ),
  recordKey: Schema.optional(
    Schema.String.annotations({
      description:
        'Key of the single record in the response envelope (e.g. `run`). Falls back to the whole response body when absent.',
    })
  ),
  idKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of the resolved record's unique id (default 'id')",
    })
  ),
  query: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
    }).annotations({
      description: 'Static query params merged into the request to the detail endpoint',
    })
  ),
}).annotations({
  title: 'System Detail Source',
  description:
    'Detail-endpoint binding: feed a record-bound component a single record from a system detail endpoint instead of /api/tables/:t/records/:id',
})

export type SystemDetailSource = Schema.Schema.Type<typeof SystemDetailSourceSchema>
