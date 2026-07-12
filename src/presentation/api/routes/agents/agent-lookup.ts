/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context } from 'hono'

export const findAgent = (app: App | undefined, name: string): Agent | undefined =>
  app?.agents?.find((candidate) => candidate.name === name)

export const hasAgent = (app: App | undefined, name: string): boolean =>
  findAgent(app, name) !== undefined

export const agentNotFound = (c: Readonly<Context>, agentName: string): Response =>
  c.json({ error: `Agent '${agentName}' is not declared in the app schema.` }, 404)
