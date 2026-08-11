/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, like, or, gt, isNull, sql, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationStateDatabaseError,
  AutomationStateRepository,
} from '@/application/ports/repositories/automations/automation-state-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { automationState as automationStatePg } from '@/infrastructure/database/drizzle/schema/automation-state'
import { automationState as automationStateSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/automation-state'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const automationState = resolveDialectSchema(automationStatePg, automationStateSqlite)

/** Wrap a DB promise, adapting failures to AutomationStateDatabaseError. */
const wrap = makeDbWrap((cause) => new AutomationStateDatabaseError({ cause }))

/**
 * Build a SQL fragment that writes a JS value into the `automation_state.value`
 * jsonb column with a SINGLE pass of JSON encoding.
 *
 * The PG schema's `value` column is a pass-through `customType` (`jsonbRaw`
 * in `schema/automation-state.ts`) so Drizzle does not stringify/parse on
 * the way through. But `bun:sql`, the PG driver, has its own jsonb wire
 * serializer that JSON-encodes string/object parameters bound to jsonb-typed
 * placeholders. Letting Drizzle's regular `.values({ value })` flow handle
 * the write would either get bun:sql's encode (if the JS value is a string)
 * or rejected (if the JS value is a raw number; bun:sql does not coerce
 * numbers to jsonb).
 *
 * Instead, hand the column an explicit `${JSON.stringify(value)}::text::jsonb`
 * SQL fragment. The `::text` cast forces bun:sql to bind the parameter as
 * plain text — defeating the jsonb-typed-param auto-encoder — and the
 * subsequent `::jsonb` parses the JSON text exactly once. Strings, numbers,
 * objects, arrays, and `null` all round-trip cleanly.
 *
 * SQLite is unaffected. Its mirror keeps the stock `text(mode:'json')`
 * column which round-trips through a single `JSON.stringify`/`JSON.parse`
 * with no driver-level layer to defeat.
 *
 * Runtime probe evidence (PG):
 *   - Before fix (stock jsonb()):       value::text = `"\"10\""` (DOUBLE)
 *   - After fix (`::text::jsonb`):      value::text = `"10"`     (single)
 */
const encodeJsonbValue = (value: unknown): unknown | SQL =>
  isSqliteRuntime() ? value : sql`${JSON.stringify(value)}::text::jsonb`

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
    wrap(async () => {
      const ttlAt = ttlMs === undefined ? undefined : new Date(Date.now() + ttlMs)
      const encodedValue = encodeJsonbValue(value)
      // eslint-disable-next-line functional/no-expression-statements
      await db
        .insert(automationState)
        .values({
          automationId,
          key,
          value: encodedValue,
          ...(ttlAt !== undefined ? { ttl: ttlAt } : {}),
        })
        .onConflictDoUpdate({
          target: [automationState.automationId, automationState.key],
          set: {
            value: encodedValue,
            ttl: ttlAt,
            updatedAt: new Date(),
          },
        })
    }),

  get: ({ automationId, key }) =>
    wrap(async () => {
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
    }),

  list: ({ automationId, prefix }) =>
    wrap(async () => {
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
    }),

  delete: ({ automationId, key }) =>
    wrap(async () => {
      // eslint-disable-next-line functional/no-expression-statements
      await db
        .delete(automationState)
        .where(and(eq(automationState.automationId, automationId), eq(automationState.key, key)))
    }),

  increment: ({ automationId, key, amount }) =>
    wrap(async () => {
      // Atomic numeric increment, dialect-aware:
      // - PG: `(((${value} #>> '{}')::numeric) + ${amount})::text::jsonb` —
      //   `#>> '{}'` extracts the JSONB value as TEXT regardless of its
      //   underlying shape (numeric `42` or string-encoded `"42"`); cast to
      //   numeric, add the delta, then round-trip via `::text::jsonb` so the
      //   stored value remains a numeric JSONB.
      // - SQLite: `(CAST(json_extract(value, '$') AS REAL) + ${amount})` —
      //   `json_extract(col, '$')` returns the underlying scalar (the row
      //   value, not a JSON-quoted form); cast to REAL, add the delta. The
      //   SQLite mirror's `text(mode:'json')` column re-encodes the bound
      //   number as JSON on write, preserving the round-trip semantics.
      const incrementExpr = isSqliteRuntime()
        ? sql`(CAST(json_extract(${automationState.value}, '$') AS REAL) + ${amount})`
        : sql`(((${automationState.value} #>> '{}')::numeric) + ${amount})::text::jsonb`

      const rows = await db
        .insert(automationState)
        .values({
          automationId,
          key,
          // First-time insert: store the delta as the initial value.
          value: encodeJsonbValue(amount),
        })
        .onConflictDoUpdate({
          target: [automationState.automationId, automationState.key],
          set: {
            value: incrementExpr,
            updatedAt: new Date(),
          },
        })
        .returning({ value: automationState.value })
      const next = Number(rows[0]?.value ?? 0)
      return Number.isFinite(next) ? next : 0
    }),
})
