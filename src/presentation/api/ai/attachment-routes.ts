/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  readChatAttachment,
  storeChatAttachment,
  type ChatAttachmentRefused,
} from '@/application/use-cases/ai/chat-attachments'
import { resolveUploadBucket } from '@/application/use-cases/buckets/resolve-bucket'
import { decodeSafe } from '@/domain/kernel/config-parsing/decode'
import { isInlineSafeImageMime } from '@/domain/kernel/identity/mime-types'
import { buildContentDisposition } from '@/domain/kernel/url/content-disposition'
import {
  chatAttachmentUploadQuerySchema,
  chatAttachmentUploadResponseSchema,
} from '@/domain/models/api/ai/chat'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  findChatAttachmentPolicy,
  tooLargeMessage,
  UNSUPPORTED_TYPE_MESSAGE,
  type ChatAttachmentPolicy,
} from '@/domain/models/app/pages/components/component-types/ai/ai-chat-attachments-validation'
import { checkPersonAiRateLimit } from '@/infrastructure/ai/agents/chat-rate-limit'
import { logError } from '@/infrastructure/logging/logger'
import { acceptsUploadBody } from '@/presentation/api/middleware/request-body-limit'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { readMultipartFile, readUploadedBytes } from '@/presentation/api/runtime/multipart-file'
import { rateLimitedResponse } from '@/presentation/api/runtime/rate-limit-response'
import {
  answerFailures,
  runHandlerEffect,
  toErrorResponse,
} from '@/presentation/api/runtime/run-effect'
import { UNTRUSTED_FILE_CSP } from '@/presentation/api/runtime/untrusted-file-headers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Chat attachments: a file a person attaches to an `ai-chat` that declares an
 * `attachments` block.
 *
 *  - `POST /api/ai/chat/attachments?chat=<component id>` — multipart `file`.
 *    Stored in the bucket the chat names and answered `201` with the
 *    attachment's id; refused `413` over the chat's `maxSizeMb`, and `415` when
 *    the file's CONTENT is not an accepted type, whatever its name and declared
 *    type say. Nothing is stored for a refused file.
 *  - `GET /api/ai/chat/attachments/:id` — the file, to the person who uploaded
 *    it and to nobody else.
 *
 * Every other caller gets the same `404`: a signed-out caller, another user, an
 * unknown chat, a chat without an `attachments` block, an unknown id (S1).
 * The storage key never leaves the server, so the file is reachable through no
 * public address.
 */

/** Room in a declared body for the multipart envelope around the file. */
const MULTIPART_ENVELOPE_BYTES = 64 * 1024

const BYTES_PER_MB = 1024 * 1024

const refusal = (c: Context, status: 413 | 415 | 507, error: string): Response => {
  const code = {
    413: ApiErrorCode.PAYLOAD_TOO_LARGE,
    415: ApiErrorCode.UNSUPPORTED_MEDIA_TYPE,
    507: ApiErrorCode.QUOTA_EXCEEDED,
  }[status]
  return c.json(errorBody({ error, code }), status)
}

const refusedResponse = (c: Context, refused: ChatAttachmentRefused): Response => {
  if (refused.reason === 'too-large') {
    return refusal(c, 413, tooLargeMessage(refused.maxSizeMb ?? 0))
  }
  if (refused.reason === 'unsupported-type') return refusal(c, 415, UNSUPPORTED_TYPE_MESSAGE)
  return refusal(c, 507, 'There is no room left to store this file')
}

const failed = (c: Context, label: string, failure: unknown): Response => {
  logError(label, failure)
  return c.json(
    errorBody({ error: 'The file could not be stored.', code: ApiErrorCode.STORAGE_ERROR }),
    500
  )
}

/** The chat an upload is for and its rules, or `undefined` when the query names none that takes uploads. */
const resolveTarget = (
  c: Context,
  app: App
): { readonly chatId: string; readonly policy: ChatAttachmentPolicy } | undefined => {
  const query = decodeSafe(chatAttachmentUploadQuerySchema)({ chat: c.req.query('chat') })
  if (!query.success) return undefined
  const { chat: chatId } = query.data
  const policy = findChatAttachmentPolicy(app, chatId)
  if (policy === undefined || resolveUploadBucket(app, policy.bucket) === undefined) {
    return undefined
  }
  return { chatId, policy }
}

/** True when the request DECLARES a body no acceptable file fits in. */
const declaresOversizedBody = (c: Context, policy: ChatAttachmentPolicy): boolean => {
  const declared = Number(c.req.header('content-length'))
  return (
    Number.isFinite(declared) &&
    declared > policy.maxSizeMb * BYTES_PER_MB + MULTIPART_ENVELOPE_BYTES
  )
}

interface UploadTarget {
  readonly userId: string
  readonly chatId: string
  readonly policy: ChatAttachmentPolicy
}

/**
 * The gates an upload passes before its body is read, in order: a session, a
 * chat that takes uploads, the rate limit, a declared size that could fit.
 */
const gateUpload = (c: Context, app: App): UploadTarget | Response => {
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return notFound(c)
  const target = resolveTarget(c, app)
  if (target === undefined) return notFound(c)
  const rate = checkPersonAiRateLimit('attachments', userId)
  if (rate.limited) return rateLimitedResponse(c, rate.retryAfter)
  if (declaresOversizedBody(c, target.policy)) {
    return refusal(c, 413, tooLargeMessage(target.policy.maxSizeMb))
  }
  return { userId, ...target }
}

/** Store an admitted file and answer its 201, or the refusal. */
const storeUpload = (c: Context, target: UploadTarget, file: File) =>
  Effect.gen(function* () {
    const bytes = yield* readUploadedBytes(file)
    const incoming = { name: file.name, declaredType: file.type, bytes }
    const result = yield* storeChatAttachment({ ...target, file: incoming }).pipe(Effect.result)
    if (result._tag === 'Failure') {
      const { failure } = result
      if (failure._tag === 'ChatAttachmentRefused') return refusedResponse(c, failure)
      return failed(c, '[ai] chat attachment upload failed', failure)
    }
    const { success: stored } = result
    const shaped = decodeSafe(chatAttachmentUploadResponseSchema)({
      attachmentId: stored.id,
      name: stored.name,
      size: stored.size,
      mimeType: stored.mimeType,
      bucket: stored.bucket,
    })
    if (!shaped.success) return toErrorResponse(c, shaped.error)
    return c.json(shaped.data, 201)
  })

const handleUpload = (c: Context, app: App) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const target = gateUpload(c, app)
        if (target instanceof Response) return target
        // effect-promise: total -- a body that does not parse reads as no file.
        const file = yield* Effect.promise(() => readMultipartFile(c, 'file'))
        if (file === undefined) {
          return c.json(
            errorBody({
              error: 'Send the file in the "file" field.',
              code: ApiErrorCode.BAD_REQUEST,
            }),
            400
          )
        }
        return yield* storeUpload(c, target, file)
      })
    )
  )

const handleRead = (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const userId = getSessionContext(c)?.userId
        const attachmentId = c.req.param('attachmentId')
        if (userId === undefined || attachmentId === undefined) return notFound(c)
        const result = yield* readChatAttachment({ attachmentId, userId }).pipe(Effect.result)
        if (result._tag === 'Failure') {
          const { failure } = result
          if (failure._tag === 'ChatAttachmentNotFound') return notFound(c)
          logError('[ai] chat attachment read failed', failure)
          return c.json(
            errorBody({ error: 'The file could not be read.', code: ApiErrorCode.STORAGE_ERROR }),
            500
          )
        }
        const { record, bytes } = result.success
        // Only a PDF and a raster image are previewed inline: an SVG carries script,
        // so it is downloaded, and every answer keeps the stored-file CSP.
        const inline =
          record.mimeType === 'application/pdf' || isInlineSafeImageMime(record.mimeType)
        return new Response(Uint8Array.from(bytes), {
          status: 200,
          headers: {
            'Content-Type': record.mimeType,
            'Content-Length': String(bytes.length),
            'Content-Disposition': buildContentDisposition(
              record.name,
              inline ? 'inline' : 'attachment'
            ),
            'Content-Security-Policy': UNTRUSTED_FILE_CSP,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, no-store',
          },
        })
      })
    )
  )

/** Chain the chat attachment routes onto the app. Always registered. */
export function chainAiChatAttachmentRoutes(honoApp: Hono, app: App): Hono {
  return honoApp
    .post(
      '/api/ai/chat/attachments',
      acceptsUploadBody((c: Context) => handleUpload(c, app))
    )
    .get('/api/ai/chat/attachments/:attachmentId', (c) => handleRead(c))
}
