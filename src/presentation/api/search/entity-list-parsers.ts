/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared pure helpers for the per-user entity-list APIs (`/api/favorites`,
 * `/api/recent`) and the command-palette search.
 *
 * Favorites and recent items both accept a `{ entityType, entityId, tableName? }`
 * mutation body. This module is the single source of truth for parsing and
 * validating that body. It stays in the presentation layer because it has no
 * data-access concern — the existence-probe logic that previously lived here
 * (`recordStillExists` / `filterLiveEntities`) moved into the
 * `user-entity-lists` use case and its repository port (data access belongs in
 * application + infrastructure, not presentation).
 */

/** Entity types a favorite / recent item may point at. */
export type EntityType = 'record' | 'page'

/** Parsed + validated entity mutation input (favorites POST/DELETE, recent POST). */
export interface EntityMutationInput {
  readonly entityType: EntityType
  readonly entityId: string
  readonly tableName: string | null
}

/**
 * Parse and validate a `{ entityType, entityId, tableName? }` mutation body.
 * Returns `undefined` when required fields are missing or `entityType` is not
 * a supported value.
 *
 * `tableName` falls back to `null` (not `undefined`): the
 * `system.user_favorites.table_id` / `system.user_recent_items.table_id`
 * columns are nullable and Drizzle requires a SQL `NULL`.
 */
export const parseEntityMutationBody = (body: unknown): EntityMutationInput | undefined => {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const entityType = typeof record['entityType'] === 'string' ? record['entityType'] : undefined
  const entityId = typeof record['entityId'] === 'string' ? record['entityId'] : undefined
  if (entityType === undefined || entityId === undefined) return undefined
  if (entityType !== 'record' && entityType !== 'page') return undefined
  // eslint-disable-next-line unicorn/no-null -- nullable DB column requires SQL NULL
  const tableName = typeof record['tableName'] === 'string' ? record['tableName'] : null
  return { entityType, entityId, tableName }
}
