/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type {
  ChatCitation,
  ChatElicitation,
  ChatMessage,
  ChatToolLine,
  ChatToolState,
} from './types'

/**
 * Reading the chat stream in the window: the typed SSE events of
 * `POST /api/ai/chat/stream` (and of an approval decision, whose answer is the
 * rest of the turn), and how each one changes the assistant's turn.
 *
 * The wire, as the server writes it:
 *  - `content { text, html? }` — a delta of the answer; now and then `html`,
 *    the whole answer so far rendered from Markdown and sanitized server-side;
 *  - `reasoning { text }` — a delta of the model's reasoning;
 *  - `tool_call { id, name }`, then `tool_result { id, name, outcome, approvalId? }`;
 *  - `elicit { elicitationId, message, requestedSchema }` — a question the
 *    agent asks the reader, the turn then waiting on her answer;
 *  - `done { stopReason, html?, messageId, questionId, citations? }` — `end`,
 *    `stopped`, `awaiting_input`, …, with the final rendering, the ids the
 *    exchange is saved under and the sources the answer cites; then `[DONE]`.
 */

/** One event of the chat stream, as the window reads it. */
export type ChatStreamEvent =
  | { readonly type: 'content'; readonly text: string; readonly html?: string }
  | { readonly type: 'reasoning'; readonly text: string }
  | { readonly type: 'tool_call'; readonly id: string; readonly name: string }
  | {
      readonly type: 'tool_result'
      readonly id: string
      readonly name: string
      readonly outcome: string
      readonly approvalId?: string
    }
  | {
      readonly type: 'done'
      readonly stopReason: string
      readonly html?: string
      /** The ids the answer and its question are saved under. */
      readonly messageId?: string | undefined
      readonly questionId?: string | undefined
      readonly citations?: readonly ChatCitation[]
    }
  | {
      readonly type: 'elicit'
      readonly id: string
      readonly message: string
      readonly requestedSchema: ChatElicitation['requestedSchema']
      readonly server?: string
    }

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const optStr = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** The JSON payload of an event, or `undefined` for the sentinel and anything unreadable. */
const parsePayload = (raw: string): Readonly<Record<string, unknown>> | undefined => {
  if (raw === '[DONE]' || raw === '') return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Readonly<Record<string, unknown>>)
      : undefined
  } catch {
    return undefined
  }
}

/** `{ html }` when the payload carries a rendering, otherwise nothing. */
const htmlOf = (payload: Readonly<Record<string, unknown>>): { readonly html?: string } => {
  const html = optStr(payload['html'])
  return html === undefined ? {} : { html }
}

/** Each event the window reads, from its payload. */
const EVENT_READERS: Readonly<
  Record<string, (payload: Readonly<Record<string, unknown>>) => ChatStreamEvent>
> = {
  content: (p) => ({ type: 'content', text: str(p['text']), ...htmlOf(p) }),
  reasoning: (p) => ({ type: 'reasoning', text: str(p['text']) }),
  tool_call: (p) => ({ type: 'tool_call', id: str(p['id']), name: str(p['name']) }),
  tool_result: (p) => {
    const approvalId = optStr(p['approvalId'])
    return {
      type: 'tool_result',
      id: str(p['id']),
      name: str(p['name']),
      outcome: str(p['outcome']),
      ...(approvalId !== undefined && { approvalId }),
    }
  },
  done: (p) => ({
    type: 'done',
    stopReason: str(p['stopReason']),
    ...htmlOf(p),
    messageId: optStr(p['messageId']),
    questionId: optStr(p['questionId']),
    ...(Array.isArray(p['citations']) && { citations: p['citations'] as ChatCitation[] }),
  }),
  elicit: (p) => ({
    type: 'elicit',
    id: str(p['elicitationId']),
    message: str(p['message']),
    requestedSchema: (typeof p['requestedSchema'] === 'object' && p['requestedSchema'] !== null
      ? p['requestedSchema']
      : { properties: {} }) as ChatElicitation['requestedSchema'],
    ...(typeof p['server'] === 'string' && { server: p['server'] }),
  }),
}

/** One SSE block as an event; `undefined` for the sentinel and anything unknown. */
const toEvent = (name: string, raw: string): ChatStreamEvent | undefined => {
  const reader = EVENT_READERS[name]
  const payload = parsePayload(raw)
  return reader === undefined || payload === undefined ? undefined : reader(payload)
}

/** Parse one SSE block (`event:` and `data:` lines). */
const parseBlock = (block: string): ChatStreamEvent | undefined => {
  const lines = block.split(/\r?\n/)
  const name =
    lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim() ?? 'message'
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  return toEvent(name, data)
}

/**
 * Read a chat stream to its end, handing each event to `onEvent` as it
 * arrives. Answers whether the turn reached its `done`: a stream that ends
 * without it was cut short.
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void
): Promise<boolean> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false
  const flush = (blocks: readonly string[]): void => {
    blocks.forEach((block) => {
      const event = parseBlock(block)
      if (event === undefined) return
      if (event.type === 'done') sawDone = true
      onEvent(event)
    })
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.at(-1) ?? ''
    flush(blocks.slice(0, -1))
  }
  flush([buffer + decoder.decode()])
  return sawDone
}

/** A tool's line state, by the outcome the server reported. */
const STATE_BY_OUTCOME: Readonly<Record<string, ChatToolState>> = {
  ok: 'done',
  denied: 'denied',
  failed: 'failed',
  'pending-approval': 'pending-approval',
}

/** Put one tool line in the turn's list: replaced by id, or added at the end. */
const putTool = (
  tools: readonly ChatToolLine[] | undefined,
  line: ChatToolLine
): readonly ChatToolLine[] => {
  const list = tools ?? []
  return list.some((tool) => tool.id === line.id)
    ? list.map((tool) => (tool.id === line.id ? line : tool))
    : [...list, line]
}

/** The answer once a delta, and maybe a fresh rendering, arrived. */
const withContent = (
  message: ChatMessage,
  event: Extract<ChatStreamEvent, { readonly type: 'content' }>
): ChatMessage => {
  const content = message.content + event.text
  return event.html === undefined
    ? { ...message, content }
    : { ...message, content, html: event.html, htmlCovers: content.length }
}

/** A tool's line once the agent called it, unless it is already drawn. */
const withCall = (
  message: ChatMessage,
  event: Extract<ChatStreamEvent, { readonly type: 'tool_call' }>
): ChatMessage =>
  message.tools?.some((tool) => tool.id === event.id) === true
    ? message
    : {
        ...message,
        tools: putTool(message.tools, { id: event.id, name: event.name, state: 'running' }),
      }

/** A tool's line once its result arrived. */
const withResult = (
  message: ChatMessage,
  event: Extract<ChatStreamEvent, { readonly type: 'tool_result' }>
): ChatMessage => ({
  ...message,
  tools: putTool(message.tools, {
    id: event.id,
    name: event.name,
    state: STATE_BY_OUTCOME[event.outcome] ?? 'failed',
    ...(event.approvalId !== undefined && { approvalId: event.approvalId }),
  }),
})

/** The answer once it ended: its final rendering, and the sources it cites. */
const withDone = (
  message: ChatMessage,
  event: Extract<ChatStreamEvent, { readonly type: 'done' }>
): ChatMessage => ({
  ...message,
  streaming: false,
  stopReason: event.stopReason,
  ...(event.html !== undefined && { html: event.html, htmlCovers: message.content.length }),
  ...(event.citations !== undefined && { citations: event.citations }),
})

/** The assistant's turn once one more event of its stream has arrived. */
export const applyStreamEvent = (message: ChatMessage, event: ChatStreamEvent): ChatMessage => {
  switch (event.type) {
    case 'content':
      return withContent(message, event)
    case 'reasoning':
      return { ...message, reasoning: (message.reasoning ?? '') + event.text }
    case 'tool_call':
      return withCall(message, event)
    case 'tool_result':
      return withResult(message, event)
    case 'elicit':
      return {
        ...message,
        elicitation: {
          id: event.id,
          message: event.message,
          requestedSchema: event.requestedSchema,
          ...(event.server !== undefined && { server: event.server }),
          state: 'open',
        },
      }
    case 'done':
      return withDone(message, event)
  }
}

/** Whether a turn has drawn nothing yet — no text, no reasoning, no tool line. */
export const isBlankAnswer = (message: ChatMessage): boolean =>
  message.content.length === 0 &&
  (message.reasoning ?? '').length === 0 &&
  (message.tools ?? []).length === 0 &&
  message.elicitation === undefined
