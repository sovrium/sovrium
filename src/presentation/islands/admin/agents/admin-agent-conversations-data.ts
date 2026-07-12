/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface ConversationRow {
  readonly id: string
  readonly agentName: string
  readonly title: string
  readonly sessionId: string
  readonly messageCount: number
  readonly lastActivityAt: string
  readonly createdAt: string
}

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

export interface ConversationHeader {
  readonly id: string
  readonly title: string
  readonly sessionId: string
  readonly createdAt: string
  readonly lastActivityAt: string
}

export type LoadPhase = 'loading' | 'ready' | 'error'

export interface ListState {
  readonly phase: LoadPhase
  readonly conversations: ReadonlyArray<ConversationRow>
}

export interface ThreadState {
  readonly phase: 'idle' | LoadPhase
  readonly header: ConversationHeader | undefined
  readonly messages: ReadonlyArray<ThreadMessage>
}

export const LIST_LOADING: ListState = { phase: 'loading', conversations: [] }
export const THREAD_IDLE: ThreadState = { phase: 'idle', header: undefined, messages: [] }
export const THREAD_LOADING: ThreadState = { phase: 'loading', header: undefined, messages: [] }

interface ListResponse {
  readonly items?: ReadonlyArray<Partial<ConversationRow>>
  readonly nextCursor?: string | undefined
}

interface DetailResponse {
  readonly conversation?: Partial<ConversationHeader>
  readonly messages?: ReadonlyArray<Partial<ThreadMessage>>
}

function toRow(item: Partial<ConversationRow>, agentName: string): ReadonlyArray<ConversationRow> {
  if (typeof item.id !== 'string') return []
  return [
    {
      id: item.id,
      agentName,
      title: typeof item.title === 'string' && item.title.length > 0 ? item.title : 'Sans titre',
      sessionId: typeof item.sessionId === 'string' ? item.sessionId : '',
      messageCount: typeof item.messageCount === 'number' ? item.messageCount : 0,
      lastActivityAt: typeof item.lastActivityAt === 'string' ? item.lastActivityAt : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    },
  ]
}

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
              title: typeof header.title === 'string' ? header.title : 'Sans titre',
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

export function formatRelative(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const ms = date.getTime()
  if (Number.isNaN(ms)) return '—'
  const diff = Date.now() - ms
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `il y a ${days} j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

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

export function roleLabel(role: string): string {
  const labels: Readonly<Record<string, string>> = {
    user: 'Utilisateur',
    assistant: 'Agent',
    tool: 'Outil',
    system: 'Système',
  }
  return labels[role] ?? role
}
