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
 * always leads with the reserved general-purpose `default` agent, whose view is
 * the `agent_name IS NULL` conversations (see `domain/utils/agent-identity`).
 */

import { z } from '@hono/zod-openapi'
import { cursorPaginationResponseSchema } from '@/domain/models/api/_shared/cursor-pagination'

/**
 * One agent in the admin index.
 *
 * `name` is both the identity and the `/_admin/agents/{name}` URL segment —
 * agents have no persisted row, so there is no separate id to expose (the same
 * reason `declaredBucketNames` derives bucket ids rather than reading them).
 */
export const agentAdminItemSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe(
        'Agent name — kebab-case for a declared agent, or the reserved `default` for the general-purpose agent.'
      ),
    isDefault: z
      .boolean()
      .describe(
        'True for the reserved general-purpose `default` agent, whose conversations are those no declared agent claimed (`agent_name IS NULL`). Exactly one item per response carries `true`.'
      ),
  })
  .openapi('AgentAdminItem')

/**
 * Response schema for `GET /api/admin/agents`. Cursor-paginated list of
 * {@link agentAdminItemSchema}, newest-declaration-order with the default first.
 */
export const agentsListResponseSchema =
  cursorPaginationResponseSchema(agentAdminItemSchema).openapi('AgentsListResponse')

/** @public */
export type AgentAdminItem = z.infer<typeof agentAdminItemSchema>
/** @public */
export type AgentsListResponse = z.infer<typeof agentsListResponseSchema>
