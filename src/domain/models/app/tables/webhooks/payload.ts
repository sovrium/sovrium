/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Webhook Payload Customization ──────────────────────────────────────────

/**
 * Controls which fields are included in webhook payloads.
 *
 * `includeFields` and `excludeFields` are mutually exclusive.
 *
 * @example
 * ```typescript
 * // Only send specific fields
 * { includeFields: ['customer', 'status', 'total'], includePreviousValues: true }
 *
 * // Send all except internal notes
 * { excludeFields: ['internal-notes'] }
 * ```
 */
export const WebhookPayloadSchema = Schema.Struct({
  /** Only include these fields in the payload (mutually exclusive with excludeFields). */
  includeFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Fields to include in payload (whitelist)' })
    )
  ),

  /** Exclude these fields from the payload (mutually exclusive with includeFields). */
  excludeFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Fields to exclude from payload (blacklist)' })
    )
  ),

  /** Include previous field values on update events (default: false). */
  includePreviousValues: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Include previous values on update events' })
    )
  ),

  /** Include createdAt/updatedAt metadata in record data (default: false). */
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
