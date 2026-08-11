/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared response helpers for the tables-routes layer.
 *
 * These factories exist to consolidate envelopes that were previously
 * duplicated inline across `row-level-guard.ts` and
 * `record-write-handlers.ts`. Centralising them guarantees the canonical
 * wording, status code, and error code stay in lock-step across the
 * single-record and bulk paths.
 *
 * The shape mirrors the existing `respondNotFound` / `NOT_FOUND_RESPONSE`
 * pattern already used by the user-access handlers and row-level-read
 * helpers in this directory.
 */

import type { Context } from 'hono'

/**
 * Canonical 404 returned when the user holds read access on the table but
 * lacks `permissions.create`. Per S1 anti-enumeration, authz denials are
 * 404 so the caller cannot distinguish "exists but forbidden" from "doesn't
 * exist", and the permission boundary itself is not discoverable. Used by
 * both the single-record `handleCreateRecord` path and the bulk
 * `enforceBulkCreateGate` path so the wording stays aligned.
 */
export const forbiddenCreateResponse = (c: Context): Response =>
  c.json(
    {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
  )

/**
 * Canonical 404 returned when the user passes `permissions.create` (and
 * therefore knows the table exists) but the proposed row violates
 * `rowLevelPermissions.create.when`. Per S1 anti-enumeration, this case
 * also returns 404 so the scope boundary itself is not discoverable. Used
 * by both the single-record `checkCreatePredicate` path and the bulk
 * `enforceBulkCreateGate` path.
 */
export const forbiddenCreateScopeResponse = (c: Context): Response =>
  c.json(
    {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
  )
