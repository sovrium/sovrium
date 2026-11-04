/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { signatureMethodSchema, signatureRequestStatusSchema } from './common'

/**
 * API contract for `POST /api/signatures/sign` — a token signer signs, inside
 * the signing session the signing page opened (a cookie; the link token itself
 * is never sent here).
 *
 * **Request shape.** `multipart/form-data`. Its binary `image` part (the drawn
 * mark, PNG bytes) is not modelled: the route reads it with `parseBody()`,
 * caps it at {@link MAX_SIGNATURE_IMAGE_BYTES} bytes and
 * {@link MAX_SIGNATURE_IMAGE_WIDTH} x {@link MAX_SIGNATURE_IMAGE_HEIGHT}
 * pixels, decodes it on the server, and stores it create-only under an
 * evidence key. A client never names a storage key. The text fields beside it
 * are {@link signRequestFieldsSchema}. A typed signature sends no image.
 */

export const MAX_SIGNATURE_IMAGE_BYTES = 512 * 1024
export const MAX_SIGNATURE_IMAGE_WIDTH = 2000
export const MAX_SIGNATURE_IMAGE_HEIGHT = 800

export const signRequestFieldsSchema = Schema.Struct({
  consent: Schema.Literal('true').annotate({
    description: 'The signer ticked her agreement to the statement; anything else is refused',
  }),
  method: signatureMethodSchema,
  typedName: optionalField(
    Schema.String.annotate({
      description: 'The name the signer typed, required when method is typed',
    }).pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)))
  ),
  challengeId: optionalField(
    uuid({ description: 'The challenge the code answers, when the flow verifies' }).pipe(
      Schema.check(Schema.isMaxLength(36))
    )
  ),
  code: optionalField(
    Schema.String.annotate({ description: 'The one-time code received' }).pipe(
      Schema.check(Schema.isPattern(/^\d{6}$/), Schema.isMaxLength(6))
    )
  ),
}).annotate({ identifier: 'SignRequestFields' })

/** @public */
export type SignRequestFields = typeof signRequestFieldsSchema.Type

export const signResponseSchema = Schema.Struct({
  evidenceId: uuid({ description: 'The evidence entry recording this signature' }),
  signedAt: looseIsoDateTime({ description: 'Server instant of signing' }),
  status: signatureRequestStatusSchema,
}).annotate({ identifier: 'SignResponse' })

/** @public */
export type SignResponse = typeof signResponseSchema.Type
