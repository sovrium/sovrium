/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A conversation branch on the wire (`conversationMessageSchema`).
 *
 * Each message carries its id, so a reader can edit or regenerate it, and —
 * when it has alternatives — the ids of every message written in its place,
 * itself included, oldest first, so a reader can show "2 / 3" and page. An
 * assistant message also carries its Markdown rendered to sanitized `html`,
 * through the same renderer and sanitizer as the chat stream, so a replayed
 * answer reads exactly as it did when it streamed.
 */

import { Effect } from 'effect'
import { siblingsLookup } from '@/domain/models/app/agents/conversation-branch-service'
import { renderChatAnswerHtml } from '@/presentation/render/markdown/chat-answer-markdown'
import type {
  AiMemoryMessage,
  AiMessagePart,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import type { ConversationMessage } from '@/domain/models/api/ai/conversations'

/** An upload as a reloaded message names it. */
interface UploadDescription {
  readonly name: string
  readonly mimeType: string
}

/**
 * A stored message's parts on the wire, in the order sent: an upload the
 * caller still holds is named by its name and type, read from the upload
 * itself; one erased since comes back with its id alone.
 */
const wireParts = (
  parts: ReadonlyArray<AiMessagePart>,
  uploads: ReadonlyMap<string, UploadDescription>
): NonNullable<ConversationMessage['parts']> =>
  parts.map((part) => {
    if (part.type === 'text') return part
    const upload = uploads.get(part.attachmentId)
    return {
      type: part.type,
      attachmentId: part.attachmentId,
      ...(upload !== undefined && { name: upload.name, mimeType: upload.mimeType }),
    }
  })

/** A stored role as the wire names it; anything unexpected reads as the assistant. */
const wireRole = (role: string): ConversationMessage['role'] =>
  role === 'user' || role === 'system' ? role : 'assistant'

/**
 * Project `branch` onto the wire, reading each message's siblings from `tree`
 * (the whole conversation), and naming each upload a message's parts hold
 * from `uploads` (the caller's own). An Effect because an answer's rendering
 * highlights its code, which is asynchronous.
 */
export const toWireMessages = (
  tree: ReadonlyArray<AiMemoryMessage>,
  branch: ReadonlyArray<AiMemoryMessage>,
  uploads: ReadonlyMap<string, UploadDescription> = new Map()
): Effect.Effect<ReadonlyArray<ConversationMessage>> => {
  const siblingsOf = siblingsLookup(tree)
  return Effect.forEach(branch, (message) => {
    const siblings = siblingsOf(message)
    const role = wireRole(message.role)
    const rendered =
      role === 'assistant' ? renderChatAnswerHtml(message.content) : Effect.succeed('')
    return Effect.map(rendered, (html): ConversationMessage => ({
      id: message.id,
      role,
      content: message.content,
      ...(html.length > 0 && { html }),
      status: message.status === 'incomplete' ? 'incomplete' : 'complete',
      ...(siblings.length > 1 && { siblings: siblings.map((sibling) => sibling.id) }),
      ...(message.parts !== undefined && { parts: wireParts(message.parts, uploads) }),
      ...(message.elicitation !== undefined && { elicitation: message.elicitation }),
      createdAt: message.createdAt.toISOString(),
    }))
  })
}
