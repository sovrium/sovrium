/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The agent admin reads, as registry entries: the agent index and one agent
 * (`agents-index-read-operations.ts`), one agent's conversations, and one
 * conversation's transcript.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are derived from it. Each writes its
 * `agent.{list,detail,conversation.list,conversation.detail}.queried` audit
 * event on success (canonical `resource.type === 'agent'`).
 *
 * The conversation reads are CROSS-USER and AGENT-SCOPED. A name outside the
 * conversation sources the config declares — an unknown agent and a malformed
 * name alike — is not found, and a conversation of another agent is answered
 * exactly as one that does not exist, so neither the shape of a name nor of an
 * id reveals anything.
 */

import { DateTime, Effect, Option, Schema } from 'effect'
import { AdminReadHost } from '@/application/ports/services/admin-read-host'
import {
  adminReadPathParams,
  adminReadText,
  defineAdminRead,
  type AdminReadOperation,
  type AdminReadOutcome,
} from '@/application/use-cases/admin/admin-read-operation'
import {
  BuildAgentConversationDetail,
  BuildAgentConversations,
  ListAllAgentConversations,
  type AgentConversationsListInput,
  type TableLabelOf,
} from '@/application/use-cases/admin/agent-conversations'
import { AGENT_INDEX_READ_OPERATIONS } from '@/application/use-cases/admin/agents-index-read-operations'
import {
  resolveOperatorLanguage,
  type ConsoleLanguage,
} from '@/application/use-cases/admin/operator-language'
import { buildCsvAttachmentDisposition } from '@/domain/kernel/url/csv-attachment'
import {
  agentConversationDetailResponseSchema,
  agentConversationsListQuerySchema,
  agentConversationsListResponseSchema,
} from '@/domain/models/api/admin/agents/conversations'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { isConversationSourceAgent } from '@/domain/models/app/agents/agent-identity'
import { tableLabelsFor } from '@/domain/models/app/auth/readable-name-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { App } from '@/domain/models/app'

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
      userId: raw['userId'],
      period: raw['period'],
      format: raw['format'],
    }),
    {
      onNone: () =>
        ({
          _tag: 'InvalidInput',
          reason: 'malformed',
          message: 'Invalid query parameters',
        }) as const,
      onSome: ({ cursor, limit, from, to, q, userId, period, format }) =>
        ({
          _tag: 'Ok',
          input: {
            agentName,
            ...(from !== undefined ? { from } : {}),
            ...(to !== undefined ? { to } : {}),
            ...(q !== undefined ? { q } : {}),
            ...(userId !== undefined ? { userId } : {}),
            ...(period !== undefined ? { period } : {}),
            ...(cursor !== undefined ? { cursor } : {}),
            ...(format !== undefined ? { format } : {}),
            limit,
          } satisfies ConversationsListRequest,
        }) as const,
    }
  )
}

/** The list read's input: the list filters, and the format it is answered in. */
type ConversationsListRequest = AgentConversationsListInput & { readonly format?: 'csv' }

/** The CSV export's columns, in order. Never a message's text. */
const CONVERSATIONS_CSV_COLUMNS = ['title', 'person', 'messages', 'started', 'last activity']

/**
 * Every conversation the filters match, as a CSV download: one row per thread
 * naming its person, never what anybody wrote — an export is an index of
 * threads; a transcript belongs to the person's own account export.
 */
const conversationsCsv = (input: ConversationsListRequest) =>
  Effect.gen(function* () {
    const items = yield* ListAllAgentConversations(input)
    const host = yield* AdminReadHost
    const csv = host.encodeCsv(
      items.map((item) => ({
        title: item.title ?? '',
        person: item.userName,
        messages: item.messageCount,
        started: item.createdAt,
        'last activity': item.lastActivityAt,
      })),
      CONVERSATIONS_CSV_COLUMNS
    )
    const takenAt = DateTime.toDateUtc(yield* DateTime.now)
    return {
      _tag: 'Ok',
      body: adminReadText('text/csv; charset=utf-8', csv, {
        'Content-Disposition': buildCsvAttachmentDisposition(
          `${input.agentName}-conversations`,
          takenAt
        ),
      }),
    } satisfies AdminReadOutcome
  })

const conversationsList = defineAdminRead<ConversationsListRequest>({
  id: 'agents.conversations.list',
  method: 'get',
  path: '/api/admin/agents/:name/conversations',
  pathParams: ['name'],
  queryParams: ['cursor', 'limit', 'from', 'to', 'q', 'userId', 'period', 'format'],
  tool: {
    suffix: 'agent_conversations_list',
    description:
      "List one agent's conversations newest first with their message counts and the account that held each, as GET /api/admin/agents/:name/conversations answers them (admin-only, read-only).",
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
        userId: {
          type: 'string',
          minLength: 1,
          description: 'Only the conversations this account id held.',
        },
        period: {
          type: 'string',
          enum: ['7d', '30d', '90d'],
          description: 'Only conversations active in the last 7, 30 or 90 days.',
        },
        format: {
          type: 'string',
          enum: ['csv'],
          description: 'csv answers every match as CSV text instead of one JSON page.',
        },
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
      'message count and the account that held it (id and display name); `q` narrows ' +
      'server-side and is echoed back as `appliedQuery`, `userId` narrows to one account and ' +
      '`period` to a recent window. `?format=csv` downloads every match instead of the page, ' +
      'without any message text. An agent the config does not declare is answered 404 and ' +
      'writes no audit event. Admin only.',
    operationIdBase: 'listAdminAgentConversations',
    paramsSchema: adminReadPathParams({ name: 'The agent name' }),
    querySchema: agentConversationsListQuerySchema,
    responseSchema: agentConversationsListResponseSchema,
    responseDescription: 'One page of conversations',
  },
  subject: 'agent conversation list',
  decode: decodeConversationsList,
  read: (_app, input) =>
    input.format === 'csv' ? conversationsCsv(input) : BuildAgentConversations(input),
  audit: {
    action: AUDIT_ACTIONS.AGENT_CONVERSATION_LIST_QUERIED,
    resourceId: (_app, input) => input.agentName,
  },
})

/**
 * A declared table's label as the console prints it in `language` — its plural,
 * else its singular, else its name made readable — read from the app as it is
 * declared NOW, so a stored call on a renamed table reads by its new label.
 */
const tableLabelOf =
  (app: App, language: ConsoleLanguage): TableLabelOf =>
  (name) => {
    const table = app.tables?.find((candidate) => candidate.name === name)
    if (table === undefined) return undefined
    const translate = (text: string) => resolveTranslationPattern(text, language, app.languages)
    return tableLabelsFor(table, translate).labelPlural
  }

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
  read: (app, { agentName, id }, request) =>
    Effect.flatMap(resolveOperatorLanguage(request), (language) =>
      BuildAgentConversationDetail(agentName, id, tableLabelOf(app, language))
    ),
  audit: {
    action: AUDIT_ACTIONS.AGENT_CONVERSATION_DETAIL_QUERIED,
    resourceId: (_app, { id }) => id,
  },
})

/** The agent admin reads, in the order the registry lists them (no two paths overlap). */
export const AGENTS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  ...AGENT_INDEX_READ_OPERATIONS,
  conversationsList,
  conversationRead,
]
