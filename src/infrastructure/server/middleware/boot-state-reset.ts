/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reset every in-process singleton that must not survive a server boot.
 *
 * The E2E harness restarts the server between specs inside ONE Bun process, so
 * a module-level `Map` or counter outlives the server it belongs to and leaks
 * into the next spec. Each reset below carries its own reason; read them before
 * adding a fourth, and read the audit-log paragraph before adding a truncate.
 */

import { resetAuditEntries } from '@/infrastructure/audit-log/in-memory-store'
import { resetFormRateLimitState } from '@/infrastructure/forms/form-rate-limiter'
import { resetEcoIndexTrackerAtBoot } from '@/infrastructure/process/eco-index-tracker'
import { resetPageCacheStatsAtBoot } from '@/infrastructure/process/page-cache-telemetry'
import { resetTelemetryEpochAtBoot } from '@/infrastructure/process/telemetry-epoch'

export const resetBootState = (): void => {
  // Reset the in-process audit-log store on every server boot. E2E tests
  // restart the server between specs but share the Bun process, so the
  // module singleton would otherwise leak entries across tests (see
  // memory: project_test_session_bleed for the analogous DB pattern).
  // The reset is no-op in production where the server boots once.

  resetAuditEntries()

  // The DB-backed `audit_log` table is DELIBERATELY NOT reset here. A boot
  // truncate once lived on this line, for the E2E harness's benefit, and it ran
  // unconditionally: no env gate, no test-only guard, production took exactly
  // the same line. Every restart — a deploy, a crash-loop, a `systemctl
  // restart` — erased the entire audit history, so anyone who could cause a
  // restart could erase their own trail. That is a compliance defect, not a
  // nicety: an audit log a restart can wipe cannot answer the one question it
  // exists to answer.
  //
  // The harness need it served no longer exists either. `[internal ref]`
  // duplicates a fresh template database per TEST
  // (`generateTestDatabaseName` → `_testDatabaseName`, and the analogous
  // per-test file in SQLite mode), so audit rows cannot bleed between specs;
  // isolation comes from the database, not from a truncate the product ships.
  // (`resetAuditEntries()` above is a retained no-op hook, not a second
  // truncate — see its own docstring.)

  // Same boot-reset rationale for the footprint counters — the in-memory grade
  // and page-cache tallies would otherwise leak across E2E spec restarts. The
  // shared epoch is re-stamped FIRST, so both counter sets report an interval
  // that starts at this boot rather than at module load (see
  // infrastructure/process/telemetry-epoch.ts).
  resetTelemetryEpochAtBoot()
  resetEcoIndexTrackerAtBoot()
  resetPageCacheStatsAtBoot()

  // Same boot-reset rationale for the F-03 / PG-02 in-process rate-limit
  // sliding-window state. Without this, a comment rate-limit test that
  // consumed all 5 slots in spec N would leave spec N+1 starting with the
  // budget already exhausted (the same Bun process re-uses the module-level
  // `Map`).
  resetFormRateLimitState()
}
