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

/** One conversation in the list column (mirrors `agentConversationListItemSchema`). */
export interface ConversationRow {
  readonly id: string
  /** The owning agent's name — set when merging across agents. */
  readonly agentName: string
  readonly title: string
  readonly sessionId: string
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
  readonly sessionId: string
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
      title: typeof item.title === 'string' && item.title.length > 0 ? item.title : 'Untitled',
      sessionId: typeof item.sessionId === 'string' ? item.sessionId : '',
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
 * Load the agent's conversation list (newest-first). Returns an `error` phase on
 * a failed fetch so the surface shows a retryable error region rather than a
 * silent empty state (a read failure is an operator observability gap).
 */
export async function loadConversations(agentName: string): Promise<ListState> {
  try {
    const res = await fetch(
      `/api/admin/agents/${encodeURIComponent(agentName)}/conversations?limit=200`
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
 * the agent filter). Per-agent reads run in parallel; a partial failure degrades
 * gracefully (the failed agent contributes no rows). The phase is `error` only
 * when EVERY agent read failed (so the surface shows a retryable error rather
 * than a misleading empty state); otherwise `ready` with the merged rows.
 */
export async function loadAllConversations(agentNames: ReadonlyArray<string>): Promise<ListState> {
  if (agentNames.length === 0) return { phase: 'ready', conversations: [] }
  const results = await Promise.all(agentNames.map((name) => loadConversations(name)))
  const allFailed = results.every((r) => r.phase === 'error')
  if (allFailed) return { phase: 'error', conversations: [] }
  const merged = results
    .flatMap((r) => r.conversations)
    .toSorted((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
  return { phase: 'ready', conversations: merged }
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
    const header = body.conversation
    return {
      phase: 'ready',
      header:
        header && typeof header.id === 'string'
          ? {
              id: header.id,
              title: typeof header.title === 'string' ? header.title : 'Untitled',
              sessionId: typeof header.sessionId === 'string' ? header.sessionId : '',
              createdAt: typeof header.createdAt === 'string' ? header.createdAt : '',
              lastActivityAt:
                typeof header.lastActivityAt === 'string' ? header.lastActivityAt : '',
            }
          : undefined,
      messages: (body.messages ?? []).flatMap(toMessage),
    }
  } catch {
    return { phase: 'error', header: undefined, messages: [] }
  }
}

/** Format an ISO timestamp as a compact relative French label ("il y a 2 h"). */
export function formatRelative(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const ms = date.getTime()
  if (Number.isNaN(ms)) return '—'
  const diff = Date.now() - ms
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `il y a ${days} j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Format an ISO timestamp as a short French date + time for a message ("14 juin, 09:32"). */
export function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
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
