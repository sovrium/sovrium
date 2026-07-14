/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiChatIslandProps, ChatMessage, ChatStatus, ConversationMessageDto } from './types'


interface UseChatResult {
  readonly messages: readonly ChatMessage[]
  readonly status: ChatStatus
  readonly send: (text: string) => void
  readonly retry: () => void
}

type ChatTurnOutcome =
  | { readonly kind: 'ok'; readonly reply: string }
  | { readonly kind: 'rate-limited'; readonly message: string }
  | { readonly kind: 'error' }

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

async function typeOut(text: string, onDelta: (partial: string) => void): Promise<void> {
  const STEP = 24
  for (let end = STEP; end < text.length; end += STEP) {
    onDelta(text.slice(0, end))
    await new Promise((resolve) => setTimeout(resolve, 12))
  }
  onDelta(text)
}

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

const patchMessage = (
  list: readonly ChatMessage[],
  id: string,
  content: string
): readonly ChatMessage[] => list.map((m) => (m.id === id ? { ...m, content } : m))

interface RunTurnContext {
  readonly text: string
  readonly sessionId: string
  readonly agent: string | undefined
  readonly allowedTables: ReadonlyArray<string> | undefined
  readonly setMessages: React.Dispatch<React.SetStateAction<readonly ChatMessage[]>>
  readonly setStatus: (status: ChatStatus) => void
}

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
      updateAssistant(outcome.message)
      ctx.setStatus('idle')
      return
    }
    if (outcome.kind === 'error') {
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

  useEffect(() => {
    if (props.showHistory !== true) return
    void loadHistory().then((history) => {
      if (history.length > 0) setMessages(history)
    })
  }, [props.showHistory])

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
