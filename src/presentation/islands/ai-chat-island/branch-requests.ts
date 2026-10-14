/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BranchLabels, ChatMessage, ConversationMessageDto } from './types'

/**
 * The requests behind the `ai-chat` conversation controls (the footer of a
 * saved turn, the conversation list), and the branch each one answers, as the
 * transcript draws it. Loaded with those controls, never with the panel.
 */

/** What both controls need from the panel. */
export interface BranchContext {
  readonly sessionId: string
  readonly labels: BranchLabels
  /** A request is in flight: nothing is sent twice. */
  readonly busy: boolean
  readonly showBranch: (branch: Promise<readonly ChatMessage[]>, sessionId?: string) => void
}

/**
 * A saved message as a turn of the transcript: its id is the one it is saved
 * under, its answer is the server's rendering, and a question it asked that
 * was dismissed is kept, so the reader still sees what was asked, and by whom.
 */
const fromWire = (m: ConversationMessageDto): ChatMessage => ({
  id: m.id ?? crypto.randomUUID(),
  ...(m.id !== undefined && { serverId: m.id }),
  role: m.role === 'user' ? 'user' : 'assistant',
  content: m.content,
  ...(m.html !== undefined && { html: m.html, htmlCovers: m.content.length }),
  ...(m.siblings !== undefined && { siblings: m.siblings }),
  ...(m.elicitation !== undefined && {
    elicitation: {
      id: '',
      ...m.elicitation,
      requestedSchema: { properties: {} },
      state: 'cancelled',
    },
  }),
})

/** The branch a request answers, as the transcript draws it; a refusal fails it. */
export const branchOf = async (response: Promise<Response>): Promise<readonly ChatMessage[]> => {
  const res = await response
  if (!res.ok) throw new Error(String(res.status))
  const body = (await res.json()) as { readonly messages?: readonly ConversationMessageDto[] }
  return (body.messages ?? []).map(fromWire)
}

export const conversationUrl = (sessionId: string): string =>
  `/api/ai/conversations/${encodeURIComponent(sessionId)}`

export const post = (url: string, body?: unknown): Promise<Response> =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
