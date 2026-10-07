/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  clearTransformCacheResponseSchema,
  type ClearTransformCacheResponse,
} from '@/domain/models/api/admin/storage/transform-cache'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { clearTransformCache } from '@/infrastructure/storage/transform-cache'
import type { Context, Hono } from 'hono'

/**
 * Handle DELETE /api/admin/storage/transform-cache — admin only
 *
 * Clears the on-the-fly image transform cache. Image transforms are computed
 * on demand from the stored original bytes, so clearing the transform cache
 * only discards derived (transformed) variants — it never touches the stored
 * originals, which remain fully available afterward.
 *
 * The counts report what THIS call dropped, so an immediate second clear
 * reports zero. They are the operator's only feedback: a cache hit and a fresh
 * transform are byte-identical on the download route, so nothing there can
 * witness whether the clear took effect.
 *
 * The operation is idempotent: clearing an already-empty cache is a success.
 */
function handleDeleteTransformCache(c: Context): Response {
  const cleared = clearTransformCache()

  // Response gate (S4 hard allow-list): an explicit literal rather than a
  // spread of the cache primitive's return value, so the body carries exactly
  // these four scalars however that primitive later evolves.
  const response: ClearTransformCacheResponse = {
    success: true,
    message: 'Transform cache cleared',
    clearedEntries: cleared.entries,
    clearedBytes: cleared.bytes,
  }

  // Decoded against the published component, exactly as the storage status read
  // does above. The type annotation alone only pins the field NAMES; the schema
  // additionally holds the `success: true` literal and the two non-negative
  // integer bounds, none of which a structural type can express.
  const parsed = decodeSafe(clearTransformCacheResponseSchema)(response)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to clear transform cache', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(parsed.data, 200)
}

/**
 * Chain the admin route that is not a read of the admin read registry onto a
 * Hono app: DELETE /api/admin/storage/transform-cache, which clears the derived
 * image transform cache without affecting stored originals.
 *
 * The console overview reads (overview, attention, search, footprint, storage
 * status, tables overview), the config version and the assignable roles are
 * admin read registry entries (`console-read-operations.ts`,
 * `config-read-operations.ts`, `roles-read-operations.ts`), mounted with their
 * MCP tools from one description each.
 *
 * Auth gating (admin-only) is wired upstream in `createApiRoutes`.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with admin routes chained
 */
export function chainAdminRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.on('DELETE', '/api/admin/storage/transform-cache', handleDeleteTransformCache) as T
}
