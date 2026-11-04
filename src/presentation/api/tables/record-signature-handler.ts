/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/tables/:tableId/records/:recordId/signatures/:field` — a signed-in
 * person signs a `signature` field of a record she may write, from the
 * `signature-pad` of a page.
 *
 * The body is `multipart/form-data`: the text fields of
 * `inlineSignRequestFieldsSchema` and, for a drawn signature, the PNG bytes as
 * the `image` part. Nothing in it is stored as sent: `captureSignature` authors
 * the value.
 *
 * Every reason she may not sign answers the one 404 a missing record answers
 * (S1): a visitor not signed in, a field that is not a signature, one a signing
 * flow owns (signed through its links only), no write permission on the field
 * or the record, an unknown page or record. The refusals she can act on carry
 * their contract code: `CONSENT_REQUIRED` and `IMAGE_INVALID` (400),
 * `STATEMENT_CHANGED` (409). A field already signed is the write-once refusal
 * every road answers (400).
 */

import { Effect, Option, Schema } from 'effect'
import {
  captureSignature,
  SignatureCaptureRefusal,
  type CaptureSignatureInput,
} from '@/application/use-cases/signatures/capture-signature'
import { NotFoundError } from '@/domain/errors'
import { ApiErrorCode } from '@/domain/models/api/error'
import { signatureValueV2Schema } from '@/domain/models/api/signatures/common'
import { MAX_SIGNATURE_IMAGE_BYTES } from '@/domain/models/api/signatures/sign'
import { inlineSignRequestFieldsSchema } from '@/domain/models/api/tables/signatures'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { flowSignerFieldsOf } from '@/domain/models/app/signatures/signature-flow-fields-service'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { getRequestTrustedClientIp } from '@/presentation/api/middleware/client-ip'
import { formBodyLimit } from '@/presentation/api/middleware/request-body-limit'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { readUploadedBytes } from '@/presentation/api/runtime/multipart-file'
import { readFormBody } from '@/presentation/api/runtime/request-body'
import { runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './error-helpers'
import { filterAllowedFieldsWithRole } from './record-update-permissions'
import { updateGates } from './record-write-gates'
import { getLinkReader } from './relationship-rules'
import { guardForTable } from './row-level-guard'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The largest signing request: the image at its cap, with room for the text
 * fields and the multipart framing. The route is a form post, which would
 * otherwise be upload-sized.
 */
export const signRequestBodyLimit = formBodyLimit(2 * MAX_SIGNATURE_IMAGE_BYTES)

/** HTTP status of each refusal the signer can act on. */
const REFUSAL_STATUS = {
  CONSENT_REQUIRED: 400,
  IMAGE_INVALID: 400,
  STATEMENT_CHANGED: 409,
} as const

/** A refusal in the signing routes' error shape. */
const refusal = (c: Context, code: SignatureCaptureRefusal['code'], message: string): Response =>
  c.json({ success: false, code, message }, REFUSAL_STATUS[code])

/** A body the contract does not describe. */
const malformed = (c: Context): Response =>
  c.json(
    {
      success: false,
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'The signature request is incomplete or malformed',
    },
    400
  )

/** Whether the caller may sign `field` of the record: every no is the missing record's 404. */
const maySign = (c: Context, app: App, field: string) =>
  Effect.gen(function* () {
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const table = app.tables?.find((candidate) => candidate.name === tableName)
    const column = table?.fields.find((candidate) => candidate.name === field)
    if (isGuestSession(session.userId) || column?.type !== 'signature') return false
    if (flowSignerFieldsOf(app.signatures, tableName).includes(field)) return false
    const writer = { role: userRole, groups: userGroups, signedOut: false }
    const change = { [field]: true }
    const { forbiddenFields } = filterAllowedFieldsWithRole(app, tableName, writer, change)
    if (forbiddenFields.length > 0) return false
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)
    const recordId = c.req.param('recordId') ?? ''
    const gate = yield* updateGates({
      ...{ c, app, table, session, tableName, userRole, userGroups, recordId, guard, change },
    })
    return gate === undefined
  })

/** The multipart body, decoded: the text fields and the image bytes, or `undefined`. */
const decodedBody = (c: Context) =>
  Effect.gen(function* () {
    const body = yield* readFormBody(c)
    const text = (name: string) => (typeof body[name] === 'string' ? body[name] : undefined)
    const fields = Schema.decodeUnknownOption(inlineSignRequestFieldsSchema)({
      ...{ consent: 'true', method: text('method'), page: text('page') },
      statementDigest: text('statementDigest'),
      ...(text('typedName') === undefined ? {} : { typedName: text('typedName') }),
    })
    const { image } = body
    const bytes = image instanceof File ? yield* readUploadedBytes(image) : undefined
    return { consent: text('consent') === 'true', fields, bytes, imageSent: image !== undefined }
  })

/** The capture's failure as the response the contract gives it. */
const failureResponse = (c: Context, error: unknown): Response => {
  if (error instanceof SignatureCaptureRefusal) return refusal(c, error.code, error.message)
  if (error instanceof NotFoundError || isAuthorizationError(error)) return notFound(c)
  return handleRouteError(c, error)
}

/** Sign, once the caller may: decode, capture, answer the stored value. */
const signResponse = (c: Context, app: App, field: string) =>
  Effect.gen(function* () {
    if (!(yield* maySign(c, app, field))) return notFound(c)
    // effect-swallow: a body that cannot be read is the client's malformed request, answered 400.
    const decoded = yield* Effect.result(decodedBody(c))
    if (decoded._tag === 'Failure') return malformed(c)
    const { consent, fields, bytes, imageSent } = decoded.success
    if (!consent) return refusal(c, 'CONSENT_REQUIRED', 'Agree to the statement before signing')
    if (Option.isNone(fields)) return malformed(c)
    const request = fields.value
    if (request.method === 'typed' && request.typedName === undefined) return malformed(c)
    if (imageSent && bytes === undefined) {
      return refusal(c, 'IMAGE_INVALID', 'The signature must be sent as PNG bytes')
    }
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const input: CaptureSignatureInput = {
      ...{ app, session, userRole, userGroups, tableName, field, consent },
      ...{ method: request.method, typedName: request.typedName, image: bytes },
      ...{ page: request.page, statementDigest: request.statementDigest },
      recordId: c.req.param('recordId') ?? '',
      linkReader: getLinkReader(c),
      origin: new URL(c.req.url).origin,
      forgetDerivedVariants: evictTransformCacheForKey,
      network: {
        ipAddress: getRequestTrustedClientIp(c),
        userAgent: c.req.header('user-agent'),
      },
    }
    return yield* Effect.match(captureSignature(input), {
      onFailure: (error) => failureResponse(c, error),
      onSuccess: (value) => shapedJson(c, value, signatureValueV2Schema, 201),
    })
  })

export function handleSignRecordField(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(c, signResponse(c, app, c.req.param('field') ?? ''))
}
