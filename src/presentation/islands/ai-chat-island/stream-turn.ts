/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  applyStreamEvent,
  isBlankAnswer,
  readChatStream,
  type ChatStreamEvent,
} from './chat-stream-client'
import { partsForTurn } from './use-attachment-upload'
import type { AiChatIslandProps, ChatAttachment, ChatMessage, ChatStatus } from './types'

/**
 * One request whose answer is a chat stream — a question, or a decision on a
 * held call — drawn into one assistant turn as its events arrive.
 */

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

/** What one streamed request needs to run and to be drawn. */
export interface StreamRunContext {
  readonly setMessages: React.Dispatch<React.SetStateAction<readonly ChatMessage[]>>
  readonly setStatus: (status: ChatStatus) => void
  /** Keeps the request's controller, so a stop the server cannot deliver can cut it. */
  readonly setAbort: (controller: AbortController | undefined) => void
}

/** The request, and the assistant turn its stream is drawn into. */
export interface StreamRequest {
  readonly url: string
  readonly body: unknown
  readonly assistantId: string
  /**
   * The stream redraws the turn's answer from a fresh text (a decision on a
   * held call: the rest of the turn is rendered on its own). Cleared only once
   * the stream starts, so a refused decision keeps the answer it had.
   */
  readonly fresh?: boolean
  /**
   * A refusal the request expects — an answer that does not fit the agent's
   * question. Handed the response; the turn and the window stay as they were.
   */
  readonly onRefused?: (res: Response) => Promise<void>
  /**
   * The server no longer holds what the request answers (404, 409): a decision
   * or an answer given elsewhere, or expired. Nothing failed — the turn settles
   * where it is, and the window shows no failure line.
   */
  readonly onGone?: () => void
  /** How the turn changes once the stream opens — a question answered. */
  readonly opened?: (message: ChatMessage) => ChatMessage
}

/** The cooldown notice of a refused turn, as the server words it. */
const rateLimitNotice = async (res: Response): Promise<string> => {
  const json = (await res.json().catch(() => undefined)) as { readonly error?: string } | undefined
  return json?.error ?? 'You have exceeded the AI chat rate limit. Please wait and try again.'
}

/** Change the assistant turn of `request` only. */
const patcher =
  (ctx: StreamRunContext, request: StreamRequest) =>
  (update: (message: ChatMessage) => ChatMessage): void =>
    ctx.setMessages((prev) => prev.map((m) => (m.id === request.assistantId ? update(m) : m)))

/** A failed request: a blank turn goes, a drawn one stays as it is; the error line shows. */
const failTurn = (ctx: StreamRunContext, request: StreamRequest): void => {
  ctx.setMessages((prev) =>
    prev.flatMap((m) =>
      m.id !== request.assistantId ? [m] : isBlankAnswer(m) ? [] : [{ ...m, streaming: false }]
    )
  )
  ctx.setStatus('error')
}

/**
 * Name the exchange by the ids `done` told, once the stream closed — the server
 * closes it only after the exchange is saved, so Edit and Regenerate never name
 * a message not written yet. A turn paused on the reader is not saved yet.
 */
const nameExchange = (
  ctx: StreamRunContext,
  request: StreamRequest,
  done: Extract<ChatStreamEvent, { readonly type: 'done' }>
): void => {
  const { messageId, questionId } = done
  if (messageId === undefined || done.stopReason === 'awaiting_input') return
  ctx.setMessages((prev) =>
    prev.map((m, i) =>
      m.id === request.assistantId
        ? { ...m, serverId: messageId }
        : prev[i + 1]?.id === request.assistantId && questionId !== undefined
          ? { ...m, serverId: questionId }
          : m
    )
  )
}

/** Draw a 200 answer's stream; a stream that ends without `done` was cut short. */
const drawStream = async (
  ctx: StreamRunContext,
  request: StreamRequest,
  body: ReadableStream<Uint8Array>
): Promise<void> => {
  const patch = patcher(ctx, request)
  ctx.setStatus('streaming')
  patch((m) => {
    const opened = request.opened?.(m) ?? m
    return request.fresh === true
      ? { ...opened, content: '', html: undefined, htmlCovers: undefined, streaming: true }
      : { ...opened, streaming: true }
  })
  let done: Extract<ChatStreamEvent, { readonly type: 'done' }> | undefined
  const sawDone = await readChatStream(body, (event) => {
    if (event.type === 'done') done = event
    patch((m) => applyStreamEvent(m, event))
  })
  if (done !== undefined) nameExchange(ctx, request, done)
  if (sawDone) ctx.setStatus('idle')
  else failTurn(ctx, request)
}

/**
 * A request the server did not answer with a stream: a 429 is shown inline as
 * the cooldown notice; a 404 or 409 settles a request that has `onGone`; a
 * refusal the request expects goes to `onRefused`; anything else fails the turn.
 */
const settleRefused = async (
  ctx: StreamRunContext,
  request: StreamRequest,
  res: Response
): Promise<void> => {
  if (res.status === 429) {
    const notice = await rateLimitNotice(res)
    patcher(ctx, request)((m) => ({ ...m, content: notice }))
  } else if ((res.status === 404 || res.status === 409) && request.onGone !== undefined) {
    request.onGone()
  } else if (request.onRefused !== undefined) {
    await request.onRefused(res)
  } else return failTurn(ctx, request)
  ctx.setStatus('idle')
}

/**
 * Post `request` and draw its stream into its assistant turn. A 429 is shown
 * inline as the cooldown notice; a 404 or 409 settles a request that has
 * `onGone`; any other failure, or a stream cut short, surfaces the error line. A request cut by the window itself (a stop the
 * server had no turn for) ends the turn as stopped with what had arrived.
 */
export async function runStream(ctx: StreamRunContext, request: StreamRequest): Promise<void> {
  const controller = new AbortController()
  ctx.setAbort(controller)
  ctx.setStatus('sending')
  try {
    const res = await fetch(request.url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    })
    if (!res.ok) await settleRefused(ctx, request, res)
    else if (res.body === null) failTurn(ctx, request)
    else await drawStream(ctx, request, res.body)
  } catch {
    if (!controller.signal.aborted) return failTurn(ctx, request)
    patcher(ctx, request)((m) => ({ ...m, streaming: false, stopReason: 'stopped' }))
    ctx.setStatus('idle')
  } finally {
    ctx.setAbort(undefined)
  }
}

/** The body of a streamed turn: the question, its files as parts, the session and the scope. */
export const turnBody = (
  props: Pick<AiChatIslandProps, 'agent' | 'allowedTables'>,
  input: {
    readonly text: string
    readonly attachments: readonly ChatAttachment[]
    readonly sessionId: string
    /** The last saved message of the branch on screen, which the turn follows. */
    readonly parentId: string | undefined
  }
) => {
  const parts = partsForTurn(input.text, input.attachments)
  return {
    message: input.text,
    ...(parts !== undefined && { parts }),
    sessionId: input.sessionId,
    ...(input.parentId !== undefined && { parentId: input.parentId }),
    ...(props.agent !== undefined && { agent: props.agent }),
    ...(props.allowedTables !== undefined && {
      pageContext: { allowedTables: props.allowedTables },
    }),
  }
}
