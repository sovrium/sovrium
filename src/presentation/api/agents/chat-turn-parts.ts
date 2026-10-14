/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A chat message's parts, from the request to the model and back.
 *
 *  - {@link admitTurnParts} judges a request's `file` / `image` parts before
 *    any model call: every one names the caller's own upload (else `404`), and
 *    a picture needs a model declared able to read it (`AI_VISION`, else
 *    `422`). Nothing is saved for a refused message.
 *  - The admitted parts reach the model as references the AI adapter resolves
 *    (`infrastructure/ai/attachment-parts.ts`), and are stored as references:
 *    never the bytes, never the text read from them.
 *  - On a later turn, {@link replayStoredHistory} rebuilds earlier questions
 *    from their stored parts, and {@link loadCarriedFiles} gives a turn that
 *    replays no history the files its conversation was sent, so a file stays
 *    readable for the rest of its conversation. An edited or regenerated
 *    question is answered with its own files again ({@link readmitStoredParts}).
 */

import { Effect } from 'effect'
import {
  claimChatAttachments,
  replayStoredParts,
  type ChatAttachmentPartRef,
  type ReplayedChatPart,
} from '@/application/use-cases/ai/chat-attachments'
import { loadChatHistory } from '@/application/use-cases/ai/conversation-memory'
import { isModelImageType } from '@/domain/kernel/identity/attachment-content-type'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import type { AiMessagePart } from '@/application/ports/repositories/ai/ai-memory-repository'
import type {
  ChatMessage,
  MessageContent,
  MessagePart,
} from '@/application/ports/services/ai-service'
import type { ChatMessagePart } from '@/domain/models/api/ai/chat'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/** A message's parts once admitted: as the model reads them, and as they are kept. */
export interface AdmittedTurnParts {
  /** Text, and each upload as a bucket reference the AI adapter resolves. */
  readonly content: ReadonlyArray<MessagePart>
  /** Text, and each upload by id and name: what `ai_messages.parts` keeps. */
  readonly stored: ReadonlyArray<AiMessagePart>
}

/** Whether the operator declared the model able to read pictures (`AI_VISION=1`). */
const readsImages = (): boolean => {
  const raw = process.env.AI_VISION?.trim().toLowerCase()
  return raw === '1' || raw === 'true'
}

/** The admitted parts, each upload replaced by its reference. */
const admitted = (
  parts: ReadonlyArray<ChatMessagePart>,
  refs: ReadonlyArray<ChatAttachmentPartRef>
): AdmittedTurnParts => {
  const byId = new Map(refs.map((ref) => [ref.attachmentId, ref]))
  const pairs = parts.flatMap((part): [MessagePart, AiMessagePart][] => {
    if (part.type === 'text') return [[part, part]]
    const ref = byId.get(part.attachmentId)
    if (ref === undefined) return []
    return [
      [
        {
          type: 'file',
          bucket: ref.bucket,
          key: ref.key,
          mediaType: ref.mediaType,
          name: ref.name,
        },
        // Kept as what the upload IS, read from its content, whatever the request called it.
        {
          type: isModelImageType(ref.mediaType) ? 'image' : 'file',
          attachmentId: ref.attachmentId,
          name: ref.name,
        },
      ],
    ]
  })
  return { content: pairs.map(([model]) => model), stored: pairs.map(([, kept]) => kept) }
}

/**
 * Admit a request's parts, or answer the refusal. `undefined` parts (a message
 * sent as text alone) admit nothing and refuse nothing.
 */
export const admitTurnParts = async (
  c: Context,
  request: {
    readonly userId: string
    readonly sessionId: string
    readonly parts: ReadonlyArray<ChatMessagePart> | undefined
  }
): Promise<{ readonly admitted?: AdmittedTurnParts } | { readonly refusal: Response }> => {
  const { parts } = request
  if (parts === undefined) return {}
  const attachmentIds = parts.flatMap((part) => (part.type === 'text' ? [] : [part.attachmentId]))
  if (attachmentIds.length === 0) return { admitted: admitted(parts, []) }
  const claim = claimChatAttachments({
    userId: request.userId,
    sessionId: request.sessionId,
    attachmentIds,
    readsImages: readsImages(),
  })
  const result = await runRequestEffect(c, provideDomain(c, claim).pipe(Effect.result))
  if (result._tag === 'Success') return { admitted: admitted(parts, result.success) }
  const { failure } = result
  if (failure._tag === 'ChatAttachmentNotFound') {
    return { refusal: notFound(c, 'Attachment not found.') }
  }
  if (failure._tag === 'ChatAttachmentImageUnreadable') {
    const error = 'This assistant cannot read images: send the picture as a file it can read.'
    return { refusal: c.json(errorBody({ error, code: ApiErrorCode.VALIDATION_ERROR }), 422) }
  }
  logError('[ai-chat] admitting a message’s attachments failed', failure)
  const error = 'Failed to read the attachments of this message.'
  return { refusal: c.json(errorBody({ error, code: ApiErrorCode.INTERNAL_ERROR }), 500) }
}

/**
 * A question as the model reads it: its own parts (or its text), then the
 * files sent earlier in a conversation whose messages the turn does not replay.
 */
export const questionContent = (
  message: string,
  parts: AdmittedTurnParts | undefined,
  carried: ReadonlyArray<MessagePart>
): MessageContent =>
  parts === undefined && carried.length === 0
    ? message
    : [...(parts?.content ?? [{ type: 'text', text: message }]), ...carried]

/** A replayed part as the model reads it. */
const toMessagePart = (part: ReplayedChatPart): MessagePart =>
  part.type === 'text'
    ? part
    : {
        type: 'file',
        bucket: part.bucket,
        key: part.key,
        mediaType: part.mediaType,
        name: part.name,
      }

/** A stored message whose parts are replayed. */
interface StoredMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly parts?: ReadonlyArray<AiMessagePart> | undefined
}

/**
 * Stored parts as the model reads them when their uploads could not be looked
 * up: each file NAMED as unreadable, never silently left out, so the model
 * never answers as if no file had been sent.
 */
const unreadableParts = (
  parts: ReadonlyArray<AiMessagePart>,
  filesOnly = false
): ReadonlyArray<MessagePart> =>
  parts.flatMap((part): MessagePart[] => {
    if (part.type === 'text') return filesOnly ? [] : [part]
    return [{ type: 'text', text: `[file: ${part.name} (could not be read)]` }]
  })

/** A failed replay: logged, and the turn goes on with its files named as unreadable. */
const replayFailed =
  <A>(fallback: A) =>
  (cause: unknown) =>
    Effect.sync(() => {
      logError('[ai-chat] replaying a conversation’s files failed', cause)
      return fallback
    })

/**
 * Earlier messages of a conversation as the model reads them: a question sent
 * as parts is rebuilt from them, its files as references read anew this turn.
 */
export const replayStoredHistory = async (
  services: DomainContext,
  userId: string,
  messages: ReadonlyArray<StoredMessage>
): Promise<ReadonlyArray<ChatMessage>> => {
  const unread = messages.map((message): ChatMessage =>
    message.role === 'user' && message.parts !== undefined
      ? { role: 'user', content: unreadableParts(message.parts) }
      : { role: message.role, content: message.content }
  )
  const program = Effect.forEach(messages, (message) =>
    message.role !== 'user' || message.parts === undefined
      ? Effect.succeed<ChatMessage>({ role: message.role, content: message.content })
      : Effect.map(replayStoredParts({ userId, parts: message.parts }), (parts): ChatMessage => ({
          role: 'user',
          content: parts.map(toMessagePart),
        }))
  ).pipe(
    // effect-swallow: logged in replayFailed; each file is named as unreadable rather than the turn failing
    Effect.catch(replayFailed<ReadonlyArray<ChatMessage>>(unread))
  )
  return Effect.runPromise(Effect.provide(program, services))
}

/**
 * The files sent in `messages`, for a turn that replays none of their text:
 * a file stays readable for the rest of its conversation.
 */
export const carriedFilesOf = async (
  services: DomainContext,
  userId: string,
  messages: ReadonlyArray<StoredMessage>
): Promise<ReadonlyArray<MessagePart>> => {
  const parts = messages.flatMap((message) =>
    message.role === 'user' ? (message.parts ?? []) : []
  )
  if (parts.length === 0) return []
  const program = replayStoredParts({ userId, parts, filesOnly: true }).pipe(
    Effect.map((replayed) => replayed.map(toMessagePart)),
    // effect-swallow: logged in replayFailed; each file is named as unreadable rather than the turn failing
    Effect.catch(replayFailed(unreadableParts(parts, true)))
  )
  return Effect.runPromise(Effect.provide(program, services))
}

/**
 * The files sent earlier in a conversation, for a turn that replays none of its
 * text (an agent-bound turn, a stream).
 */
export const loadCarriedFiles = async (
  services: DomainContext,
  userId: string,
  sessionId: string
): Promise<ReadonlyArray<MessagePart>> => {
  if (userId === 'anonymous') return []
  const history = loadChatHistory({ userId, sessionId }).pipe(
    Effect.map((messages) =>
      messages.flatMap((message): StoredMessage[] =>
        message.role === 'user'
          ? [{ role: 'user', content: message.content, parts: message.parts }]
          : []
      )
    ),
    // effect-swallow: logged in replayFailed; with no history read there is no file known to name
    Effect.catch(replayFailed<ReadonlyArray<StoredMessage>>([]))
  )
  const messages = await Effect.runPromise(Effect.provide(history, services))
  return carriedFilesOf(services, userId, messages)
}

/**
 * A stored question's parts admitted again, for a turn that answers it anew
 * (an edit, a regeneration): each upload the caller still holds is read from
 * its bucket again, exactly as on any later turn of its conversation.
 */
export const readmitStoredParts = async (
  services: DomainContext,
  userId: string,
  stored: ReadonlyArray<AiMessagePart>
): Promise<AdmittedTurnParts> => {
  const program = replayStoredParts({ userId, parts: stored }).pipe(
    Effect.map((replayed) => replayed.map(toMessagePart)),
    // effect-swallow: logged in replayFailed; each file is named as unreadable rather than the turn failing
    Effect.catch(replayFailed(unreadableParts(stored)))
  )
  const content = await Effect.runPromise(Effect.provide(program, services))
  return { content, stored }
}
