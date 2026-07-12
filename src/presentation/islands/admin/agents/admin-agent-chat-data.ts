/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useCallback, useState } from 'react'
import { dispatch } from '../../_shared/event-bus'

export interface AgentChatTurn {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export type AgentChatStatus = 'idle' | 'sending'

interface ChatWire {
  readonly reply?: unknown
  readonly error?: unknown
}

const PROVIDER_DEGRADE_REPLY =
  "L'agent n'a pas pu répondre — vérifiez la configuration du fournisseur d'IA, puis réessayez."

interface ChatOutcome {
  readonly reply: string
  readonly persisted: boolean
}

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

const nextTurnId = (): string => `agent-chat-turn-${crypto.randomUUID()}`

export function useAgentChat(agentSlug: string): {
  readonly turns: ReadonlyArray<AgentChatTurn>
  readonly status: AgentChatStatus
  readonly send: (message: string) => void
} {
  const [turns, setTurns] = useState<ReadonlyArray<AgentChatTurn>>([])
  const [status, setStatus] = useState<AgentChatStatus>('idle')
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
