/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The per-user entity lists: `GET /api/favorites` and `GET /api/recent`.
 *
 * `entityType` stays a plain string on the way out: the column is free text, and
 * only the write path narrows it to `record` or `page`. The timestamps stay
 * plain strings too, since a dialect may hand back its own stored form.
 */
const entityFields = {
  id: Schema.String.annotate({ description: 'Id of the list entry' }),
  entityType: Schema.String.annotate({ description: 'Kind of entity the entry points at' }),
  entityId: Schema.String.annotate({ description: 'Id of that entity' }),
  tableId: Schema.NullOr(Schema.String).annotate({
    description: 'Table of a record, null for an entity outside a table',
  }),
}

/** One favorite, as `GET /api/favorites` lists it. */
export const favoriteSchema = Schema.Struct({
  ...entityFields,
  createdAt: Schema.String.annotate({ description: 'When the entity became a favorite' }),
})

/** The caller's favorites, newest first. */
export const favoriteListResponseSchema = Schema.Array(favoriteSchema)

/** One recent item, as `GET /api/recent` lists it. */
export const recentItemSchema = Schema.Struct({
  ...entityFields,
  viewedAt: Schema.String.annotate({ description: 'When the caller last viewed the entity' }),
})

/** The caller's recent items, most recently viewed first. */
export const recentListResponseSchema = Schema.Array(recentItemSchema)
