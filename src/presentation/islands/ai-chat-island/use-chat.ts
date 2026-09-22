/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { READ_ONCE_QUERY_OPTIONS } from '../runtime/query-client'
import type { AiChatIslandProps, ChatMessage, ChatStatus, ConversationMessageDto } from './types'

/**
 * Chat state hook for the `ai-chat` island.
 *
 * Owns the message list, the runtime status (idle / sending / error), the
 * stable per-mount `sessionId`, and the network calls to the chat backend:
 *  - `POST /api/ai/chat` for sending a turn. The non-streaming endpoint is
 *    used (not `/stream`) because it handles agent binding and maps provider
 *    failures onto HTTP error statuses — the assistant text is rendered
 *    progressively client-side as a typing effect.
 *  - `GET  /api/ai/conversations` + `/:sessionId` for history replay on mount.
 *
 * The hook keeps the implementation total: a failed turn never throws, it
 * transitions to the `error` status and exposes a `retry()` callback that
 * re-sends the last user message.
 */

interface UseChatResult {
  readonly messages: readonly ChatMessage[]
  readonly status: ChatStatus
  readonly send: (text: string) => void
  readonly retry: () => void
}

/**
 * Outcome of one chat turn dispatched to the backend.
 *  - `ok`           — the assistant reply.
 *  - `rate-limited` — the per-user quota was exceeded (HTTP 429); the message
 *    is shown inline in the log so the user sees the cooldown notice.
 *  - `error`        — any other failure; surfaced via the error banner + retry.
 */
type ChatTurnOutcome =
  | { readonly kind: 'ok'; readonly reply: string }
  | { readonly kind: 'rate-limited'; readonly message: string }
  | { readonly kind: 'error' }

/**
 * Send one chat turn to `POST /api/ai/chat`. Returns the assistant reply on a
 * 200 response, a `rate-limited` outcome on HTTP 429, or `error` for any other
 * failure status so the caller can surface the appropriate UI.
 */
async function sendChatTurn(args: {
  readonly message: string
  readonly sessionId: string
  readonly agent: string | undefined
  readonly allowedTables: ReadonlyArray<string> | undefined
}): Promise<ChatTurnOutcome> {
  const body = {
    message: args.message,
    sessionId: args.sessionId,
    ...(args.agent !== undefined && { agent: args.agent }),
    ...(args.allowedTables !== undefined && {
      pageContext: { allowedTables: args.allowedTables },
    }),
  }
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 429) {
    const json = (await res.json().catch(() => undefined)) as
      { readonly error?: string } | undefined
    return {
      kind: 'rate-limited',
      message:
        json?.error ?? 'You have exceeded the AI chat rate limit. Please wait and try again.',
    }
  }
  if (!res.ok) return { kind: 'error' }
  const json = (await res.json().catch(() => undefined)) as { readonly reply?: string } | undefined
  if (json === undefined || typeof json.reply !== 'string') return { kind: 'error' }
  return { kind: 'ok', reply: json.reply }
}

/**
 * Render `text` progressively into `onDelta` as a lightweight typing effect,
 * so the assistant message visibly streams in even though the non-streaming
 * endpoint returns it in one shot.
 */
async function typeOut(text: string, onDelta: (partial: string) => void): Promise<void> {
  const STEP = 24
  // eslint-disable-next-line functional/no-loop-statements -- progressive reveal pump
  for (let end = STEP; end < text.length; end += STEP) {
    onDelta(text.slice(0, end))
    await new Promise((resolve) => setTimeout(resolve, 12))
  }
  onDelta(text)
}

/** Load the most recent conversation's turns for history replay. */
async function loadHistory(): Promise<readonly ChatMessage[]> {
  const listRes = await fetch('/api/ai/conversations')
  if (!listRes.ok) return []
  const list = (await listRes.json()) as {
    readonly conversations?: readonly { readonly sessionId: string }[]
  }
  const latest = list.conversations?.[0]
  if (latest === undefined) return []
  const detailRes = await fetch(`/api/ai/conversations/${latest.sessionId}`)
  if (!detailRes.ok) return []
  const detail = (await detailRes.json()) as {
    readonly messages?: readonly ConversationMessageDto[]
  }
  return (detail.messages ?? [])
    .filter((m): m is ConversationMessageDto => m.role === 'user' || m.role === 'assistant')
    .map((m, i) => ({
      id: `history-${String(i)}`,
      role: m.role as ChatMessage['role'],
      content: m.content,
    }))
}

/** Update one message (by id) in a message list, immutably. */
const patchMessage = (
  list: readonly ChatMessage[],
  id: string,
  content: string
): readonly ChatMessage[] => list.map((m) => (m.id === id ? { ...m, content } : m))

/** Inputs for running one chat turn against the backend. */
interface RunTurnContext {
  readonly text: string
  readonly sessionId: string
  readonly agent: string | undefined
  readonly allowedTables: ReadonlyArray<string> | undefined
  readonly setMessages: React.Dispatch<React.SetStateAction<readonly ChatMessage[]>>
  readonly setStatus: (status: ChatStatus) => void
}

/**
 * Run one chat turn: append the user message + an empty assistant placeholder,
 * dispatch to the backend, then either type out the reply, show the inline
 * rate-limit notice, or drop the placeholder and surface the error state.
 */
async function runChatTurn(ctx: RunTurnContext): Promise<void> {
  ctx.setStatus('sending')
  const userId = crypto.randomUUID()
  const assistantId = crypto.randomUUID()
  ctx.setMessages((prev) => [
    ...prev,
    { id: userId, role: 'user', content: ctx.text },
    { id: assistantId, role: 'assistant', content: '' },
  ])
  const updateAssistant = (content: string): void => {
    ctx.setMessages((prev) => patchMessage(prev, assistantId, content))
  }
  try {
    const outcome = await sendChatTurn({
      message: ctx.text,
      sessionId: ctx.sessionId,
      agent: ctx.agent,
      allowedTables: ctx.allowedTables,
    })
    if (outcome.kind === 'rate-limited') {
      // The cooldown notice is shown inline in the log (not the error banner)
      // so the user sees the rate-limit message in context.
      updateAssistant(outcome.message)
      ctx.setStatus('idle')
      return
    }
    if (outcome.kind === 'error') {
      // Drop the empty assistant placeholder; surface the error banner.
      ctx.setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      ctx.setStatus('error')
      return
    }
    await typeOut(outcome.reply, updateAssistant)
    ctx.setStatus('idle')
  } catch {
    ctx.setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    ctx.setStatus('error')
  }
}

export function useChat(props: AiChatIslandProps): UseChatResult {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const lastMessageRef = useRef<string>('')

  // History replay on mount when `showHistory` is enabled.
  //
  // The read is a query; the SEEDING stays an effect, and the split is the point.
  // `messages` is not a mirror of the server's list — the moment a turn is sent
  // it is a live local log that `runChatTurn` appends to and patches as the
  // reply types out. Rendering straight from the query would put the transcript
  // back under a cache that knows nothing about the turn in flight.
  const historyQuery = useQuery({
    queryKey: ['ai-chat', 'history'],
    queryFn: loadHistory,
    enabled: props.showHistory === true,
    ...READ_ONCE_QUERY_OPTIONS,
  })

  const history = historyQuery.data
  useEffect(() => {
    if (history !== undefined && history.length > 0) setMessages(history)
  }, [history])

  const runTurn = useCallback(
    (text: string): Promise<void> =>
      runChatTurn({
        text,
        sessionId: sessionIdRef.current,
        agent: props.agent,
        allowedTables: props.allowedTables,
        setMessages,
        setStatus,
      }),
    [props.agent, props.allowedTables]
  )

  const send = useCallback(
    (text: string): void => {
      const trimmed = text.trim()
      if (trimmed.length === 0) return
      // eslint-disable-next-line functional/immutable-data -- React ref mutation is idiomatic
      lastMessageRef.current = trimmed
      void runTurn(trimmed)
    },
    [runTurn]
  )

  const retry = useCallback((): void => {
    if (lastMessageRef.current.length === 0) return
    void runTurn(lastMessageRef.current)
  }, [runTurn])

  return { messages, status, send, retry }
}
