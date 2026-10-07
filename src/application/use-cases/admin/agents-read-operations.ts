/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The agent admin reads, as registry entries: the agent index, one agent's
 * conversations, and one conversation's transcript.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are derived from it. Each writes its
 * `agent.{list,conversation.list,conversation.detail}.queried` audit event on
 * success (canonical `resource.type === 'agent'`).
 *
 * The conversation reads are CROSS-USER and AGENT-SCOPED. A name outside the
 * conversation sources the config declares — an unknown agent and a malformed
 * name alike — is not found, and a conversation of another agent is answered
 * exactly as one that does not exist, so neither the shape of a name nor of an
 * id reveals anything.
 */

import { Effect, Option, Schema } from 'effect'
import {
  adminReadPathParams,
  defineAdminRead,
  answerWithSchema,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  BuildAgentConversationDetail,
  BuildAgentConversations,
  type AgentConversationsListInput,
} from '@/application/use-cases/admin/agent-conversations'
import {
  agentConversationDetailResponseSchema,
  agentConversationsListQuerySchema,
  agentConversationsListResponseSchema,
} from '@/domain/models/api/admin/agents/conversations'
import {
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
import type { AdminReadOperation } from '@/application/use-cases/admin/admin-read-operation'
import type { App } from '@/domain/models/app'

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
const buildAgentsIndex = (app: App, { cursor, limit }: AgentsIndexInput) => {
  const names = declaredAgentNames(app.agents)
  const items = names.map((name) => ({ name, isSystem: isSystemAgentName(name) }))
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
      'List the declared agents and the built-in system agent, as GET /api/admin/agents answers them (admin-only, read-only).',
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
      'Every agent the config declares plus the built-in system agent, in the order the ' +
      "console's agents page lists them, each marked whether it is the system agent. Admin only.",
    operationIdBase: 'listAdminAgents',
    // An unusable limit falls back to 50 and a stale cursor rewinds: never refused.
    querySchema: agentsListQuerySchema,
    refusesQuery: false,
    responseSchema: agentsListResponseSchema,
    responseDescription: 'One page of agents',
  },
  subject: 'agent list',
  decode: (raw) => ({ _tag: 'Ok', input: decodeAgentsIndex(raw) }),
  read: (app, input) => Effect.succeed(buildAgentsIndex(app, input)),
  audit: { action: AUDIT_ACTIONS.AGENT_LIST_QUERIED, resourceId: () => SYSTEM_AGENT_NAME },
})

// ─── Conversations ───────────────────────────────────────────────────────────

/** The agent a conversation read addresses, when the config makes it a source. */
const sourceAgent = ({ name }: Readonly<Record<string, unknown>>, app: App): string | undefined => {
  return typeof name === 'string' && isConversationSourceAgent(app.agents, name) ? name : undefined
}

/**
 * Decode one agent's conversation list. The agent is checked BEFORE the query,
 * as the route always did: an unknown agent is not found whatever its query.
 * An invalid date bound, an out-of-range limit or an over-long term is refused
 * — never truncated.
 */
const decodeConversationsList = (raw: Readonly<Record<string, unknown>>, app: App) => {
  const agentName = sourceAgent(raw, app)
  if (agentName === undefined) return { _tag: 'NotFound' } as const
  return Option.match(
    Schema.decodeUnknownOption(agentConversationsListQuerySchema)({
      cursor: raw['cursor'],
      limit: raw['limit'],
      from: raw['from'],
      to: raw['to'],
      q: raw['q'],
    }),
    {
      onNone: () =>
        ({
          _tag: 'InvalidInput',
          reason: 'malformed',
          message: 'Invalid query parameters',
        }) as const,
      onSome: ({ cursor, limit, from, to, q }) =>
        ({
          _tag: 'Ok',
          input: {
            agentName,
            ...(from !== undefined ? { from } : {}),
            ...(to !== undefined ? { to } : {}),
            ...(q !== undefined ? { q } : {}),
            ...(cursor !== undefined ? { cursor } : {}),
            limit,
          } satisfies AgentConversationsListInput,
        }) as const,
    }
  )
}

const conversationsList = defineAdminRead<AgentConversationsListInput>({
  id: 'agents.conversations.list',
  method: 'get',
  path: '/api/admin/agents/:name/conversations',
  pathParams: ['name'],
  queryParams: ['cursor', 'limit', 'from', 'to', 'q'],
  tool: {
    suffix: 'agent_conversations_list',
    description:
      "List one agent's conversations newest first with their message counts, as GET /api/admin/agents/:name/conversations answers them (admin-only, read-only).",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The agent name.' },
        from: {
          type: 'string',
          format: 'date-time',
          description: 'Only conversations active at or after this ISO 8601 instant.',
        },
        to: {
          type: 'string',
          format: 'date-time',
          description: 'Only conversations active before this ISO 8601 instant.',
        },
        q: { type: 'string', description: 'Case-insensitive search over the title and session.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description: 'Conversations per page.',
        },
        cursor: { type: 'string', description: 'The nextCursor of the previous page.' },
      },
      required: ['name'],
    },
  },
  openapi: {
    summary: "List one agent's conversations",
    description:
      'Cursor-paginated conversations of one agent, newest activity first, each with its ' +
      'message count; `q` narrows server-side and is echoed back as `appliedQuery`. An ' +
      'agent the config does not declare is answered 404 and writes no audit event. Admin only.',
    operationIdBase: 'listAdminAgentConversations',
    paramsSchema: adminReadPathParams({ name: 'The agent name' }),
    querySchema: agentConversationsListQuerySchema,
    responseSchema: agentConversationsListResponseSchema,
    responseDescription: 'One page of conversations',
  },
  subject: 'agent conversation list',
  decode: decodeConversationsList,
  read: (_app, input) => BuildAgentConversations(input),
  audit: {
    action: AUDIT_ACTIONS.AGENT_CONVERSATION_LIST_QUERIED,
    resourceId: (_app, input) => input.agentName,
  },
})

interface ConversationAddress {
  readonly agentName: string
  readonly id: string
}

const conversationRead = defineAdminRead<ConversationAddress>({
  id: 'agents.conversations.read',
  method: 'get',
  path: '/api/admin/agents/:name/conversations/:id',
  pathParams: ['name', 'id'],
  queryParams: [],
  tool: {
    suffix: 'agent_conversation_read',
    description:
      'Read one agent conversation — its header and every message in order — as GET /api/admin/agents/:name/conversations/:id answers it (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The agent name.' },
        id: { type: 'string', description: 'The conversation id.' },
      },
      required: ['name', 'id'],
    },
  },
  openapi: {
    summary: 'Read one agent conversation',
    description:
      'The conversation header and its chronological transcript. An unknown agent, an ' +
      'unknown conversation and a conversation of another agent are all answered 404 and ' +
      'write no audit event. Admin only.',
    operationIdBase: 'getAdminAgentConversation',
    paramsSchema: adminReadPathParams({ name: 'The agent name', id: 'The conversation id' }),
    responseSchema: agentConversationDetailResponseSchema,
    responseDescription: 'The conversation and its messages',
  },
  subject: 'agent conversation detail',
  decode: (raw, app) => {
    const agentName = sourceAgent(raw, app)
    const { id } = raw
    return agentName !== undefined && typeof id === 'string' && id !== ''
      ? { _tag: 'Ok', input: { agentName, id } }
      : { _tag: 'NotFound' }
  },
  read: (_app, { agentName, id }) => BuildAgentConversationDetail(agentName, id),
  audit: {
    action: AUDIT_ACTIONS.AGENT_CONVERSATION_DETAIL_QUERIED,
    resourceId: (_app, { id }) => id,
  },
})

/** The agent admin reads, in the order the registry lists them (no two paths overlap). */
export const AGENTS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  agentsList,
  conversationsList,
  conversationRead,
]
