/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared agent-lookup helpers for the per-agent route surfaces.
 *
 * Every `/api/agents/:name/...` route resolves the named agent from
 * `app.agents[]` and responds with an identical 404 body when it is absent.
 * The lookup + not-found response are shared here so the approval routes and
 * the schedule routes stay consistent.
 */

import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context } from 'hono'

/**
 * Resolve a declared agent by name; `undefined` when not in `app.agents`.
 *
 * NOTE — this is DECLARATION lookup, and the admin conversation surfaces do not
 * use it as their anti-enum gate: they admit the reserved general-purpose
 * `default` agent, which has no declaration to find. That gate is
 * `isConversationSourceAgent` in `@/domain/utils/agent-identity`, projected from
 * the same list the agent index advertises. Use this one only where a real
 * `Agent` object (model, prompt, tools) is needed.
 */
export const findAgent = (app: App | undefined, name: string): Agent | undefined =>
  app?.agents?.find((candidate) => candidate.name === name)

/**
 * The single refusal body every agent surface answers with — both for a name
 * that was never declared and for an agent the caller may not reach.
 *
 * DELIBERATELY carries no agent name. The name sits in the URL, so a body that
 * echoed it back would differ between "never existed" and "exists but refused"
 * and hand an anonymous caller an enumeration oracle, one guess at a time —
 * exactly what answering 404 rather than 403 exists to close (standing rule S1;
 * [internal ref] asserts the two responses match byte for byte).
 */
export const agentNotFound = (c: Readonly<Context>): Response =>
  c.json({ error: 'Agent not found or access denied.' }, 404)
