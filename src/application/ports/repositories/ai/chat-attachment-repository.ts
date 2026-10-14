/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect, Option } from 'effect'

/** Any failure reading or writing `system.ai_chat_attachments`. */
export class ChatAttachmentDatabaseError extends Data.TaggedError('ChatAttachmentDatabaseError')<{
  readonly cause: unknown
}> {}

/** One file a user attached to a chat, as its row records it. */
export interface ChatAttachmentRecord {
  readonly id: string
  readonly userId: string
  /** The `id` of the `ai-chat` the file was attached through. */
  readonly chatId: string
  /** The conversation the file was sent in; absent until a message carries it. */
  readonly sessionId: string | undefined
  readonly bucket: string
  /** Where the bytes are in the bucket. Never sent to a client. */
  readonly storageKey: string
  readonly name: string
  readonly size: number
  readonly mimeType: string
  readonly createdAt: Date
}

/** A row about to be written. */
export type NewChatAttachment = Omit<ChatAttachmentRecord, 'sessionId' | 'createdAt'>

/**
 * Chat attachments repository port.
 *
 * Every read and every write is scoped by `userId`: an attachment is its
 * uploader's alone, so no method can reach another person's row.
 */
export class ChatAttachmentRepository extends Context.Service<
  ChatAttachmentRepository,
  {
    readonly insert: (row: NewChatAttachment) => Effect.Effect<void, ChatAttachmentDatabaseError>
    /** The caller's attachment by id; none when absent or another person's. */
    readonly findOwned: (input: {
      readonly id: string
      readonly userId: string
    }) => Effect.Effect<Option.Option<ChatAttachmentRecord>, ChatAttachmentDatabaseError>
    /** The caller's attachments among `ids`, in no particular order. */
    readonly findManyOwned: (input: {
      readonly ids: readonly string[]
      readonly userId: string
    }) => Effect.Effect<readonly ChatAttachmentRecord[], ChatAttachmentDatabaseError>
    /**
     * Tie the caller's attachments among `ids` to a conversation. One already
     * tied to ANOTHER conversation keeps that one: a file belongs to the
     * conversation it was first sent in, and deleting that conversation deletes it.
     */
    readonly bindToSession: (input: {
      readonly ids: readonly string[]
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<void, ChatAttachmentDatabaseError>
    /** The caller's attachments tied to one conversation. */
    readonly listForSession: (input: {
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<readonly ChatAttachmentRecord[], ChatAttachmentDatabaseError>
    /** Hard-delete the caller's rows among `ids`. */
    readonly deleteOwned: (input: {
      readonly ids: readonly string[]
      readonly userId: string
    }) => Effect.Effect<void, ChatAttachmentDatabaseError>
  }
>()('ChatAttachmentRepository') {}
