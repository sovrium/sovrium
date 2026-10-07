/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/agents` — the agent INDEX that backs the
 * Conversations disclosure in the admin sidebar and the per-agent URL scoping of
 * `/_admin/agents/{name}`.
 *
 * The envelope deliberately mirrors `GET /api/admin/buckets`
 * (`{ items, nextCursor }`, `cursorPaginationResponseSchema`) so the sidebar's
 * shared `fetchItems(url, 'items')` reader consumes it with no branch: the two
 * lists differ in what they enumerate, not in how they are read.
 *
 * The items are projected through `declaredAgentNames()` — the SAME function the
 * Conversations surface builds its rail from — so the sidebar can never
 * advertise an agent whose page does not open, nor omit one that does. That set
 * always leads with the built-in `system` agent, whose view is the
 * `agent_name IS NULL` conversations (see `domain/models/app/agents/agent-identity`).
 */

import { Schema } from 'effect'
import { cursorPaginationResponseSchema } from '@/domain/models/api/combinators/cursor-pagination'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * One agent in the admin index.
 *
 * `name` is both the identity and the `/_admin/agents/{name}` URL segment —
 * agents have no persisted row, so there is no separate id to expose (the same
 * reason `declaredBucketNames` derives bucket ids rather than reading them).
 */
export const agentAdminItemSchema = Schema.Struct({
  name: Schema.String.annotate({
    description:
      'Agent name — kebab-case for a declared agent, or the reserved `system` for the built-in System Agent.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  isSystem: Schema.Boolean.annotate({
    description:
      'True for the built-in `system` agent, whose conversations are those no declared agent claimed (`agent_name IS NULL`). Exactly one item per response carries `true`.',
  }),
}).annotate({ identifier: 'AgentAdminItem' })

/**
 * Response schema for `GET /api/admin/agents`. Cursor-paginated list of
 * {@link agentAdminItemSchema}, declaration order with the System Agent first.
 */
export const agentsListResponseSchema = cursorPaginationResponseSchema(
  agentAdminItemSchema
).annotate({ identifier: 'AgentsListResponse' })

/** @public */
export type AgentAdminItem = typeof agentAdminItemSchema.Type
/** @public */
export type AgentsListResponse = typeof agentsListResponseSchema.Type

/**
 * Query parameters for `GET /api/admin/agents`.
 *
 * Both are plain optional STRINGS, matching today's handler exactly rather than
 * the shared `cursorPaginationQuerySchema`, whose two refusals the route does
 * not make:
 *
 * - `limit` outside `1..200`, or not a number, falls back to `50` — it is never
 *   answered 400.
 * - a malformed or stale `cursor` rewinds to the first page — the token is an
 *   internal contract, so a caller has no way to have "fixed" it.
 *
 * Tightening either into a 400 is a behaviour change for the route and belongs
 * in a spec, not in a schema.
 */
export const agentsListQuerySchema = Schema.Struct({
  cursor: optionalField(
    Schema.String.annotate({
      description:
        "Opaque cursor from the previous page's `nextCursor`. A malformed or stale cursor rewinds to the first page rather than erroring.",
    })
  ),
  limit: optionalField(
    Schema.String.annotate({
      description:
        'Page size, `1` to `200` (default `50`). A value outside that range, or not a number, falls back to `50`.',
      examples: ['50'],
    })
  ),
}).annotate({ identifier: 'AgentsListQuery' })

/** @public */
export type AgentsListQuery = typeof agentsListQuerySchema.Type
