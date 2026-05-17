/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, like, or, gt, isNull, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AutomationStateDatabaseError,
  AutomationStateRepository,
} from '@/application/ports/repositories/automation-state-repository'
import { db } from '@/infrastructure/database'
import { automationState } from '@/infrastructure/database/drizzle/schema/automation-state'

/**
 * Automation State Repository Implementation (Drizzle).
 *
 * Backs the `state:*` action operators. All operations scoped by
 * `automation_id` (FK NOT NULL). The unique index on
 * `(automation_id, key)` enforces upsert semantics for `set` and
 * `increment`.
 *
 * Expiration is lazy: `get` and `list` filter out rows whose `ttl` is
 * non-null and in the past. A background sweep is out of scope.
 *
 * Increment is atomic via `INSERT ... ON CONFLICT DO UPDATE` with a
 * `((value #>> '{}')::numeric + delta)::text::jsonb` cast — this works for
 * both numeric jsonb (`42`) and string-encoded numeric jsonb (`"42"`)
 * because `#>> '{}'` extracts the value as text regardless of its jsonb
 * shape, and the round-trip back through `text::jsonb` produces a numeric
 * jsonb on the way out.
 */
export const AutomationStateRepositoryLive = Layer.succeed(AutomationStateRepository, {
  set: ({ automationId, key, value, ttlMs }) =>
    Effect.tryPromise({
      try: async () => {
        const ttlAt = ttlMs === undefined ? undefined : new Date(Date.now() + ttlMs)
        // eslint-disable-next-line functional/no-expression-statements
        await db
          .insert(automationState)
          .values({
            automationId,
            key,
            value,
            ...(ttlAt !== undefined ? { ttl: ttlAt } : {}),
          })
          .onConflictDoUpdate({
            target: [automationState.automationId, automationState.key],
            set: {
              value,
              ttl: ttlAt,
              updatedAt: new Date(),
            },
          })
      },
      catch: (cause) => new AutomationStateDatabaseError({ cause }),
    }),

  get: ({ automationId, key }) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({ value: automationState.value })
          .from(automationState)
          .where(
            and(
              eq(automationState.automationId, automationId),
              eq(automationState.key, key),
              or(isNull(automationState.ttl), gt(automationState.ttl, new Date()))
            )
          )
          .limit(1)
        // null sentinel — specs assert `body.actions.<name>.value).toBeNull()`
        // when the key is missing or expired. Returning undefined would omit
        // the field from JSON serialization and break that contract.
        // eslint-disable-next-line unicorn/no-null
        return rows[0]?.value ?? null
      },
      catch: (cause) => new AutomationStateDatabaseError({ cause }),
    }),

  list: ({ automationId, prefix }) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({ key: automationState.key, value: automationState.value })
          .from(automationState)
          .where(
            and(
              eq(automationState.automationId, automationId),
              like(automationState.key, `${prefix}%`),
              or(isNull(automationState.ttl), gt(automationState.ttl, new Date()))
            )
          )
        return rows.map((row) => ({ key: row.key, value: row.value }))
      },
      catch: (cause) => new AutomationStateDatabaseError({ cause }),
    }),

  delete: ({ automationId, key }) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db
          .delete(automationState)
          .where(and(eq(automationState.automationId, automationId), eq(automationState.key, key)))
      },
      catch: (cause) => new AutomationStateDatabaseError({ cause }),
    }),

  increment: ({ automationId, key, amount }) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .insert(automationState)
          .values({
            automationId,
            key,
            // First-time insert: store the delta as the initial value.
            value: amount,
          })
          .onConflictDoUpdate({
            target: [automationState.automationId, automationState.key],
            set: {
              // Atomic JSONB-numeric increment: extract as text via #>>'{}',
              // cast to numeric, add delta, cast back through text to jsonb.
              // Works for both numeric and string-encoded numeric jsonb.
              value: sql`(((${automationState.value} #>> '{}')::numeric) + ${amount})::text::jsonb`,
              updatedAt: new Date(),
            },
          })
          .returning({ value: automationState.value })
        const next = Number(rows[0]?.value ?? 0)
        return Number.isFinite(next) ? next : 0
      },
      catch: (cause) => new AutomationStateDatabaseError({ cause }),
    }),
})
