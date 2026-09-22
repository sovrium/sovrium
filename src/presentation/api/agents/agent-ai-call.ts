/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Observational AI provider round-trip for agent execution.
 *
 * Every `POST /api/agents/:name/execute` performs a single AI provider call
 * so the AI mock-server assertion (`ai.getLastRequest()`) observes it,
 * regardless of whether the action is auto-executed or queued for approval.
 *
 * The call also returns the round-trip's token cost (`usage.total_tokens`),
 * which feeds the per-day token budget accounting in `agent-limits.ts`
 *.
 */

import {
  resolveAgentModel,
  resolveAgentTemperature,
} from '@/presentation/api/runtime/agent-ai-config'
import { postChatCompletion } from './openai-chat-fetch'
import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * Build the agent's tool-capability context block.
 *
 * [internal ref]: the agent's `tools` allowlist (tables + actions) is
 * surfaced in the system prompt so the LLM knows the exact constraints it
 * operates within. Returns an empty string for an agent with no `tools`.
 */
const buildCapabilityContext = (agent: Agent): string => {
  const { tools } = agent
  if (tools === undefined) return ''
  const lines = [
    'Your capabilities are restricted to the following allowlist:',
    `- Tables you may access: ${tools.tables.join(', ')}`,
    `- Actions you may perform: ${tools.actions.join(', ')}`,
  ]
  return lines.join('\n')
}

/**
 * Build the agent's effective system prompt.
 *
 * [internal ref]: behavioral `instructions` are appended to the base
 * `systemPrompt` as a numbered list, one rule per line, so the model receives
 * them as explicit ordered directives.
 *
 * [internal ref]: when the agent declares `tools`, a capability context
 * block (allowed tables + actions) is appended so the LLM is aware of its
 * constraints.
 */
export const buildSystemPrompt = (agent: Agent): string => {
  const instructions = agent.instructions ?? []
  const numbered = instructions.map((rule, index) => `${(index + 1).toString()}. ${rule}`)
  const capabilityContext = buildCapabilityContext(agent)
  return [
    agent.systemPrompt,
    ...(numbered.length > 0 ? ['', ...numbered] : []),
    ...(capabilityContext.length > 0 ? ['', capabilityContext] : []),
  ].join('\n')
}

/**
 * Read the total token count from an OpenAI-compatible chat completion
 * response (`usage.total_tokens`). Returns 0 for any non-OK / malformed
 * response so token accounting never throws.
 */
const extractTokenUsage = async (response: Response | undefined): Promise<number> => {
  if (response === undefined || !response.ok) return 0
  const payload = (await response.json().catch(() => undefined)) as
    { readonly usage?: { readonly total_tokens?: unknown } } | undefined
  const total = payload?.usage?.total_tokens
  return typeof total === 'number' && Number.isFinite(total) ? total : 0
}

/**
 * Perform a single AI provider round-trip so the agent execution is observed
 * by the AI mock server. Tolerant of every failure mode — the agent still
 * owes the caller a decision even when the provider is unreachable.
 *
 * The request carries the agent's per-agent overrides:
 * - [internal ref]: `model` overrides `AI_MODEL`.
 * - [internal ref]: `temperature` overrides `AI_TEMPERATURE`.
 * - [internal ref]: numbered `instructions` are folded into the prompt.
 *
 * Returns the number of tokens the round-trip consumed (read from the
 * provider's `usage` block), or 0 when the provider is unreachable or the
 * response carries no usage — used by the per-day token accounting
 *.
 *
 * `userMessage` overrides the default `Perform action <action>.` user turn —
 * scheduled executions pass the agent's `schedule.taskPrompt` verbatim so the
 * AI mock observes it as the user message.
 */
export const callAgentAi = async (
  agent: Agent,
  action: string,
  userMessage?: string
): Promise<number> => {
  const baseUrl = process.env.AI_BASE_URL
  const apiKey = process.env.AI_API_KEY
  if (baseUrl === undefined || apiKey === undefined) return 0

  // The execute path sends a temperature ONLY when the agent or env declares
  // one (fallback `undefined`) — distinct from the chat path's always-on-wire
  // default. [internal ref].
  const temperature = resolveAgentTemperature(agent, undefined)

  const body: Record<string, unknown> = {
    model: resolveAgentModel(agent),
    messages: [
      { role: 'system', content: buildSystemPrompt(agent) },
      { role: 'user', content: userMessage ?? `Perform action ${action}.` },
    ],
    ...(temperature !== undefined && { temperature }),
    ...(agent.maxTokens !== undefined && { max_tokens: agent.maxTokens }),
  }

  // The AI round-trip is observational only — `postChatCompletion` swallows
  // provider errors so a flaky / unreachable mock never fails an approval-flow
  // assertion.
  const response = await postChatCompletion({ baseUrl, apiKey }, body)

  return extractTokenUsage(response)
}
