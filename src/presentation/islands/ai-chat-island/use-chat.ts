/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { READ_ONCE_QUERY_OPTIONS } from '../runtime/query-client'
import { JSON_HEADERS, runStream, turnBody, type StreamRunContext } from './stream-turn'
import { useElicitation } from './use-elicitation'
import type {
  AiChatIslandProps,
  ChatAttachment,
  ChatElicitationAnswer,
  ChatMessage,
  ChatStatus,
  ConversationMessageDto,
} from './types'

/**
 * Chat state hook for the `ai-chat` island.
 *
 * Owns the message list, the runtime status, the stable per-mount `sessionId`,
 * and the network calls to the chat backend:
 *  - `POST /api/ai/chat/stream` for a turn: the answer is drawn as its typed
 *    events arrive (`chat-stream-client.ts`) — text, reasoning, tool lines;
 *  - `POST /api/ai/chat/stop` to stop the turn in flight; the stream then ends
 *    on `done { stopReason: 'stopped' }` with what had arrived;
 *  - `POST /api/ai/chat/approvals/:id` to approve or deny a call the agent
 *    held, whose answer is the rest of the turn, drawn into the same answer;
 *  - `POST /api/ai/chat/elicitations/:id` to answer a question the agent
 *    asked (`use-elicitation.ts`), the same way;
 *  - `GET  /api/ai/conversations` + `/:sessionId` for history replay on mount;
 *  - the branch an edit, a regeneration, a page or a chosen conversation
 *    answers (`showBranch`), which replaces the transcript.
 *
 * The hook keeps the implementation total: a failed request never throws, it
 * transitions to the `error` status and exposes a `retry()` callback that
 * repeats it — the question, or the decision on a held call.
 */

interface UseChatResult {
  readonly messages: readonly ChatMessage[]
  readonly status: ChatStatus
  readonly send: (text: string, attachments?: readonly ChatAttachment[]) => void
  readonly retry: () => void
  readonly stop: () => void
  readonly decide: (approvalId: string, decision: 'approve' | 'reject') => void
  readonly answer: (elicitationId: string, answer: ChatElicitationAnswer) => void
  /** The conversation on screen, which a turn, an edit or a regeneration goes to. */
  readonly sessionId: string
  /**
   * Put a branch the server answered on screen: an edit, a regeneration, a page
   * between answers, or a conversation chosen from the list (with its id).
   */
  readonly showBranch: (branch: Promise<readonly ChatMessage[]>, sessionId?: string) => void
  /** Start a new, empty conversation. */
  readonly startConversation: () => void
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
      // The answer as the server rendered and sanitized it, as when it streamed.
      ...(m.html !== undefined && { html: m.html, htmlCovers: m.content.length }),
    }))
}

/**
 * Replay the most recent conversation on mount when `showHistory` is enabled.
 *
 * The read is a query; the SEEDING stays an effect, and the split is the point.
 * `messages` is not a mirror of the server's list — the moment a turn is sent
 * it is a live local log that the stream appends to and patches as the reply
 * arrives. Rendering straight from the query would put the transcript back
 * under a cache that knows nothing about the turn in flight.
 */
function useHistorySeed(
  showHistory: boolean | undefined,
  setMessages: (messages: readonly ChatMessage[]) => void
): void {
  const historyQuery = useQuery({
    queryKey: ['ai-chat', 'history'],
    queryFn: loadHistory,
    enabled: showHistory === true,
    ...READ_ONCE_QUERY_OPTIONS,
  })
  const history = historyQuery.data
  useEffect(() => {
    if (history !== undefined && history.length > 0) setMessages(history)
  }, [history, setMessages])
}

/** A held call's tool line, once the server no longer waits for its decision. */
const closeCall =
  (approvalId: string) =>
  (message: ChatMessage): ChatMessage => ({
    ...message,
    tools: message.tools?.map((tool) =>
      tool.approvalId === approvalId ? { ...tool, state: 'closed' } : tool
    ),
  })

/**
 * Stop and decide. The server ends a stopped turn and its stream; only when it
 * has no turn to stop (it already ended, or never reached it) does the window
 * cut the stream itself. A decision on a held call streams the rest of the turn
 * into the answer that holds the call, from a fresh text once its stream opens;
 * a call the server no longer holds (decided elsewhere) settles closed.
 */
function useTurnControls(input: {
  readonly ctx: StreamRunContext
  readonly messages: readonly ChatMessage[]
  readonly sessionId: string
  readonly abort: () => void
}) {
  const { ctx, messages, sessionId, abort } = input
  const stop = useCallback((): void => {
    void fetch('/api/ai/chat/stop', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.status === 202)
      .catch(() => false)
      .then((stopping) => {
        if (!stopping) abort()
      })
  }, [sessionId, abort])

  const decide = useCallback(
    (approvalId: string, decision: 'approve' | 'reject'): void => {
      const holder = messages.find((m) => m.tools?.some((tool) => tool.approvalId === approvalId))
      if (holder === undefined) return
      void runStream(ctx, {
        url: `/api/ai/chat/approvals/${encodeURIComponent(approvalId)}`,
        body: { decision },
        assistantId: holder.id,
        fresh: true,
        onGone: () =>
          ctx.setMessages((prev) =>
            prev.map((m) => (m.id === holder.id ? closeCall(approvalId)(m) : m))
          ),
      })
    },
    [ctx, messages]
  )
  return { stop, decide }
}

/** Send one question: the reader's turn, an empty answer, and the stream drawn into it. */
function useRunTurn(
  ctx: StreamRunContext,
  props: Pick<AiChatIslandProps, 'agent' | 'allowedTables'>,
  turn: { readonly sessionId: string; readonly messages: readonly ChatMessage[] }
): (text: string, attachments: readonly ChatAttachment[]) => void {
  const { agent, allowedTables } = props
  const { sessionId, messages } = turn
  return useCallback(
    (text: string, attachments: readonly ChatAttachment[]): void => {
      const parentId = messages.at(-1)?.serverId
      const assistantId = crypto.randomUUID()
      const user: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        ...(attachments.length > 0 && { attachments }),
      }
      ctx.setMessages((prev) => [
        ...prev,
        user,
        { id: assistantId, role: 'assistant', content: '' },
      ])
      const body = turnBody({ agent, allowedTables }, { text, attachments, sessionId, parentId })
      void runStream(ctx, { url: '/api/ai/chat/stream', body, assistantId })
    },
    [ctx, agent, allowedTables, sessionId, messages]
  )
}

/** Show a branch the server answered, or switch to a new conversation. */
function useBranches(ctx: StreamRunContext, setSessionId: (sessionId: string) => void) {
  const showBranch = useCallback(
    (branch: Promise<readonly ChatMessage[]>, sessionId?: string): void => {
      ctx.setStatus('sending')
      void branch
        .then((messages) => {
          if (sessionId !== undefined) setSessionId(sessionId)
          ctx.setMessages(messages)
          ctx.setStatus('idle')
        })
        .catch(() => ctx.setStatus('error'))
    },
    [ctx, setSessionId]
  )
  const startConversation = useCallback((): void => {
    setSessionId(crypto.randomUUID())
    ctx.setMessages([])
    ctx.setStatus('idle')
  }, [ctx, setSessionId])
  return { showBranch, startConversation }
}

/**
 * The two requests Retry can repeat, each remembered as it is made: a question
 * (a new message dismisses a question still open, before it is sent), or a
 * decision on a held call — so a failed decision is retried as the decision,
 * never as the question before it.
 */
function useRetriable(input: {
  readonly runTurn: (text: string, attachments: readonly ChatAttachment[]) => void
  readonly cancelOpen: () => void
  readonly post: (approvalId: string, decision: 'approve' | 'reject') => void
}) {
  const { runTurn, cancelOpen, post } = input
  const lastRef = useRef<(() => void) | undefined>(undefined)
  const send = useCallback(
    (text: string, attachments: readonly ChatAttachment[] = []): void => {
      const trimmed = text.trim()
      if (trimmed.length === 0) return
      cancelOpen()
      lastRef.current = () => runTurn(trimmed, attachments)
      runTurn(trimmed, attachments)
    },
    [runTurn, cancelOpen]
  )
  const decide = useCallback(
    (approvalId: string, decision: 'approve' | 'reject'): void => {
      lastRef.current = () => post(approvalId, decision)
      post(approvalId, decision)
    },
    [post]
  )
  const retry = useCallback((): void => lastRef.current?.(), [])
  return { send, decide, retry }
}

export function useChat(props: AiChatIslandProps): UseChatResult {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const abortRef = useRef<AbortController | undefined>(undefined)
  useHistorySeed(props.showHistory, setMessages)

  const ctx = useMemo<StreamRunContext>(
    () => ({
      setMessages,
      setStatus,
      setAbort: (controller) => {
        abortRef.current = controller
      },
    }),
    []
  )
  const abort = useCallback(() => abortRef.current?.abort(), [])
  const { stop, decide: post } = useTurnControls({ ctx, messages, sessionId, abort })
  const branches = useBranches(ctx, setSessionId)

  const runTurn = useRunTurn(ctx, props, { sessionId, messages })
  const { answer, cancelOpen } = useElicitation({ ctx, messages, labels: props.labels.question })
  const requests = useRetriable({ runTurn, cancelOpen, post })

  return { messages, status, answer, sessionId, stop, ...requests, ...branches }
}
