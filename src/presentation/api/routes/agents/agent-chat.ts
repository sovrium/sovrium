/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  buildChatToolDefinitions,
  type ChatToolDefinition,
} from '@/domain/services/ai-chat/ai-chat-tools'
import { hasReadPermission } from '@/domain/validators/permission-evaluators'
import { readableColumnsForRole } from '../ai/chat-table-projection'
import { resolveAgentModel, resolveAgentTemperature } from './agent-ai-config'
import { postChatCompletion } from './openai-chat-fetch'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

interface AgentChatRequest {
  readonly message: string
  readonly sessionId: string
  readonly agentName: string
}

const resolveTemplateVariables = (prompt: string, app: App, agent: Agent): string =>
  prompt.replaceAll('{{appName}}', app.name).replaceAll('{{userRole}}', agent.role)

const buildTableContext = (app: App, agent: Agent): string => {
  const tables = app.tables ?? []
  const readableTables = tables.filter((table) =>
    hasReadPermission(
      table as { name: string; permissions?: { read?: unknown } },
      agent.role,
      tables as readonly { name: string }[]
    )
  )
  if (readableTables.length === 0) return ''
  const lines = readableTables.map((table) => {
    const fieldNames = table.fields.map((field) => field.name).join(', ')
    return `- ${table.name} (fields: ${fieldNames})`
  })
  return ['Available data tables:', ...lines].join('\n')
}

const buildAgentSystemPrompt = (app: App, agent: Agent): string => {
  const resolvedPrompt = resolveTemplateVariables(agent.systemPrompt, app, agent)
  const tableContext = buildTableContext(app, agent)
  return [resolvedPrompt, tableContext].filter((part) => part.trim().length > 0).join('\n\n')
}

const buildAgentChatTools = (app: App, agent: Agent): ReadonlyArray<ChatToolDefinition> => {
  const tables = app.tables ?? []
  const readableTables = tables.filter((table) =>
    hasReadPermission(
      table as { name: string; permissions?: { read?: unknown } },
      agent.role,
      tables as readonly { name: string }[]
    )
  )
  const allowlist = agent.tools?.tables
  const allowedReadableTables =
    allowlist === undefined
      ? readableTables
      : readableTables.filter((table) => allowlist.includes(table.name))
  return buildChatToolDefinitions(
    allowedReadableTables.map((table) => {
      const fields = table.fields.map((field) => ({
        name: (field as { name: string }).name,
        type: (field as { type: string }).type,
      }))
      return {
        name: table.name,
        columns: readableColumnsForRole(
          fields,
          (table as { permissions?: unknown }).permissions,
          agent.role
        ),
      }
    })
  )
}

const DEFAULT_TEMPERATURE = 0.7

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string | null }
  }>
}

interface AgentProviderCall {
  readonly baseUrl: string
  readonly apiKey: string
  readonly agent: Agent
  readonly systemPrompt: string
  readonly message: string
  readonly tools: ReadonlyArray<ChatToolDefinition>
}

const extractReply = (payload: ChatCompletionResponse | undefined): string => {
  const content = payload?.choices?.[0]?.message?.content
  return typeof content === 'string' && content.length > 0 ? content : ''
}

type AgentProviderOutcome = { readonly ok: true; readonly reply: string } | { readonly ok: false }

const callAgentProvider = async (call: AgentProviderCall): Promise<AgentProviderOutcome> => {
  const { baseUrl, apiKey, agent, systemPrompt, message, tools } = call
  const body: Record<string, unknown> = {
    model: resolveAgentModel(agent),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    temperature: resolveAgentTemperature(agent, DEFAULT_TEMPERATURE),
    ...(agent.maxTokens !== undefined && { max_tokens: agent.maxTokens }),
    ...(tools.length > 0 && { tools }),
  }

  const response = await postChatCompletion({ baseUrl, apiKey }, body)

  if (response === undefined || !response.ok) {
    return { ok: false }
  }
  const payload = (await response.json().catch(() => undefined)) as
    | ChatCompletionResponse
    | undefined
  return { ok: true, reply: extractReply(payload) }
}

export interface AgentChatResult {
  readonly status: 200 | 404 | 502 | 503
  readonly body: Record<string, unknown>
}

export const handleAgentChat = async (
  app: App,
  req: AgentChatRequest
): Promise<AgentChatResult> => {
  const agent = app.agents?.find((candidate) => candidate.name === req.agentName)
  if (agent === undefined) {
    return {
      status: 404,
      body: { error: `Agent '${req.agentName}' is not declared in the app schema.` },
    }
  }

  const baseUrl = process.env.AI_BASE_URL
  const apiKey = process.env.AI_API_KEY
  if (baseUrl === undefined || apiKey === undefined) {
    return {
      status: 503,
      body: { error: 'AI_BASE_URL and AI_API_KEY must be set for agent chat to function.' },
    }
  }

  const systemPrompt = buildAgentSystemPrompt(app, agent)
  const tools = buildAgentChatTools(app, agent)
  const outcome = await callAgentProvider({
    baseUrl,
    apiKey,
    agent,
    systemPrompt,
    message: req.message,
    tools,
  })

  if (!outcome.ok) {
    return {
      status: 502,
      body: { error: 'The assistant is temporarily unavailable. Please try again.' },
    }
  }

  return {
    status: 200,
    body: { reply: outcome.reply, actions: [], sessionId: req.sessionId },
  }
}
