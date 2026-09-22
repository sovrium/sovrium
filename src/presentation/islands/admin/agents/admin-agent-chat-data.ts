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
 * TRANSPORT: `POST /api/ai/chat` with `{ message, sessionId, agent }`.
 *
 * It used to post to `POST /api/agents/:agentSlug/chat`, which advertises no
 * table tools, runs no tool-execution loop, and returns no `actions[]` — so the
 * console could show what an agent SAID and never what it DID. It also
 * hard-coded the OpenAI-compatible provider path, which 404s against the
 * Ollama base URL Sovrium ships as its default. The agent-bound branch of
 * `/api/ai/chat` goes through the `AiService` port and fixes all three at once.
 *
 * Attribution survives the move: the old route stamped `agent_name` correctly
 * and the generic route did not, so the swap would have silently filed every
 * console conversation under the general-purpose agent. That is now a
 * both-directions invariant of the endpoint itself, which
 * is why the swap is safe to make here rather than a regression to accept.
 *
 * The success envelope is `{ reply, actions, sessionId }`; a provider failure is
 * a genuine non-2xx (502) rather than a 200 carrying a diagnostic in `reply`
 *. Either way the chat surface appends an assistant
 * turn (the reply, or a calm degrade note) so the operator always sees a
 * response in the thread — the agent never silently swallows a
 * turn.
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
import { isDefaultAgentName } from '@/domain/models/app/agents/agent-identity'
import { dispatch } from '../../runtime/event-bus'
import type { ChatTurnAction } from './admin-agent-chat-actions'

/** A single chat turn rendered in the conversation thread. */
export interface AgentChatTurn {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  /**
   * What the assistant DID on this turn — the live `actions[]` the chat
   * endpoint returns alongside `reply`. Absent on user turns, and on any
   * assistant turn the endpoint answered without acting.
   *
   * Read from the response, never from `ai_messages.tool_calls`: that column is
   * written by nothing, so a card built over it would be permanently blank.
   */
  readonly actions?: ReadonlyArray<ChatTurnAction>
}

/** Runtime states of the chat surface. */
export type AgentChatStatus = 'idle' | 'sending'

interface ChatWire {
  readonly reply?: unknown
  readonly error?: unknown
  readonly actions?: unknown
}

/**
 * Narrow the wire's `actions` to the renderable shape. The field is validated
 * rather than cast: it crosses an HTTP boundary, and one malformed entry must
 * not take the whole assistant turn down with it — a turn with no cards is a
 * far better failure than a turn that does not render.
 */
const readActions = (raw: unknown): ReadonlyArray<ChatTurnAction> => {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (entry): entry is ChatTurnAction =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { type?: unknown }).type === 'string' &&
      typeof (entry as { description?: unknown }).description === 'string'
  )
}

/** The degrade note shown as the assistant turn when the provider is unavailable. */
const PROVIDER_DEGRADE_REPLY =
  'The agent could not reply — check the AI provider configuration, then try again.'

/** A round-trip outcome: the reply text, the actions taken, and whether the turn genuinely persisted. */
interface ChatOutcome {
  readonly reply: string
  readonly actions: ReadonlyArray<ChatTurnAction>
  readonly persisted: boolean
}

/**
 * The request body for one turn.
 *
 * The reserved `default` agent is a VIEW over the `agent_name IS NULL` rows, not
 * a declared `app.agents[]` entry — so naming it would 404 as an undeclared
 * agent. Omitting `agent` sends a generic turn, which persists exactly the NULL
 * attribution that view is defined as. Without this the console's LANDING
 * agent is the one agent you cannot talk to.
 */
function chatBody(agentSlug: string, message: string, sessionId: string): Record<string, unknown> {
  return {
    message,
    sessionId,
    ...(agentSlug.length > 0 && !isDefaultAgentName(agentSlug) ? { agent: agentSlug } : {}),
  }
}

/**
 * Post a single message to the agent-bound chat endpoint and resolve the
 * assistant's reply plus the actions the turn took. A non-2xx response (the AI
 * provider is not configured → 503, or failed → 502) resolves to a calm degrade
 * note rather than throwing, so the thread always renders an assistant turn.
 *
 * `persisted` is true only on a real `{ reply }` round-trip — a degraded reply
 * did NOT write to the durable store, so the list refresh (CONV-013) must NOT
 * fire for it. An `error` key is treated as a failure even on a 200: the
 * endpoint no longer paints a provider diagnostic into `reply`, and this guard
 * is what keeps that from silently becoming an assistant turn again if it ever
 * regresses.
 */
async function postAgentChat(
  agentSlug: string,
  message: string,
  sessionId: string
): Promise<ChatOutcome> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatBody(agentSlug, message, sessionId)),
    })
    const body = (await res.json().catch(() => ({}) as ChatWire)) as ChatWire
    if (
      res.ok &&
      body.error === undefined &&
      typeof body.reply === 'string' &&
      body.reply.length > 0
    ) {
      return { reply: body.reply, actions: readActions(body.actions), persisted: true }
    }
    return { reply: PROVIDER_DEGRADE_REPLY, actions: [], persisted: false }
  } catch {
    return { reply: PROVIDER_DEGRADE_REPLY, actions: [], persisted: false }
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
          actions: outcome.actions,
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
