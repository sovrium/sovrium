/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Audit-log query filter + boot-reset hook.
 *
 * Despite its name, this module stores nothing: `GET /api/admin/audit-log` is
 * served by the Drizzle-backed store (`drizzle-store.ts`), which every route
 * feeds through `emitAuditEvent`. What lives here is the
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

/**
 * Boot-time reset hook (test-only — called from `createApiRoutes` at every
 * server boot).
 *
 * The in-memory buffer it once cleared was superseded by the Drizzle-backed
 * `audit_log` table. That table is NOT reset at boot: a boot truncate once
 * shipped for the E2E harness's benefit and erased the whole audit history on
 * every production restart. Spec isolation comes from the per-test database
 * the fixture duplicates, never from the product wiping its own log. Retained
 * as a stable, harmless hook so the boot sequence and its callers stay intact;
 * intentionally a no-op.
 */
export function resetAuditEntries(): void {
  // Intentional no-op — nothing in-memory is left to reset, and the DB-backed
  // `audit_log` is a durable record no boot path may truncate.
}
