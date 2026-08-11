/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Audit-log query filter + boot-reset hook.
 *
 * Historically this module backed `GET /api/admin/audit-log` with a
 * process-scoped in-memory FIFO buffer. That append/list path was superseded
 * by the Drizzle-backed store (`drizzle-store.ts`) when the route bucket was
 * consolidated to emit through `emitAuditEvent`. What remains here is the
 * shared `AuditListFilter` shape (still consumed by the Drizzle store and the
 * `emit` use-case) and the stable boot-reset hook called from
 * `createApiRoutes`.
 */

/**
 * Filter parameters for audit-entry queries.
 *
 * Consumed by the Drizzle-backed store and the `emit` use-case. All fields are
 * optional; an empty filter returns the full log.
 */
export interface AuditListFilter {
  readonly actorId?: string | undefined
  readonly action?: string | undefined
  /**
   * Transport ("canal") filter — narrows the feed to entries made through one
   * modality (`config-file | env | api | mcp | restore`). Backs the
   * `GET /api/admin/audit-log?transport=` filter
   *.
   */
  readonly transport?: string | undefined
  /**
   * Resource-type filter — narrows the feed to entries touching one kind of
   * resource (`config`, `form`, `form.submission`, `table.record`, …). Backs
   * the `GET /api/admin/audit-log?resourceType=` filter.
   *
   * Matched EXACTLY, never by prefix: several catalog resource types are
   * dotted compounds sharing a parent's prefix (`form` vs `form.submission`,
   * `automation` vs `automation.run`), so a prefix match would silently
   * over-return the children when the parent is requested.
   *
   * The value set is OPEN — every new `ACTION_CATALOG` row may introduce a
   * resource type — so an unrecognised value is a predicate that matches
   * nothing (200 with an empty item set), not a client error.
   */
  readonly resourceType?: string | undefined
}

/**
 * Boot-time reset hook (test-only — called from `createApiRoutes` at every
 * server boot).
 *
 * The in-memory buffer it once cleared was superseded by the Drizzle-backed
 * `audit_log` table, whose own boot reset is `clearAuditLogTable()`. Retained
 * as a stable, harmless hook so the boot sequence and its callers stay intact;
 * intentionally a no-op.
 */
export function resetAuditEntries(): void {
  // Intentional no-op — the live audit log resets via clearAuditLogTable().
}
