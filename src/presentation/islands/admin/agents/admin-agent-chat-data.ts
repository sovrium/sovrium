/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * State + fetch helper for the `admin-agent-chat` island (the agents domain's
 * Discussion tab, [internal ref] — and the Conversations page's
 * "New conversation" composer, [internal ref]).
 *
 * Posts each turn to the EXISTING active-config agent-chat handler
 * (`POST /api/agents/:agentSlug/chat`) — no new backend. The handler returns a
 * `{ reply }` envelope on success; when the platform AI provider is not
 * configured it returns a non-2xx `{ error }` envelope. Either way the chat
 * surface appends an assistant turn (the reply, or a calm degrade note) so the
 * operator always sees a response in the thread — the agent
 * never silently swallows a turn.
 *
 * Each hook instance mints a FRESH unique `sessionId` (`crypto.randomUUID()`):
 * the durable store upserts conversation rows by `(userId, sessionId)`, so a
 * fixed id would collapse every "New conversation" into ONE row
 *. A successful round-trip dispatches
 * `sovrium:crud-success` keyed `agent-conversation:${agentSlug}` so the
 * conversation LIST island can reload via the event bus (CONV-013, the same
 * pattern the bucket-files list uses after an upload — no TanStack Query).
 */

import { useCallback, useState } from 'react'
import { dispatch } from '../../_shared/event-bus'

/** A single chat turn rendered in the conversation thread. */
export interface AgentChatTurn {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** Runtime states of the chat surface. */
export type AgentChatStatus = 'idle' | 'sending'

interface ChatWire {
  readonly reply?: unknown
  readonly error?: unknown
}

/** The degrade note shown as the assistant turn when the provider is unavailable. */
const PROVIDER_DEGRADE_REPLY =
  'The agent could not reply — check the AI provider configuration, then try again.'

/** A round-trip outcome: the reply text + whether the turn genuinely persisted. */
interface ChatOutcome {
  readonly reply: string
  readonly persisted: boolean
}

/**
 * Post a single message to the active-config agent-chat handler and resolve the
 * assistant's reply text. A non-2xx response (e.g. the AI provider is not
 * configured) resolves to a calm degrade note rather than throwing, so the
 * thread always renders an assistant turn. `persisted` is true only on a real
 * `{ reply }` round-trip — a degraded reply did NOT write to the durable store,
 * so the list refresh (CONV-013) must NOT fire for it.
 */
async function postAgentChat(
  agentSlug: string,
  message: string,
  sessionId: string
): Promise<ChatOutcome> {
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentSlug)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
    })
    const body = (await res.json().catch(() => ({}) as ChatWire)) as ChatWire
    if (res.ok && typeof body.reply === 'string' && body.reply.length > 0) {
      return { reply: body.reply, persisted: true }
    }
    return { reply: PROVIDER_DEGRADE_REPLY, persisted: false }
  } catch {
    return { reply: PROVIDER_DEGRADE_REPLY, persisted: false }
  }
}

/** Stable per-turn identity for the React list key. */
const nextTurnId = (): string => `agent-chat-turn-${crypto.randomUUID()}`

/**
 * Conversation state for the Discussion chat / "New conversation" composer:
 * the turn list, the send status, and a `send` callback that appends the user
 * turn, posts to the agent-chat handler, and appends the agent's reply turn.
 *
 * A fresh `sessionId` is minted once per hook instance (`crypto.randomUUID()`),
 * so each composer mount is its own conversation row (CONV-011). On a genuine
 * round-trip the hook dispatches `sovrium:crud-success` keyed
 * `agent-conversation:${agentSlug}` so the list island reloads (CONV-013).
 */
export function useAgentChat(agentSlug: string): {
  readonly turns: ReadonlyArray<AgentChatTurn>
  readonly status: AgentChatStatus
  readonly send: (message: string) => void
} {
  const [turns, setTurns] = useState<ReadonlyArray<AgentChatTurn>>([])
  const [status, setStatus] = useState<AgentChatStatus>('idle')
  // One fresh sessionId per composer mount: the durable store upserts by
  // `(userId, sessionId)`, so every "New conversation" must be distinct.
  const [sessionId] = useState(() => crypto.randomUUID())

  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim()
      if (trimmed.length === 0) return
      const userTurn: AgentChatTurn = { id: nextTurnId(), role: 'user', content: trimmed }
      setTurns((prev) => [...prev, userTurn])
      setStatus('sending')
      void postAgentChat(agentSlug, trimmed, sessionId).then((outcome) => {
        const agentTurn: AgentChatTurn = {
          id: nextTurnId(),
          role: 'assistant',
          content: outcome.reply,
        }
        setTurns((prev) => [...prev, agentTurn])
        setStatus('idle')
        // Only a genuinely-persisted turn surfaces in the admin list — refresh it.
        if (outcome.persisted && agentSlug.length > 0) {
          dispatch('sovrium:crud-success', {
            table: `agent-conversation:${agentSlug}`,
            operation: 'create',
          })
        }
      })
    },
    [agentSlug, sessionId]
  )

  return { turns, status, send }
}
