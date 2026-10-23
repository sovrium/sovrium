/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { presenceFactsSchema } from '../realtime/realtime'

/**
 * `GET /api/users/directory` — the people a `user` field resolves to.
 *
 * `{ id, name, image }`, never an address. Under `auth.presence`, a reader
 * whose role is in `visibleTo` also receives each person's `online` and, when
 * `lastSeen` is on, `lastSeen`; any other reader receives neither key, so the
 * shape itself does not reveal that presence exists.
 *
 * A `?filter=` expression holding `{ field: online, operator: eq, value }`
 * keeps only the people connected (`true`) or not (`false`) — the condition a
 * filter bar's Online / Offline choice publishes; other conditions are ignored. For a reader
 * outside `visibleTo` it keeps no one rather than the true set, so the filter
 * reveals nothing about who is connected.
 */
export const userDirectoryEntrySchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'User identifier, the value a user field stores' }),
  name: Schema.String.annotate({ description: 'Display name' }),
  image: Schema.NullOr(Schema.String).annotate({ description: 'Avatar URL, or null' }),
  online: optionalField(presenceFactsSchema.fields.online),
  lastSeen: presenceFactsSchema.fields.lastSeen,
})

export const userDirectoryResponseSchema = Schema.Struct({
  users: Schema.Array(userDirectoryEntrySchema).annotate({
    description: 'The people matching the search, never with an email address',
  }),
})

/** @public */
export type UserDirectoryEntry = Schema.Schema.Type<typeof userDirectoryEntrySchema>
