/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The model round-trip of a structured agent action (`POST /api/agents/:name/execute`).
 *
 * The execute route runs an action its caller named — not a model turn — but
 * still makes one model call carrying the agent's prompt, so the action is
 * charged to the agent's daily token budget and observed like any other agent
 * call. It goes through the `AiService` port, and therefore through the
 * provider precedence resolver: Ollama on its native endpoint, a cloud
 * provider on its own. A failed call costs nothing and fails nothing — the
 * route still owes its caller a decision.
 */

import { Effect } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import { buildAgentSystemPrompt } from '@/domain/models/app/agents/agent-turn-service'
import { logError } from '@/infrastructure/logging/logger'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/**
 * One model call for `action`, as the agent. `userMessage` overrides the
 * default `Perform action <action>.` user turn.
 *
 * @returns the tokens the call consumed, 0 when the provider is unreachable or
 *   reports no usage.
 */
export const callAgentAi = (
  services: DomainContext,
  agent: Agent,
  action: string,
  userMessage?: string
): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const ai = yield* AiService
      const reply = yield* ai.chat({
        messages: [
          { role: 'system', content: buildAgentSystemPrompt(agent) },
          { role: 'user', content: userMessage ?? `Perform action ${action}.` },
        ],
        ...(agent.model !== undefined && { model: agent.model }),
        ...(agent.temperature !== undefined && { temperature: agent.temperature }),
        ...(agent.maxTokens !== undefined && { maxTokens: agent.maxTokens }),
      })
      return reply.usage?.totalTokens ?? 0
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[agents] execute model call failed', cause, { agent: agent.name })
        })
      ),
      // effect-swallow: the call is charged and observed when it succeeds; a provider failure must not fail the action the route still decides.
      Effect.catchCause(() => Effect.succeed(0)),
      Effect.provide(services)
    )
  )
