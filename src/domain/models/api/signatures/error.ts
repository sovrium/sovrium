/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { NOT_FOUND_ERROR, NOT_FOUND_MESSAGE } from '../error'

/**
 * How the signing routes refuse.
 *
 * An unknown, expired, used or revoked link, and a signing session that no
 * longer exists, all answer the same 404 body ({@link SIGNING_NOT_FOUND_BODY})
 * and render the same not-found page: the answer never tells a link-holder
 * which of the four it was. Every other refusal names its code.
 */

/** The one body every invalid link or session answers, whatever the reason. */
export const SIGNING_NOT_FOUND_BODY = {
  success: false,
  error: NOT_FOUND_ERROR,
  message: NOT_FOUND_MESSAGE,
  code: 'NOT_FOUND',
} as const

export const signingNotFoundResponseSchema = Schema.Struct({
  success: Schema.Literal(false),
  error: Schema.Literal(NOT_FOUND_ERROR),
  message: Schema.Literal(NOT_FOUND_MESSAGE),
  code: Schema.Literal('NOT_FOUND'),
}).annotate({
  identifier: 'SigningNotFound',
  description:
    'The uniform answer for an unknown, expired, used or revoked link or session, identical in every case',
})

/** The codes a signing route refuses with, besides the uniform 404. */
export const SIGNATURE_ERROR_CODES = [
  'CONSENT_REQUIRED',
  'VERIFICATION_REQUIRED',
  'CODE_INVALID',
  'CODE_EXPIRED',
  'TOO_MANY_CODE_ATTEMPTS',
  'RESEND_TOO_SOON',
  'TOO_MANY_CODES_SENT',
  'CHANNEL_UNAVAILABLE',
  'SMS_UNAVAILABLE',
  'IMAGE_INVALID',
  'STATEMENT_CHANGED',
  'NOT_YOUR_TURN',
] as const

export const signatureErrorCodeSchema = Schema.Literals(SIGNATURE_ERROR_CODES).annotate({
  description:
    'CONSENT_REQUIRED (400, consent missing), VERIFICATION_REQUIRED (403, a required channel is not verified), CODE_INVALID (400), CODE_EXPIRED (400), TOO_MANY_CODE_ATTEMPTS (429, too many wrong codes: the signer’s verification is locked for the request), RESEND_TOO_SOON (429, a new code was asked within a minute of the last), TOO_MANY_CODES_SENT (429, the signer or her network address has received as many codes as allowed), CHANNEL_UNAVAILABLE (400, the flow offers no code by this channel here), SMS_UNAVAILABLE (503, the text message could not be sent, its provider out of budget or failing: ask again after a minute), IMAGE_INVALID (400, not a PNG within the size and dimension limits), STATEMENT_CHANGED (409, the statement shown differs from the one the server resolves), NOT_YOUR_TURN (409, an earlier signer has not signed)',
})

export const signatureErrorResponseSchema = Schema.Struct({
  success: Schema.Literal(false),
  code: signatureErrorCodeSchema,
  message: Schema.String.annotate({ description: 'What went wrong, for the signer' }),
}).annotate({ identifier: 'SignatureError' })

/** @public */
export type SignatureErrorResponse = typeof signatureErrorResponseSchema.Type
