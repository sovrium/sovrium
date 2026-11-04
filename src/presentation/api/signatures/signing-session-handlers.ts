/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The roads a signing session acts on, anonymous by design: the signer a
 * signing page's cookie names (`middleware/signing-session.ts`) is the only one
 * they act for. The page itself, and the link exchanged for that cookie, are
 * `signing-page-gate.ts`'s.
 *
 * - `POST /api/signatures/sign` — the session's signer signs (multipart: the
 *   text fields of `signRequestFieldsSchema`, and for a drawn signature the
 *   PNG bytes as `image`).
 * - `POST /api/signatures/decline` — she declines, with an optional reason.
 * - `POST /api/signatures/challenge` — she asks for a code (`challenge-handlers.ts`).
 *
 * Every refusal of a session that cannot act is the same 404 body
 * (`SIGNING_NOT_FOUND_BODY`), whatever the reason (S1). The refusals she can
 * act on carry their contract code.
 */

import { Effect, Schema } from 'effect'
import { announceSignatureMoves } from '@/application/use-cases/signatures/announce-signature-moves'
import {
  declineSignatureRequest,
  signSignatureRequest,
  SigningRefusal,
} from '@/application/use-cases/signatures/sign-signature-request'
import { NotFoundError } from '@/domain/errors'
import { ApiErrorCode } from '@/domain/models/api/error'
import { declineRequestSchema, declineResponseSchema } from '@/domain/models/api/signatures/decline'
import { SIGNING_NOT_FOUND_BODY } from '@/domain/models/api/signatures/error'
import { signRequestFieldsSchema, signResponseSchema } from '@/domain/models/api/signatures/sign'
import { detectLanguageIfEnabled } from '@/domain/models/app/languages/language-detection'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { getRequestTrustedClientIp } from '@/presentation/api/middleware/client-ip'
import { signingSessionOf } from '@/presentation/api/middleware/signing-session'
import { readUploadedBytes } from '@/presentation/api/runtime/multipart-file'
import { decodeJsonBody, readFormBody } from '@/presentation/api/runtime/request-body'
import {
  runHandlerEffect,
  shapedJson,
  toErrorResponse,
} from '@/presentation/api/runtime/run-effect'
import { SIGNING_REFUSAL_STATUS } from '@/presentation/api/runtime/signing-refusal-status'
import { renderSigningLinkInvalidPage } from '@/presentation/render/page/signing-link-invalid-page'
import type { SigningCodeAnswer } from '@/application/use-cases/signatures/challenge-verify'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The one answer of every link or session that cannot act, whatever the
 * reason: a page request (GET or HEAD) on a signing page gets the neutral
 * page in the app's design and language, every other request the not-found
 * body. Both are sent with no referrer and kept nowhere.
 */
export const signingNotFound = (c: Context, app?: App): Response => {
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Cache-Control', 'no-store')
  if (app === undefined || (c.req.method !== 'GET' && c.req.method !== 'HEAD')) {
    return c.json(SIGNING_NOT_FOUND_BODY, 404)
  }
  const lang = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
  return c.html(renderSigningLinkInvalidPage(app, lang), 404)
}

/** A failure as the response the contract gives it. */
export const failureResponse = (c: Context, error: unknown): Response => {
  if (error instanceof NotFoundError) return signingNotFound(c)
  if (error instanceof SigningRefusal) {
    return c.json(
      { success: false, code: error.code, message: error.message },
      SIGNING_REFUSAL_STATUS[error.code]
    )
  }
  return toErrorResponse(c, error)
}

const malformed = (c: Context): Response =>
  c.json(
    {
      success: false,
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'The signing request is incomplete or malformed',
    },
    400
  )

const decodeCodeAnswer = Schema.decodeUnknownOption(
  Schema.Struct({
    challengeId: signRequestFieldsSchema.fields.challengeId,
    code: signRequestFieldsSchema.fields.code,
  })
)

/** The challenge and code a signature carries: none, both well formed, or malformed. */
const codeAnswerOf = (
  challengeId: string | undefined,
  code: string | undefined
): SigningCodeAnswer => {
  if (challengeId === undefined && code === undefined) return undefined
  const decoded = decodeCodeAnswer({ challengeId, code })
  return decoded._tag === 'Some' &&
    decoded.value.challengeId !== undefined &&
    decoded.value.code !== undefined
    ? { challengeId: decoded.value.challengeId, code: decoded.value.code }
    : 'malformed'
}

/** The multipart body of a signature, decoded; `undefined` when it does not read. */
const decodedSignBody = (c: Context) =>
  Effect.gen(function* () {
    const body = yield* readFormBody(c)
    const text = (name: string) => (typeof body[name] === 'string' ? body[name] : undefined)
    const consent = text('consent') === 'true'
    const fields = Schema.decodeUnknownOption(signRequestFieldsSchema)({
      ...{ consent: 'true', method: text('method') },
      ...(text('typedName') === undefined ? {} : { typedName: text('typedName') }),
    })
    const { image } = body
    const bytes = image instanceof File ? yield* readUploadedBytes(image) : undefined
    return { consent, fields, bytes, codeAnswer: codeAnswerOf(text('challengeId'), text('code')) }
  })

const signResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    // effect-swallow: a body that cannot be read is the client's malformed request, answered 400.
    const decoded = yield* Effect.result(decodedSignBody(c))
    if (decoded._tag === 'Failure') return malformed(c)
    const { consent, fields, bytes, codeAnswer } = decoded.success
    const method = fields._tag === 'Some' ? fields.value.method : 'typed'
    const typedName = fields._tag === 'Some' ? fields.value.typedName : undefined
    const signed = yield* Effect.result(
      signSignatureRequest({
        ...{ app, token: undefined, signerId: signingSessionOf(c) ?? '' },
        ...{ consent, method, typedName, image: bytes, codeAnswer },
        network: {
          ipAddress: getRequestTrustedClientIp(c),
          userAgent: c.req.header('user-agent'),
        },
        forgetDerivedVariants: evictTransformCacheForKey,
      })
    )
    if (signed._tag === 'Failure') return failureResponse(c, signed.failure)
    const { moves, ...answer } = signed.success
    yield* announceSignatureMoves(app, moves)
    return shapedJson(c, answer, signResponseSchema)
  })

const declineResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    // effect-promise: total -- decodeJsonBody answers an unreadable body as a failed decode, never rejects.
    const { decoded } = yield* Effect.promise(() => decodeJsonBody(c, declineRequestSchema))
    const reason = decoded.success ? decoded.data.reason : undefined
    const declined = yield* Effect.result(
      declineSignatureRequest({
        app,
        token: undefined,
        signerId: signingSessionOf(c) ?? '',
        reason,
      })
    )
    if (declined._tag === 'Failure') return failureResponse(c, declined.failure)
    yield* announceSignatureMoves(app, declined.success.moves)
    return shapedJson(c, { status: declined.success.status }, declineResponseSchema)
  })

// No signing session, nothing read: the one not-found answer, before any body is (S1).
export function handleSign(c: Context, app: App): Promise<Response> {
  if (signingSessionOf(c) === undefined) return Promise.resolve(signingNotFound(c))
  return runHandlerEffect(c, signResponse(c, app))
}

export function handleDecline(c: Context, app: App): Promise<Response> {
  if (signingSessionOf(c) === undefined) return Promise.resolve(signingNotFound(c))
  return runHandlerEffect(c, declineResponse(c, app))
}
