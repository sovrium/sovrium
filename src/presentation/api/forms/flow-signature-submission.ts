/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A form whose `kind: signature` field is bound to a signing flow
 * (`bind: { flow, signer? }`), submitted.
 *
 * Such a form signs, it does not collect: inside that flow's signing session,
 * from the signer the link was sent to (`signer` narrows it), the answer is
 * the session signer's signature on her request's record, through the one
 * server signing path the signing page's pad uses too. No row is created and
 * nothing else of the submission is kept. Outside such a session the form
 * answers 404 and nothing is stored, whatever the body holds.
 *
 * The answer is multipart, as any form signature: the drawing as a PNG part
 * named after the field, or `<field>.typedName`, and `<field>.consent`.
 */

import { Effect } from 'effect'
import { announceSignatureMoves } from '@/application/use-cases/signatures/announce-signature-moves'
import {
  signSignatureRequest,
  SigningRefusal,
} from '@/application/use-cases/signatures/sign-signature-request'
import { NotFoundError } from '@/domain/errors'
import { signResponseSchema } from '@/domain/models/api/signatures/sign'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { getRequestTrustedClientIp } from '@/presentation/api/middleware/client-ip'
import { isCrossSite } from '@/presentation/api/middleware/cross-site-request-guard'
import { signingSessionOf } from '@/presentation/api/middleware/signing-session'
import { forbidden } from '@/presentation/api/runtime/auth-helpers'
import { readUploadedBytes } from '@/presentation/api/runtime/multipart-file'
import { shapedJson, toErrorResponse } from '@/presentation/api/runtime/run-effect'
import { SIGNING_REFUSAL_STATUS } from '@/presentation/api/runtime/signing-refusal-status'
import { formNotFound } from './submission-refusals'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Context } from 'hono'

/** The form's signature field bound to a flow, with its binding; `undefined` when it has none. */
const flowBoundSignatureOf = (form: Readonly<Form>) =>
  form.fields.flatMap((field) =>
    field.kind === 'signature' && field.bind !== undefined && 'flow' in field.bind
      ? [{ name: field.name, flow: field.bind.flow, signer: field.bind.signer }]
      : []
  )[0]

/** The signer's answer to the field `name`: her drawing's bytes or typed name, and her consent. */
const answerOf = (body: Readonly<Record<string, unknown>>, name: string) =>
  Effect.gen(function* () {
    const drawn = body[name]
    const typed = body[`${name}.typedName`]
    const typedName = typeof typed === 'string' && typed.trim() !== '' ? typed.trim() : undefined
    const image = drawn instanceof File ? yield* readUploadedBytes(drawn) : undefined
    return {
      consent: body[`${name}.consent`] === 'true',
      method:
        image === undefined && typedName !== undefined ? ('typed' as const) : ('drawn' as const),
      typedName,
      image,
    }
  })

/** A refused signature, as the contract answers it. */
const refusedResponse = (c: Context, failure: unknown): Response => {
  if (failure instanceof NotFoundError) return formNotFound(c)
  if (failure instanceof SigningRefusal) {
    return c.json(
      { success: false, code: failure.code, message: failure.message },
      SIGNING_REFUSAL_STATUS[failure.code]
    )
  }
  return toErrorResponse(c, failure)
}

/** A submission to a form: the request, the app, and the form as declared. */
interface Submission {
  readonly c: Context
  readonly app: App
  readonly form: Readonly<Form>
}

/**
 * Whether a submission signs for a flow: its form has a signature field bound
 * to one, and it arrives in a signing session or answers that field. A bound
 * form answered without the field and outside any session goes the ordinary
 * way, so its other refusals (a column a flow writes) still name what is wrong.
 */
export const isFlowBound = (
  { c, form }: Submission,
  body: Readonly<Record<string, unknown>>
): boolean => {
  const bound = flowBoundSignatureOf(form)
  if (bound === undefined) return false
  return (
    signingSessionOf(c) !== undefined ||
    [bound.name, `${bound.name}.typedName`, `${bound.name}.consent`].some(
      (key) => body[key] !== undefined
    )
  )
}

/**
 * Answer a submission of a form whose signature field is bound to a flow: the
 * session signer's signature on her request (201), or 404 outside the session.
 * Another site's post is refused first, whatever the posture, as on the sign
 * route: the signing cookie is not a session the global guard judges.
 */
export const answerFlowBound = (
  { c, app, form }: Submission,
  body: Readonly<Record<string, unknown>>
) =>
  Effect.gen(function* () {
    if (isCrossSite(c, [])) return forbidden(c, 'Cross-site request refused')
    const bound = flowBoundSignatureOf(form)
    const signerId = signingSessionOf(c)
    if (bound === undefined || signerId === undefined) return formNotFound(c)
    // effect-swallow: a drawing that cannot be read is the client's malformed answer, refused as one.
    const answer = yield* Effect.result(answerOf(body, bound.name))
    if (answer._tag === 'Failure') return formNotFound(c)
    const signed = yield* Effect.result(
      signSignatureRequest({
        ...{ app, token: undefined, signerId, boundTo: { flow: bound.flow, signer: bound.signer } },
        ...answer.success,
        network: {
          ipAddress: getRequestTrustedClientIp(c),
          userAgent: c.req.header('user-agent'),
        },
        forgetDerivedVariants: evictTransformCacheForKey,
      })
    )
    if (signed._tag === 'Failure') return refusedResponse(c, signed.failure)
    const { moves, ...signature } = signed.success
    yield* announceSignatureMoves(app, moves)
    return shapedJson(c, signature, signResponseSchema, 201)
  })
