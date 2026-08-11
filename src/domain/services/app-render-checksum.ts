/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * App render-checksum — a content hash of the render-affecting slice of an
 * `App` schema, used as the invalidation key for the static page-output cache
 * (`ECO_PAGE_CACHE`).
 *
 * Why a dedicated checksum rather than `generateSchemaChecksum`:
 * `generateSchemaChecksum` (infrastructure/database/schema/migration-audit-trail.ts)
 * snapshots only `app.tables` — a page-content edit would never change it, so
 * cached HTML would go stale. This checksum hashes exactly the parts of `app`
 * that can change rendered page HTML: `pages`, `components`, `theme`,
 * `languages`, `analytics`. Any edit to those changes the checksum, which
 * changes every page-cache key, making stale entries unreachable — automatic
 * invalidation with no purge logic.
 */

import { createHash } from 'node:crypto'
import type { App } from '@/domain/models/app'

/**
 * Recursively sort object keys so the same content always serializes
 * identically regardless of property insertion order. Mirrors the
 * `sortObjectKeys` helper in `infrastructure/css/cache/css-cache-service.ts`.
 */
const sortObjectKeys = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortObjectKeys)

  const record = value as Record<string, unknown>
  return Object.keys(record)
    .toSorted()
    .reduce<Record<string, unknown>>(
      (acc, key) => ({ ...acc, [key]: sortObjectKeys(record[key]) }),
      {}
    )
}

/**
 * Compute a stable SHA-256 hex checksum of the render-affecting slice of `app`.
 *
 * The result is deterministic: identical content (even with reordered object
 * keys) yields an identical checksum, and any change to `pages`, `components`,
 * `theme`, `languages`, or `analytics` yields a different one. Changes confined
 * to `app.tables` (or other non-render fields) do not change the checksum —
 * that is intentional, those fields do not affect rendered page HTML.
 *
 * @param app - The parsed application schema.
 * @returns 64-character lowercase SHA-256 hex string.
 */
export const computeAppRenderChecksum = (app: App): string => {
  const renderSlice = {
    pages: app.pages,
    components: app.components,
    theme: app.theme,
    languages: app.languages,
    analytics: app.analytics,
  }
  const normalized = sortObjectKeys(renderSlice)
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
