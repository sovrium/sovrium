/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { signatureChannelSchema } from './common'

/**
 * API contract for `POST /api/signatures/challenge` — send a one-time code to
 * the signer of the current signing session.
 *
 * The destination is never sent by the client: it is read from the request row
 * the session names, so a caller cannot make the server text an arbitrary
 * number. A new challenge for the same channel replaces the previous one, and
 * attempts are counted across resends and restarts.
 */

export const challengeRequestSchema = Schema.Struct({
  channel: signatureChannelSchema,
  challengeId: optionalField(
    uuid({
      description:
        'With channel sms in a flow that verifies both channels: the email challenge her email code answers, verified before a text message is sent',
    }).pipe(Schema.check(Schema.isMaxLength(36)))
  ),
  code: optionalField(
    Schema.String.annotate({ description: 'The email code, with challengeId' }).pipe(
      Schema.check(Schema.isPattern(/^\d{6}$/), Schema.isMaxLength(6))
    )
  ),
}).annotate({ identifier: 'ChallengeRequest' })

/** @public */
export type ChallengeRequest = typeof challengeRequestSchema.Type

export const challengeResponseSchema = Schema.Struct({
  challengeId: uuid({ description: 'Id to send back with the code' }),
  channel: signatureChannelSchema,
  destinationHint: Schema.String.annotate({
    description: 'The destination, masked (a•••@example.com, +33 6•• •• •• 42)',
  }),
  expiresAt: looseIsoDateTime({ description: 'When the code stops being accepted' }),
  resendAfter: looseIsoDateTime({ description: 'Earliest instant a new code may be asked for' }),
}).annotate({ identifier: 'ChallengeResponse' })

/** @public */
export type ChallengeResponse = typeof challengeResponseSchema.Type
