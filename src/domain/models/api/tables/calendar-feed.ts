/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uri } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Calendar feed token schemas
// ---------------------------------------------------------------------------

/**
 * Response for minting (or replacing) the caller's calendar feed address.
 *
 * The address embeds the secret token, and this response is the only time it
 * is ever revealed: the server keeps only a hash, so a lost address is
 * replaced, never recovered. Minting again invalidates the previous address.
 *
 * Used for:
 * - POST /api/tables/:tableName/calendar-feed/token (201)
 */
export const calendarFeedTokenMintedSchema = Schema.Struct({
  url: uri({
    description:
      'Absolute address of the calendar feed, token included. Shown once: store it in your calendar app now',
  }),
  createdAt: looseIsoDateTime({
    description: 'ISO 8601 timestamp when this feed address was created',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'CalendarFeedTokenMinted',
})

/**
 * Response reporting whether the caller holds an active calendar feed address.
 *
 * Strict by design: it never carries the token or the address, so an excess
 * key fails the response gate instead of leaking a secret.
 *
 * Used for:
 * - GET /api/tables/:tableName/calendar-feed/token (200)
 */
export const calendarFeedTokenStatusSchema = Schema.Struct({
  active: Schema.Boolean.annotate({
    description: 'Whether the caller currently has a working feed address for this table',
  }),
  createdAt: optionalField(
    looseIsoDateTime({
      description:
        'ISO 8601 timestamp when the active feed address was created (present only when active)',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'CalendarFeedTokenStatus',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type CalendarFeedTokenMinted = typeof calendarFeedTokenMintedSchema.Type
export type CalendarFeedTokenStatus = typeof calendarFeedTokenStatusSchema.Type
