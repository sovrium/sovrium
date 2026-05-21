/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const WebhookPayloadSchema = Schema.Struct({
  includeFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Fields to include in payload (whitelist)' })
    )
  ),

  excludeFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Fields to exclude from payload (blacklist)' })
    )
  ),

  includePreviousValues: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Include previous values on update events' })
    )
  ),

  includeMetadata: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Include timestamp metadata in record data' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'WebhookPayload',
    title: 'Webhook Payload Configuration',
    description: 'Controls field selection and metadata in webhook payloads.',
  }),
  Schema.filter((payload) => {
    if (payload.includeFields && payload.excludeFields) {
      return 'includeFields and excludeFields are mutually exclusive — use one or the other'
    }
    return undefined
  })
)

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>
