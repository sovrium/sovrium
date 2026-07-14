/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveAgentModel, resolveAgentTemperature } from './agent-ai-config'
import { postChatCompletion } from './openai-chat-fetch'
import type { Agent } from '@/domain/models/app/agents/agent'

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

const extractTokenUsage = async (response: Response | undefined): Promise<number> => {
  if (response === undefined || !response.ok) return 0
  const payload = (await response.json().catch(() => undefined)) as
    { readonly usage?: { readonly total_tokens?: unknown } } | undefined
  const total = payload?.usage?.total_tokens
  return typeof total === 'number' && Number.isFinite(total) ? total : 0
}

export const callAgentAi = async (
  agent: Agent,
  action: string,
  userMessage?: string
): Promise<number> => {
  const baseUrl = process.env.AI_BASE_URL
  const apiKey = process.env.AI_API_KEY
  if (baseUrl === undefined || apiKey === undefined) return 0

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

  const response = await postChatCompletion({ baseUrl, apiKey }, body)

  return extractTokenUsage(response)
}
