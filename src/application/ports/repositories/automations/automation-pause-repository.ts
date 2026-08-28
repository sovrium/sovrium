/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation Pause Repository Port.
 *
 * Backs the OPERATIONAL pause — a row in `system.automation_pauses` keyed by
 * the config automation NAME. Presence of a row means paused; resume DELETEs
 * it. See `infrastructure/database/drizzle/schema/automation.ts`
 * (`automationPauses`) for why the state is name-keyed, in its own table, and
 * never a runtime write to the config's `automations[].enabled`.
 *
 * Two distinct reads, deliberately:
 *
 *   - {@link listPausedNames} returns just the NAME SET. It is the hot read —
 *     every trigger entry point calls it once per dispatch and threads the set
 *     into the pure predicate `isAutomationOperationallyEnabled`. It projects
 *     one column and joins nothing.
 *   - {@link listPauses} additionally resolves the acting operator's display
 *     name and the timestamp, for the console catalog's "Paused by / at"
 *     column. It joins `auth.user` and is called only by
 *     `GET /api/admin/automations`.
 *
 * Keeping them apart means the runtime gate never pays for a join it does not
 * read.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for automation-pause operations.
 */
export class AutomationPauseDatabaseError extends Data.TaggedError('AutomationPauseDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * One pause, enriched for the console catalog.
 *
 * `pausedBy` is nullable rather than merely absent: `paused_by_user_id` is
 * `ON DELETE SET NULL`, so erasing the operator who paused an automation sheds
 * the identifier while the pause itself survives (GDPR Art. 17). A pause whose
 * author was erased renders with an unknown actor — never as un-paused.
 *
 * `pausedAt` stays in its dialect-native `Date | string` shape (PG returns a
 * `Date`, SQLite a `timestamp_ms`-decoded `Date`, and a raw driver read can
 * yield a string); the use case owns ISO normalization.
 */
export interface AutomationPauseRow {
  readonly automationName: string
  readonly pausedBy: string | null
  readonly pausedAt: Date | string
}

export class AutomationPauseRepository extends Context.Service<
  AutomationPauseRepository,
  {
    /**
     * Every paused automation NAME. The hot read behind every runtime gate.
     */
    readonly listPausedNames: Effect.Effect<ReadonlySet<string>, AutomationPauseDatabaseError>

    /**
     * Every pause with its actor display name and timestamp, for the console
     * catalog.
     */
    readonly listPauses: Effect.Effect<readonly AutomationPauseRow[], AutomationPauseDatabaseError>

    /**
     * Record a pause. IDEMPOTENT: a second pause of an already-paused
     * automation is a no-op that leaves the ORIGINAL `pausedAt` and actor in
     * place. An operator hammering Pause during an incident must not have the
     * audit trail misreport when containment actually began — so this is
     * `ON CONFLICT DO NOTHING`, never an upsert.
     */
    readonly pause: (input: {
      readonly automationName: string
      readonly pausedByUserId?: string | undefined
    }) => Effect.Effect<void, AutomationPauseDatabaseError>

    /**
     * Clear a pause. IDEMPOTENT: deleting a row that is not there succeeds.
     */
    readonly resume: (automationName: string) => Effect.Effect<void, AutomationPauseDatabaseError>
  }
>()('AutomationPauseRepository') {}
