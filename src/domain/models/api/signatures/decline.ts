/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/**
 * API contract for `POST /api/signatures/decline` — the signer of the current
 * signing session refuses to sign. The request ends `declined` and every
 * other unused link stops working.
 */

export const MAX_DECLINE_REASON_LENGTH = 500

export const declineRequestSchema = Schema.Struct({
  reason: optionalField(
    Schema.String.annotate({
      description: 'Why the signer declines, recorded in the evidence and passed to the trigger',
    }).pipe(Schema.check(Schema.isMaxLength(MAX_DECLINE_REASON_LENGTH)))
  ),
}).annotate({ identifier: 'DeclineRequest' })

/** @public */
export type DeclineRequest = typeof declineRequestSchema.Type

export const declineResponseSchema = Schema.Struct({
  status: Schema.Literal('declined'),
}).annotate({ identifier: 'DeclineResponse' })
