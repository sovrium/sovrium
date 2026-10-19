/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The agent index and one agent, as admin read registry entries.
 *
 * Both name each agent by its LABEL, the words the console prints: an agent
 * declares no label of its own, so a declared agent reads as its name made
 * readable (`quote-assistant` → « Quote assistant ») and the built-in agent
 * reads « System » in the operator's console language (« Système »). The URL
 * keeps the name.
 *
 * `GET /api/admin/agents/:name` reads one agent in full for the Conversations
 * page's header: its model, the actions it may call and how many conversations
 * it holds. A name the index does not list is not found, as the conversation
 * reads answer it, so the page bound to it is the console's own 404.
 */

import { Effect } from 'effect'
import { AdminAgentConversationsRepository } from '@/application/ports/repositories/agents/admin-agent-conversations-repository'
import {
  adminReadPathParams,
  answerWithSchema,
  defineAdminRead,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  resolveOperatorLanguage,
  type ConsoleLanguage,
} from '@/application/use-cases/admin/operator-language'
import {
  agentAdminDetailSchema,
  agentsListQuerySchema,
  agentsListResponseSchema,
} from '@/domain/models/api/admin/agents/list'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  SYSTEM_AGENT_NAME,
  declaredAgentNames,
  isConversationSourceAgent,
  isSystemAgentName,
} from '@/domain/models/app/agents/agent-identity'
import { buildChatToolDefinitions } from '@/domain/models/app/agents/ai-chat-tools'
import { readableName } from '@/domain/models/app/auth/readable-name-service'
import type { AdminReadOperation } from '@/application/use-cases/admin/admin-read-operation'
import type { App } from '@/domain/models/app'

/** What the console calls the built-in agent, per console language. */
const SYSTEM_AGENT_WORDS: Readonly<Record<ConsoleLanguage, string>> = {
  en: 'System',
  fr: 'Système',
}

/** The words the console prints for an agent, in `language`. */
export const agentLabelOf = (name: string, language: ConsoleLanguage): string =>
  isSystemAgentName(name) ? SYSTEM_AGENT_WORDS[language] : readableName(name)

// ─── Agent index ─────────────────────────────────────────────────────────────

/**
 * Page the projected agent names with the same opaque-base64 cursor the buckets
 * index uses (`{ afterName }`). A malformed or stale cursor rewinds to the first
 * page rather than erroring — the token is an internal contract, so a caller has
 * no way to have "fixed" it.
 */
const encodeAgentCursor = (afterName: string): string =>
  Buffer.from(JSON.stringify({ afterName }), 'utf8').toString('base64')

const decodeAgentCursor = (cursor: string, names: ReadonlyArray<string>): number => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly afterName?: unknown
    }
    if (typeof decoded.afterName !== 'string') return 0
    const index = names.indexOf(decoded.afterName)
    return index === -1 ? 0 : index + 1
  } catch {
    return 0
  }
}

interface AgentsIndexInput {
  readonly cursor: string | undefined
  readonly limit: number
}

/** The index knobs, read leniently as the route always read them (limit 1..200, else 50). */
const decodeAgentsIndex = (raw: Readonly<Record<string, unknown>>): AgentsIndexInput => {
  const limit = Number(raw['limit'] ?? '50')
  return {
    cursor: typeof raw['cursor'] === 'string' && raw['cursor'] !== '' ? raw['cursor'] : undefined,
    limit: Number.isFinite(limit) && limit >= 1 && limit <= 200 ? limit : 50,
  }
}

/**
 * The agent index: every declared agent and the built-in system agent, from the
 * SAME projection the console's agents page is built from — two independent
 * enumerations are how the sidebar once rendered "No items." beside a page that
 * had agents.
 */
const buildAgentsIndex = (
  app: App,
  { cursor, limit }: AgentsIndexInput,
  language: ConsoleLanguage
) => {
  // The app before the engine: the declared agents in declaration order, then
  // the built-in system agent last, so a page landing on the first row lands on
  // the app's own agent whenever it declares one.
  const declared = declaredAgentNames(app.agents)
  const names = [
    ...declared.filter((name) => !isSystemAgentName(name)),
    ...declared.filter((name) => isSystemAgentName(name)),
  ]
  const items = names.map((name) => ({
    name,
    label: agentLabelOf(name, language),
    isSystem: isSystemAgentName(name),
  }))
  const start = cursor ? decodeAgentCursor(cursor, names) : 0
  const page = items.slice(start, start + limit)
  const last = page.at(-1)
  const nextCursor =
    start + page.length < items.length && last !== undefined ? encodeAgentCursor(last.name) : null
  return answerWithSchema(agentsListResponseSchema, { items: page, nextCursor })
}

const agentsList = defineAdminRead<AgentsIndexInput>({
  id: 'agents.list',
  method: 'get',
  path: '/api/admin/agents',
  pathParams: [],
  queryParams: ['cursor', 'limit'],
  tool: {
    suffix: 'agents_list',
    description:
      'List the declared agents and the built-in system agent, each with the label the console prints, as GET /api/admin/agents answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Agents per page.' },
        cursor: { type: 'string', description: 'The nextCursor of the previous page.' },
      },
    },
  },
  openapi: {
    summary: 'List the agents',
    description:
      'Every agent the config declares, in declaration order, then the built-in system agent ' +
      "last — the order the console's agents page lists them — each with its label in the operator's console " +
      'language and marked whether it is the system agent. Admin only.',
    operationIdBase: 'listAdminAgents',
    // An unusable limit falls back to 50 and a stale cursor rewinds: never refused.
    querySchema: agentsListQuerySchema,
    refusesQuery: false,
    responseSchema: agentsListResponseSchema,
    responseDescription: 'One page of agents',
  },
  subject: 'agent list',
  decode: (raw) => ({ _tag: 'Ok', input: decodeAgentsIndex(raw) }),
  read: (app, input, request) =>
    Effect.map(resolveOperatorLanguage(request), (language) =>
      buildAgentsIndex(app, input, language)
    ),
  audit: { action: AUDIT_ACTIONS.AGENT_LIST_QUERIED, resourceId: () => SYSTEM_AGENT_NAME },
})

// ─── One agent ───────────────────────────────────────────────────────────────

/**
 * The actions an agent may call, in declaration order. The built-in agent
 * declares none: it answers through the chat's read tools, one `query_` and
 * one `count_` per table, which are listed as the engine offers them to an
 * operator who may read every table.
 */
const agentTools = (app: App, name: string): ReadonlyArray<string> => {
  if (isSystemAgentName(name)) {
    return buildChatToolDefinitions(
      (app.tables ?? []).map((table) => ({ name: table.name, columns: [] }))
    ).map((tool) => tool.function.name)
  }
  const agent = app.agents?.find((candidate) => candidate.name === name)
  return agent?.tools?.actions ?? []
}

/** The model an agent answers with: its own, else the host's `AI_MODEL`, else none. */
const agentModel = (app: App, name: string): string | null => {
  const declared = app.agents?.find((candidate) => candidate.name === name)?.model
  const host = process.env['AI_MODEL']?.trim()
  return declared ?? (host === undefined || host === '' ? null : host)
}

const agentRead = defineAdminRead<string>({
  id: 'agents.read',
  method: 'get',
  path: '/api/admin/agents/:name',
  pathParams: ['name'],
  queryParams: [],
  tool: {
    suffix: 'agent_read',
    description:
      'Read one agent — its label, the model it answers with, the actions it may call and how many conversations it holds — as GET /api/admin/agents/:name answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'The agent name.' } },
      required: ['name'],
    },
  },
  openapi: {
    summary: 'Read one agent',
    description:
      "One agent as the console heads its conversations with: its label in the operator's " +
      'console language, its model (its own, else the host default), the actions it may call ' +
      'and how many conversations it holds. A name the agent index does not list is answered ' +
      '404 and writes no audit event. Admin only.',
    operationIdBase: 'getAdminAgent',
    paramsSchema: adminReadPathParams({ name: 'The agent name' }),
    responseSchema: agentAdminDetailSchema,
    responseDescription: 'The agent',
  },
  subject: 'agent detail',
  decode: ({ name }, app) =>
    typeof name === 'string' && isConversationSourceAgent(app.agents, name)
      ? { _tag: 'Ok', input: name }
      : { _tag: 'NotFound' },
  read: (app, name, request) =>
    Effect.gen(function* () {
      const language = yield* resolveOperatorLanguage(request)
      const conversationCount =
        yield* (yield* AdminAgentConversationsRepository).countConversations(name)
      const tools = agentTools(app, name)
      return answerWithSchema(agentAdminDetailSchema, {
        name,
        label: agentLabelOf(name, language),
        isSystem: isSystemAgentName(name),
        model: agentModel(app, name),
        tools,
        toolLabels: tools.map((tool) => readableName(tool)),
        conversationCount,
      })
    }),
  audit: { action: AUDIT_ACTIONS.AGENT_DETAIL_QUERIED, resourceId: (_app, name) => name },
})

/** The agent index and one agent, in the order the registry lists them. */
export const AGENT_INDEX_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  agentsList,
  agentRead,
]
