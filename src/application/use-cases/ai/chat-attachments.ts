/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Option } from 'effect'
import {
  ChatAttachmentRepository,
  type ChatAttachmentDatabaseError,
  type ChatAttachmentRecord,
} from '@/application/ports/repositories/ai/chat-attachment-repository'
import {
  StorageService,
  isStorageObjectNotFound,
  type StorageError,
} from '@/application/ports/services/storage-service'
import {
  checkStorageQuota,
  readBucketFile,
  storeBucketFile,
} from '@/application/use-cases/buckets/bucket-file-programs'
import {
  detectAttachmentType,
  isModelImageType,
} from '@/domain/kernel/identity/attachment-content-type'
import { CHAT_ATTACHMENT_KEY_PREFIX } from '@/domain/kernel/identity/storage-key'
import {
  judgeChatUpload,
  type ChatAttachmentPolicy,
} from '@/domain/models/app/pages/components/component-types/ai/ai-chat-attachments-validation'
import { logError } from '@/infrastructure/logging/logger'
import type { AiMessagePart } from '@/application/ports/repositories/ai/ai-memory-repository'

/**
 * What a chat does with a file a person attaches: store it in the bucket the
 * chat names, read it back for its uploader alone, tie it to the conversation
 * it is sent in, and hard-delete it with that conversation.
 *
 * The bytes go through the ordinary storage programs, recorded with the
 * uploader as `uploaded_by_id` — which is also what account erasure removes a
 * person's files by. The `system.ai_chat_attachments` row adds what the storage
 * catalog cannot say: whose chat file this is, and which conversation holds it.
 */

/** An upload the chat's rules refuse, and why. */
export class ChatAttachmentRefused extends Data.TaggedError('ChatAttachmentRefused')<{
  readonly reason: 'too-large' | 'unsupported-type' | 'quota-exceeded'
  /** The chat's size limit, for a `too-large` refusal. */
  readonly maxSizeMb?: number
}> {}

/** No attachment by that id belongs to the caller — absent and foreign alike (S1). */
export class ChatAttachmentNotFound extends Data.TaggedError('ChatAttachmentNotFound')<{
  readonly attachmentId: string
}> {}

/** A message names a picture, and the model is not declared able to read one. */
export class ChatAttachmentImageUnreadable extends Data.TaggedError(
  'ChatAttachmentImageUnreadable'
)<{
  readonly attachmentId: string
}> {}

/** The file as it arrived, before any judgement. */
export interface IncomingChatFile {
  readonly name: string
  /** The type the uploader declared: used only to name a text type, never trusted. */
  readonly declaredType: string
  readonly bytes: Uint8Array
}

/**
 * Judge a file against its chat's rules and, when it passes, store it and
 * record it. Nothing is stored for a refused file. A row that cannot be written
 * takes the stored bytes back out, so no file outlives the record that owns it.
 */
export const storeChatAttachment = (input: {
  readonly userId: string
  readonly chatId: string
  readonly policy: ChatAttachmentPolicy
  readonly file: IncomingChatFile
}): Effect.Effect<
  ChatAttachmentRecord,
  ChatAttachmentRefused | StorageError | ChatAttachmentDatabaseError,
  StorageService | ChatAttachmentRepository
> =>
  Effect.gen(function* () {
    const { file, policy } = input
    const verdict = judgeChatUpload({
      size: file.bytes.length,
      detected: detectAttachmentType(file.bytes, { name: file.name, mimeType: file.declaredType }),
      policy,
    })
    if (verdict._tag === 'TooLarge') {
      return yield* new ChatAttachmentRefused({ reason: 'too-large', maxSizeMb: verdict.maxSizeMb })
    }
    if (verdict._tag === 'UnsupportedType') {
      return yield* new ChatAttachmentRefused({ reason: 'unsupported-type' })
    }
    const quota = yield* checkStorageQuota(file.bytes.length)
    if (quota.kind === 'exceeded') {
      return yield* new ChatAttachmentRefused({ reason: 'quota-exceeded' })
    }
    const record = {
      id: `att_${crypto.randomUUID()}`,
      userId: input.userId,
      chatId: input.chatId,
      bucket: policy.bucket,
      storageKey: `${CHAT_ATTACHMENT_KEY_PREFIX}${crypto.randomUUID()}`,
      name: file.name,
      size: file.bytes.length,
      mimeType: verdict.mediaType,
    }
    yield* storeBucketFile({
      key: record.storageKey,
      content: file.bytes,
      mimeType: record.mimeType,
      bucket: record.bucket,
      uploadedById: input.userId,
    })
    const repo = yield* ChatAttachmentRepository
    yield* repo
      .insert(record)
      .pipe(Effect.tapError(() => removeStoredObject(record.storageKey, record.bucket)))
    return { ...record, sessionId: undefined, createdAt: new Date() }
  }).pipe(Effect.withSpan('ai.store-chat-attachment'))

/** Remove one stored object; a file already gone is not a failure. */
const deleteStoredObject = (
  key: string,
  bucket: string
): Effect.Effect<void, StorageError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage['delete'](key, bucket).pipe(
      Effect.catchIf(isStorageObjectNotFound, () => Effect.void)
    )
  })

/**
 * {@link deleteStoredObject}, total: used to take back the bytes of an upload
 * whose row could not be written. A failure is logged and left — the object
 * still names its uploader in the storage catalog, so erasing the account
 * removes it.
 */
const removeStoredObject = (
  key: string,
  bucket: string
): Effect.Effect<void, never, StorageService> =>
  deleteStoredObject(key, bucket).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[ai] could not delete a chat attachment', cause, { bucket }))
    ),
    // effect-swallow: logged above; the catalog row still names the uploader, so account erasure removes the object
    Effect.ignoreCause
  )

/** The caller's attachment and its bytes. */
export const readChatAttachment = (input: {
  readonly attachmentId: string
  readonly userId: string
}): Effect.Effect<
  { readonly record: ChatAttachmentRecord; readonly bytes: Uint8Array },
  ChatAttachmentNotFound | StorageError | ChatAttachmentDatabaseError,
  StorageService | ChatAttachmentRepository
> =>
  Effect.gen(function* () {
    const repo = yield* ChatAttachmentRepository
    const found = yield* repo.findOwned({ id: input.attachmentId, userId: input.userId })
    if (Option.isNone(found)) {
      return yield* new ChatAttachmentNotFound({ attachmentId: input.attachmentId })
    }
    const record = found.value
    const bytes = yield* readBucketFile({ key: record.storageKey, bucket: record.bucket })
    return { record, bytes }
  }).pipe(Effect.withSpan('ai.read-chat-attachment'))

/**
 * A `file` message part as the agent runtime's `AiService` reads it ([internal ref]
 * D3): a REFERENCE into the operator-named bucket, resolved to bytes inside the
 * infrastructure adapter only.
 */
export interface ChatAttachmentPartRef {
  readonly attachmentId: string
  readonly bucket: string
  readonly key: string
  readonly mediaType: string
  readonly name: string
}

/** An upload as a `file` part reference ([internal ref] D3): a picture is told apart by its type. */
const toPartRef = (record: ChatAttachmentRecord): ChatAttachmentPartRef => ({
  attachmentId: record.id,
  bucket: record.bucket,
  key: record.storageKey,
  mediaType: record.mimeType,
  name: record.name,
})

/**
 * Admit the attachments a chat message names, and tie them to its conversation.
 *
 * This is the one door between a message's `file` / `image` parts and the
 * model: every id must be one of the caller's own uploads, or the whole
 * message is refused as {@link ChatAttachmentNotFound} before anything reaches
 * the model. A picture — told by the type read from its content at upload,
 * whatever part named it, and only a raster one (`isModelImageType`; an SVG is
 * read as text) — is refused as {@link ChatAttachmentImageUnreadable}
 * unless the model reads images. Only an admitted message ties its files to
 * `sessionId` (unless one was already sent in another conversation), so
 * deleting that conversation deletes them.
 */
export const claimChatAttachments = (input: {
  readonly userId: string
  readonly sessionId: string
  readonly attachmentIds: readonly string[]
  /** Whether the model is declared able to read pictures (`AI_VISION`). */
  readonly readsImages: boolean
}): Effect.Effect<
  readonly ChatAttachmentPartRef[],
  ChatAttachmentNotFound | ChatAttachmentImageUnreadable | ChatAttachmentDatabaseError,
  ChatAttachmentRepository
> =>
  Effect.gen(function* () {
    const repo = yield* ChatAttachmentRepository
    const ids = [...new Set(input.attachmentIds)]
    const owned = yield* repo.findManyOwned({ ids, userId: input.userId })
    const byId = new Map(owned.map((record) => [record.id, record]))
    const missing = ids.find((id) => !byId.has(id))
    if (missing !== undefined) return yield* new ChatAttachmentNotFound({ attachmentId: missing })
    const picture = owned.find((record) => isModelImageType(record.mimeType))
    if (picture !== undefined && !input.readsImages) {
      return yield* new ChatAttachmentImageUnreadable({ attachmentId: picture.id })
    }
    yield* repo.bindToSession({ ids, userId: input.userId, sessionId: input.sessionId })
    return input.attachmentIds.flatMap((id) => {
      const record = byId.get(id)
      return record === undefined ? [] : [toPartRef(record)]
    })
  }).pipe(Effect.withSpan('ai.claim-chat-attachments'))

/** A stored part made ready for a later turn: text, an upload to read again, or its absence. */
export type ReplayedChatPart =
  | { readonly type: 'text'; readonly text: string }
  | ({ readonly type: 'file' } & ChatAttachmentPartRef)

/**
 * The caller's uploads among `ids`, by id: what a later turn reads a file from,
 * and what a reloaded conversation names it by. Another person's upload, or one
 * erased since, is simply absent.
 */
export const findOwnedChatAttachments = (input: {
  readonly userId: string
  readonly ids: readonly string[]
}): Effect.Effect<
  ReadonlyMap<string, ChatAttachmentRecord>,
  ChatAttachmentDatabaseError,
  ChatAttachmentRepository
> =>
  Effect.gen(function* () {
    if (input.ids.length === 0) return new Map<string, ChatAttachmentRecord>()
    const repo = yield* ChatAttachmentRepository
    const owned = yield* repo.findManyOwned({ ids: [...new Set(input.ids)], userId: input.userId })
    return new Map(owned.map((record) => [record.id, record]))
  }).pipe(Effect.withSpan('ai.find-owned-chat-attachments'))

/**
 * Replay stored parts on a later turn of their conversation: each upload the
 * caller still holds becomes a reference again, read from the bucket anew by
 * the model adapter; one erased since reads `[file: <name> (removed)]`. Only
 * `file` and `image` parts are kept when `filesOnly` — the files a turn that
 * does not replay the conversation's text still carries.
 */
export const replayStoredParts = (input: {
  readonly userId: string
  readonly parts: readonly AiMessagePart[]
  readonly filesOnly?: boolean
}): Effect.Effect<
  readonly ReplayedChatPart[],
  ChatAttachmentDatabaseError,
  ChatAttachmentRepository
> =>
  Effect.gen(function* () {
    const ids = input.parts.flatMap((part) => (part.type === 'text' ? [] : [part.attachmentId]))
    const owned = yield* findOwnedChatAttachments({ userId: input.userId, ids })
    return input.parts.flatMap((part): readonly ReplayedChatPart[] => {
      if (part.type === 'text') return input.filesOnly === true ? [] : [part]
      const record = owned.get(part.attachmentId)
      return record === undefined
        ? [{ type: 'text', text: `[file: ${part.name} (removed)]` }]
        : [{ type: 'file', ...toPartRef(record) }]
    })
  }).pipe(Effect.withSpan('ai.replay-stored-parts'))

/**
 * Hard-delete every attachment a conversation holds: the stored bytes first,
 * then the rows. A store that refuses a delete fails the whole call and keeps
 * the rows, so the deletion can be asked again rather than leaving bytes no
 * row points to. Answers how many attachments the conversation held.
 */
export const deleteConversationAttachments = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<
  number,
  StorageError | ChatAttachmentDatabaseError,
  StorageService | ChatAttachmentRepository
> =>
  Effect.gen(function* () {
    const repo = yield* ChatAttachmentRepository
    const held = yield* repo.listForSession(input)
    yield* Effect.forEach(held, (record) => deleteStoredObject(record.storageKey, record.bucket), {
      discard: true,
    })
    yield* repo.deleteOwned({ ids: held.map((record) => record.id), userId: input.userId })
    return held.length
  }).pipe(Effect.withSpan('ai.delete-conversation-attachments'))
