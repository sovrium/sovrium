/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'

/** Why the guard refused one agent action. */
export type AgentGuardRefusal =
  /** The agent tripped its action rate limit (role ceiling, or the shared chat limiter). */
  | 'rate-limited'
  /** The agent spent its `maxActionsPerMinute` window: the action is deferred, not run. */
  | 'queued'

/**
 * Agent Guard Port
 *
 * The process-wide counters an agent's declared limits are checked against:
 * its action rate limit, its per-minute action window, its concurrency slots
 * and its daily token budget. The DECISIONS (what a limit resolves to, which
 * role gets which ceiling) are domain rules; this port is the state they are
 * applied to, so every surface that runs an agent counts against the same
 * windows ([internal ref] D2).
 */
export class AgentGuard extends Context.Service<
  AgentGuard,
  {
    /**
     * Admit one agent action through the rate limit, then the action window.
     * An admitted action is recorded; a refused one is not.
     */
    readonly admitAction: (agent: {
      readonly name: string
      readonly role: string
      readonly maxActionsPerMinute: number
    }) => Effect.Effect<AgentGuardRefusal | undefined>
    /** Charge a model call's tokens to the agent's daily budget. */
    readonly recordTokens: (agentName: string, tokens: number) => Effect.Effect<void>
  }
>()('AgentGuard') {}
