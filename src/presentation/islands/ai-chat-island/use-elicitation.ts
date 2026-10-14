/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { answerSummary } from './elicitation-form'
import { JSON_HEADERS, runStream, type StreamRunContext } from './stream-turn'
import type { ChatElicitation, ChatElicitationAnswer, ChatMessage, QuestionLabels } from './types'

/**
 * Answering a question the agent asked (`elicit`):
 * `POST /api/ai/chat/elicitations/:id`, whose answer is the rest of the turn,
 * drawn into the answer that holds the question, from a fresh text once its
 * stream opens. The question then gives way to the line saying how it was
 * answered. A refused answer (400: it does not fit the question) brings the
 * questionnaire back with the server's words, on the field they name; a
 * question the server no longer holds (404, 409: answered or dismissed
 * elsewhere) gives way to the line saying it is closed.
 */

const urlOf = (id: string): string => `/api/ai/chat/elicitations/${encodeURIComponent(id)}`

/** The question of one turn, changed. */
const withElicitation =
  (change: (elicitation: ChatElicitation) => ChatElicitation) =>
  (message: ChatMessage): ChatMessage =>
    message.elicitation === undefined
      ? message
      : { ...message, elicitation: change(message.elicitation) }

/** The question once answered as `answer` says. */
const answered = (
  answer: ChatElicitationAnswer,
  labels: QuestionLabels
): ((elicitation: ChatElicitation) => ChatElicitation) => {
  const state = { accept: 'answered', decline: 'declined', cancel: 'cancelled' } as const
  return (elicitation) => ({
    ...elicitation,
    state: state[answer.action],
    summary: answerSummary(elicitation, answer, labels),
    error: undefined,
  })
}

/** The refusal's words, and the field it names. */
const refusalOf = async (res: Response): Promise<NonNullable<ChatElicitation['error']>> => {
  const body = (await res.json().catch(() => undefined)) as
    { readonly field?: string; readonly message?: string; readonly error?: string } | undefined
  return { field: body?.field ?? '', message: body?.message ?? body?.error ?? 'Not sent.' }
}

/**
 * The window's answers to its questions: `answer` sends one; `cancelOpen`
 * dismisses whichever is still open, before the reader sends a new message
 * from the composer — the question closes and the agent is not asked again.
 */
export function useElicitation(input: {
  readonly ctx: StreamRunContext
  readonly messages: readonly ChatMessage[]
  readonly labels: QuestionLabels
}) {
  const { ctx, messages, labels } = input
  const patchHolder = useCallback(
    (id: string, change: (elicitation: ChatElicitation) => ChatElicitation) =>
      ctx.setMessages((prev) =>
        prev.map((m) => (m.elicitation?.id === id ? withElicitation(change)(m) : m))
      ),
    [ctx]
  )

  const answer = useCallback(
    (id: string, reply: ChatElicitationAnswer): void => {
      const holder = messages.find((m) => m.elicitation?.id === id)
      if (holder === undefined) return
      patchHolder(id, (elicitation) => ({ ...elicitation, state: 'sending', error: undefined }))
      void runStream(ctx, {
        url: urlOf(id),
        body: reply,
        assistantId: holder.id,
        fresh: true,
        opened: withElicitation(answered(reply, labels)),
        onRefused: async (res) => {
          const error = await refusalOf(res)
          patchHolder(id, (elicitation) => ({ ...elicitation, state: 'open', error }))
        },
        onGone: () => patchHolder(id, (elicitation) => ({ ...elicitation, state: 'closed' })),
      })
    },
    [ctx, messages, labels, patchHolder]
  )

  const cancelOpen = useCallback((): void => {
    const open = messages.find((m) => m.elicitation?.state === 'open')?.elicitation
    if (open === undefined) return
    patchHolder(open.id, (elicitation) => ({ ...elicitation, state: 'cancelled' }))
    // The question closes on the server without resuming the turn: there is
    // no answer to draw, and nothing to wait for before sending the message.
    void fetch(urlOf(open.id), {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'cancel' }),
    }).catch(() => undefined)
  }, [messages, patchHolder])

  return { answer, cancelOpen }
}
