/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface ConversationMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

const MAX_TURNS = 20

const conversations = new Map<string, ReadonlyArray<ConversationMessage>>()

export const getConversationHistory = (sessionId: string): ReadonlyArray<ConversationMessage> =>
  conversations.get(sessionId) ?? []

export const appendConversationTurn = (
  sessionId: string,
  userMessage: string,
  assistantReply: string
): void => {
  const previous = conversations.get(sessionId) ?? []
  const next: ReadonlyArray<ConversationMessage> = [
    ...previous,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantReply },
  ]
  const trimmed = next.length > MAX_TURNS * 2 ? next.slice(next.length - MAX_TURNS * 2) : next
  conversations.set(sessionId, trimmed)
}
