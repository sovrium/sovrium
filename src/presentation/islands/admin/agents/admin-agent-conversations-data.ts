/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure data + format helpers for the `admin-agent-conversations` island
 * ([internal ref] — Pass 2b of the pure operational data console).
 *
 * The two fetches (an agent's conversation LIST + a single conversation's message
 * THREAD), the row/message shapes, and the relative-time / clock formatters live
 * here (no React, no JSX) so the island file stays under the per-island
 * `max-lines` cap and these pure functions are unit-reachable. Mirrors the
 * `admin-bucket-files-data` module's defensive-parse + discriminated-state shape.
 */

import { formatDayRelativeTime } from '@/domain/kernel/format/day-relative-time'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { resolvePageLocale } from '../../runtime/page-locale'
import { resolvePageTimezone } from '../../runtime/page-timezone'
import { conversationCaptions } from './admin-agent-conversations-captions'

/** One conversation in the list column (mirrors `agentConversationListItemSchema`). */
export interface ConversationRow {
  readonly id: string
  /** The owning agent's name — set when merging across agents. */
  readonly agentName: string
  readonly title: string
  readonly sessionId: string
  /** The person who held the conversation, by display name. */
  readonly userName: string
  readonly messageCount: number
  readonly lastActivityAt: string
  readonly createdAt: string
}

/** One message in the thread column (mirrors `agentConversationMessageSchema`). */
export interface ThreadMessage {
  readonly id: string
  readonly role: string
  readonly content: string
  readonly status: string
  readonly model: string | undefined
  readonly tokenCount: number | undefined
  readonly toolCalls: unknown
  readonly createdAt: string
}

/** The conversation header for the thread column (mirrors `agentConversationHeaderSchema`). */
export interface ConversationHeader {
  readonly id: string
  readonly title: string
  /** The person who held the conversation, by display name. */
  readonly userName: string
  readonly createdAt: string
  readonly lastActivityAt: string
}

/** The three load phases — a discriminated state so loading / error / empty never collide. */
export type LoadPhase = 'loading' | 'ready' | 'error'

/** The conversation-list column state. */
export interface ListState {
  readonly phase: LoadPhase
  readonly conversations: ReadonlyArray<ConversationRow>
}

/** The message-thread column state. `idle` = no conversation selected yet. */
export interface ThreadState {
  readonly phase: 'idle' | LoadPhase
  readonly header: ConversationHeader | undefined
  readonly messages: ReadonlyArray<ThreadMessage>
}

/** No published params — the viewer bound to no channel, or nothing published yet. */
const NO_SHARED_PARAMS: Readonly<Record<string, string>> = {}

export const LIST_LOADING: ListState = { phase: 'loading', conversations: [] }
export const THREAD_IDLE: ThreadState = { phase: 'idle', header: undefined, messages: [] }
export const THREAD_LOADING: ThreadState = { phase: 'loading', header: undefined, messages: [] }

/** Raw list response — every field defensively optional (no trust in the wire shape). */
interface ListResponse {
  readonly items?: ReadonlyArray<Partial<ConversationRow>>
  readonly nextCursor?: string | undefined
}

/** Raw detail response — defensively optional. */
interface DetailResponse {
  readonly conversation?: Partial<ConversationHeader>
  readonly messages?: ReadonlyArray<Partial<ThreadMessage>>
}

/** Coerce one raw list item to a `ConversationRow` (tagged with its agent), dropping id-less rows. */
function toRow(item: Partial<ConversationRow>, agentName: string): ReadonlyArray<ConversationRow> {
  if (typeof item.id !== 'string') return []
  return [
    {
      id: item.id,
      agentName,
      title:
        typeof item.title === 'string' && item.title.length > 0
          ? item.title
          : conversationCaptions().untitled,
      sessionId: typeof item.sessionId === 'string' ? item.sessionId : '',
      userName: typeof item.userName === 'string' ? item.userName : '',
      messageCount: typeof item.messageCount === 'number' ? item.messageCount : 0,
      lastActivityAt: typeof item.lastActivityAt === 'string' ? item.lastActivityAt : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    },
  ]
}

/** Coerce one raw message to a `ThreadMessage`, dropping messages with no id. */
function toMessage(msg: Partial<ThreadMessage>): ReadonlyArray<ThreadMessage> {
  if (typeof msg.id !== 'string') return []
  return [
    {
      id: msg.id,
      role: typeof msg.role === 'string' ? msg.role : 'assistant',
      content: typeof msg.content === 'string' ? msg.content : '',
      status: typeof msg.status === 'string' ? msg.status : 'complete',
      model: typeof msg.model === 'string' ? msg.model : undefined,
      tokenCount: typeof msg.tokenCount === 'number' ? msg.tokenCount : undefined,
      toolCalls: msg.toolCalls ?? undefined,
      createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : '',
    },
  ]
}

/**
 * Load the agent's conversation list (newest-first), narrowed server-side by
 * `search` when the operator has typed one.
 *
 * The `limit=200` window is why `search` has to reach the SERVER. The viewer
 * loads at most 200 threads per agent and never follows `nextCursor`, so a
 * client-side filter over what it holds can only ever see those 200: thread 201
 * was reported as not existing. With `?q=` the cap becomes "200 MATCHES"
 * instead of "matches among the 200 most recent" — which is the behaviour an
 * operator already believed they had.
 *
 * `shared` is what the page's composed controls publish on the viewer's
 * channel (`dataSource.bindTo`), already stripped of empty values — a
 * Person facet's `userId` narrows the read server-side the same way `q` does.
 *
 * Returns an `error` phase on a failed fetch so the surface shows a retryable
 * error region rather than a silent empty state (a read failure is an operator
 * observability gap).
 */
export async function loadConversations(
  agentName: string,
  search = '',
  shared: Readonly<Record<string, string>> = NO_SHARED_PARAMS
): Promise<ListState> {
  try {
    // What the page's controls publish (a Person facet's `userId`, a composed
    // search box's `q`) rides along first; the in-pane search box wins `q`.
    // A cleared control publishes `''`, which the read would refuse (`period=`).
    const published = Object.entries(shared).filter(([, value]) => value !== '')
    const params = new URLSearchParams({ ...Object.fromEntries(published), limit: '200' })
    // Only when non-empty: a bare `?q=` is "no search" server-side anyway, but
    // omitting it keeps the request honest about what was asked.
    if (search.trim().length > 0) params.set('q', search.trim())
    const res = await fetch(
      `/api/admin/agents/${encodeURIComponent(agentName)}/conversations?${params.toString()}`
    )
    if (!res.ok) return { phase: 'error', conversations: [] }
    const body = (await res.json()) as ListResponse
    return { phase: 'ready', conversations: (body.items ?? []).flatMap((i) => toRow(i, agentName)) }
  } catch {
    return { phase: 'error', conversations: [] }
  }
}

/**
 * Load conversations across ALL agents, tagged by agent and merged newest-first
 * ([internal ref] — the conversations viewer defaults to every agent, narrowed by
 * the agent filter), each agent's slice already narrowed server-side by
 * `search`. Per-agent reads run in parallel; a partial failure degrades
 * gracefully (the failed agent contributes no rows). The phase is `error` only
 * when EVERY agent read failed (so the surface shows a retryable error rather
 * than a misleading empty state); otherwise `ready` with the merged rows.
 */
export async function loadAllConversations(
  agentNames: ReadonlyArray<string>,
  search = '',
  shared: Readonly<Record<string, string>> = NO_SHARED_PARAMS
): Promise<ListState> {
  if (agentNames.length === 0) return { phase: 'ready', conversations: [] }
  // `search` is threaded into EVERY per-agent request. Passing it to one call
  // site would search that agent and silently ignore the rest — a partial
  // answer that looks exactly like a complete one.
  const results = await Promise.all(
    agentNames.map((name) => loadConversations(name, search, shared))
  )
  const allFailed = results.every((r) => r.phase === 'error')
  if (allFailed) return { phase: 'error', conversations: [] }
  const merged = results
    .flatMap((r) => r.conversations)
    .toSorted((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
  return { phase: 'ready', conversations: merged }
}

/** Coerce the raw conversation header, `undefined` when it carries no id. */
function toHeader(header: Partial<ConversationHeader> | undefined): ConversationHeader | undefined {
  if (header === undefined || typeof header.id !== 'string') return undefined
  return {
    id: header.id,
    title:
      typeof header.title === 'string' && header.title.length > 0
        ? header.title
        : conversationCaptions().untitled,
    userName: typeof header.userName === 'string' ? header.userName : '',
    createdAt: typeof header.createdAt === 'string' ? header.createdAt : '',
    lastActivityAt: typeof header.lastActivityAt === 'string' ? header.lastActivityAt : '',
  }
}

/** Load one conversation's message thread (chronological). `error` on failure. */
export async function loadConversation(
  agentName: string,
  conversationId: string
): Promise<ThreadState> {
  try {
    const res = await fetch(
      `/api/admin/agents/${encodeURIComponent(agentName)}/conversations/${encodeURIComponent(conversationId)}`
    )
    if (!res.ok) return { phase: 'error', header: undefined, messages: [] }
    const body = (await res.json()) as DetailResponse
    return {
      phase: 'ready',
      header: toHeader(body.conversation),
      messages: (body.messages ?? []).flatMap(toMessage),
    }
  } catch {
    return { phase: 'error', header: undefined, messages: [] }
  }
}

/**
 * A message's or a thread's moment as the run history reads one — `Today 09:32`,
 * `14 Jun, 09:32`, the year only for another year, a 24-hour clock — on the
 * operator's wall clock, never the reader's browser zone.
 */
export function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return formatDayRelativeTime(date, usableLocale(resolvePageLocale()), resolvePageTimezone())
}

/** The display label for a message role, used as the speaker tag in the thread. */
export function roleLabel(role: string): string {
  const labels: Readonly<Record<string, string>> = {
    user: 'User',
    assistant: 'Agent',
    tool: 'Tool',
    system: 'System',
  }
  return labels[role] ?? role
}
