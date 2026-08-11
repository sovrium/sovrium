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

/** Resolve a declared agent by name; `undefined` when not in `app.agents`. */
export const findAgent = (app: App | undefined, name: string): Agent | undefined =>
  app?.agents?.find((candidate) => candidate.name === name)

/**
 * Does the app declare an agent with the given name? The per-agent anti-enum
 * predicate used by the admin `/api/admin/agents/:name/*` route surfaces — an
 * undeclared agent is not an enumerable resource (404, never an empty 200).
 * Built on {@link findAgent} so the `name` match has one source of truth.
 */
export const hasAgent = (app: App | undefined, name: string): boolean =>
  findAgent(app, name) !== undefined

/** Standard 404 body for an agent name not declared in `app.agents`. */
export const agentNotFound = (c: Readonly<Context>, agentName: string): Response =>
  c.json({ error: `Agent '${agentName}' is not declared in the app schema.` }, 404)
