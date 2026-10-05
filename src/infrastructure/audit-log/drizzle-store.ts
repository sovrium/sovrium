/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Drizzle-backed audit-log store (Phase 8 Cycle 1b — canonical event store).
 *
 * Replaces the Phase-0 in-memory buffer with the DB-backed `audit_log` table
 * restored by Cycle 1a (migrations 0006). Every admin-tier mutation that is
 * audited funnels through `appendAuditEntryToDb`; the read side
 * (`listAuditEntriesFromDb`) backs `GET /api/admin/audit-log`.
 *
 * Why a row-shape bridge:
 *   - The application-layer `AuditLogEntry` shape nests an `actor` and a
 *     `resource` block; the database promotes those to flat columns so they
 *     can be indexed (action / actor_id / severity / result / resource_type).
 *     `rowFromEntry` flattens; `rowToEntry` re-nests.
 *   - `timestamp` is an ISO string in the API shape and a `Date` column in
 *     the DB. Drizzle hands us a `Date` on read (both Postgres `timestamp with
 *     time zone` and SQLite `integer(timestamp_ms)`), so we `.toISOString()`
 *     on read and `new Date(...)` on write.
 *
 * Why try/catch around inserts:
 *   - Some boot paths (CLI `schema` / `validate` subcommands, the schema
 *     drift checker) run before migrations are applied — touching the
 *     `audit_log` table there throws a "relation does not exist" error.
 *     We log + skip rather than propagate so a tooling path that emits a
 *     stray audit entry never crashes the host process.
 */

import { eq, and, asc, desc, gte, inArray, lt, sql, type Column } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { auditLog } from '@/infrastructure/database/drizzle/schema/audit-log'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { logError } from '@/infrastructure/logging/logger'
import type {
  AuditLogEntry,
  AuditResult,
  AuditTransport,
} from '@/domain/models/api/admin/audit-log/entry'
import type { ActorRole, ActorType } from '@/domain/models/api/admin/envelope/actor'
import type { Severity } from '@/domain/models/api/admin/envelope/severity'
import type { AuditListFilter } from '@/infrastructure/audit-log/in-memory-store'
import type { DrizzleDB, DrizzleTransaction } from '@/infrastructure/database'

/** Drizzle row shape inferred from the pg-core schema. */
type AuditLogRow = typeof auditLog.$inferSelect

/** Drizzle insert shape — used to flatten an `AuditLogEntry` for `.values()`. */
type NewAuditLogRow = typeof auditLog.$inferInsert

/**
 * Flatten an `AuditLogEntry` (nested actor + resource) into a row
 * suitable for `db.insert(auditLog).values(...)`.
 *
 * The `actor.email` is optional in the API shape; the column is nullable. We
 * coerce `undefined` to `null` so the round-trip via `rowToEntry` produces
 * the same shape we started with.
 */
function rowFromEntry(entry: Readonly<AuditLogEntry>): Readonly<NewAuditLogRow> {
  // `actor.id` is `string | null` on the API shape — the column is nullable
  // text and the FK has `ON DELETE SET NULL`, so we preserve the null when
  // the actor has no user id (system actors). The base shape uses null at
  // the boundary; eslint-disable for unicorn/no-null in this file because
  // the contract with the API + DB schema is `null` (not `undefined`).
  return {
    id: entry.id,
    createdAt: new Date(entry.timestamp),
    action: entry.action,
    actorId: entry.actor.id,
    actorType: entry.actor.type,
    actorRole: entry.actor.role,
    // eslint-disable-next-line unicorn/no-null -- DB column is nullable text; null is the contract for "no email captured"
    actorEmail: entry.actor.email ?? null,
    resourceType: entry.resource.type,
    resourceId: entry.resource.id,
    // eslint-disable-next-line unicorn/no-null -- DB column is nullable text; null is the contract for "no human-readable label"
    resourceName: entry.resource.name ?? null,
    severity: entry.severity,
    result: entry.result,
    transport: entry.transport,
    // `metadata` is jsonb on Postgres. drizzle-orm + bun-sql encodes string
    // parameters bound to jsonb columns as TEXT, which Postgres then casts
    // to a JSONB STRING (not a JSONB OBJECT) — `->>'key'` returns NULL and
    // the row reads back as a JSON-stringified literal in pg's client. The
    // `jsonbLiteral` helper inlines the value as `'…'::jsonb` so PG parses
    // it as a structured object. On SQLite the helper emits a plain
    // single-quoted string literal compatible with `text({mode:'json'})`.
    // See `src/infrastructure/database/sql/sql-utils.ts` for the upstream
    // tracking link.
    metadata:
      // eslint-disable-next-line unicorn/no-null -- DB column is nullable jsonb; null is the contract for "no metadata"
      entry.metadata !== undefined ? (jsonbLiteral(entry.metadata) as unknown as null) : null,
  }
}

/**
 * Re-nest a flat DB row back into the API `AuditLogEntry` shape.
 *
 * The reverse of `rowFromEntry`: optional `actor.email` and `resource.name`
 * are dropped when null so the JSON response stays clean; the same applies to
 * `metadata` (we only attach the key when the column carries an object).
 */
function rowToEntry(row: Readonly<AuditLogRow>): Readonly<AuditLogEntry> {
  const { actorEmail, resourceName, metadata } = row

  return {
    id: row.id,
    timestamp: new Date(row.createdAt).toISOString(),
    action: row.action,
    actor: {
      id: row.actorId,
      type: row.actorType as ActorType,
      role: row.actorRole as ActorRole,
      ...(actorEmail !== null && actorEmail !== undefined ? { email: actorEmail } : {}),
    },
    resource: {
      type: row.resourceType,
      id: row.resourceId,
      ...(resourceName !== null && resourceName !== undefined ? { name: resourceName } : {}),
    },
    severity: row.severity as Severity,
    result: row.result as AuditResult,
    // `transport` is `NOT NULL DEFAULT 'api'` so the column is always populated;
    // pre-taxonomy rows read back as `api` (the default). Coerce-fallback to
    // `api` keeps the read side total even if a future raw insert leaves it blank.
    transport: (typeof row.transport === 'string' && row.transport.length > 0
      ? row.transport
      : 'api') as AuditTransport,
    ...(metadata !== null && metadata !== undefined
      ? { metadata: metadata as Record<string, unknown> }
      : {}),
  }
}

/**
 * Append one entry to the DB-backed `audit_log` table.
 *
 * Best-effort: catches the "table does not exist" failure mode (boot paths
 * that emit before migrations apply) and logs+skips so the host request
 * never fails on an audit-log side effect.
 */
export async function appendAuditEntryToDb(entry: Readonly<AuditLogEntry>): Promise<void> {
  try {
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await db.insert(auditLog).values(rowFromEntry(entry))
  } catch (error) {
    // Best-effort emit; do not crash the host request.
    logError('[audit-log] failed to persist entry', error, {
      id: entry.id,
      action: entry.action,
    })
  }
}

/**
 * Append one entry inside an existing transaction handle.
 *
 * Used by `purgeAccount` to interleave the `account.deletion.purged` audit
 * write with the parent-row DELETE inside the same transaction — the audit
 * row is inserted BEFORE the user row is deleted, so the `actor_id` FK
 * is still valid at insert time; the `ON DELETE SET NULL` FK behavior
 * null-ifies it when the user row is deleted on commit.
 */
export async function appendAuditEntryToDbTx(
  tx: Readonly<DrizzleTransaction>,
  entry: Readonly<AuditLogEntry>
): Promise<void> {
  // `DrizzleTransaction` is the portable transaction surface; the insert
  // builder is identical to `db.insert(...)`. Cast to the same writer
  // facade so TypeScript does not need a separate overload.
  const writer = tx as unknown as DrizzleDB
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect inside an open transaction
  await writer.insert(auditLog).values(rowFromEntry(entry))
}

/**
 * Clear the actor address on every entry an erased person made, inside the
 * erasure transaction.
 *
 * `actor_id` sheds itself (`ON DELETE SET NULL`) when the user row goes, but
 * `actor_email` is a plain column nothing else clears, so without this the
 * trail would go on naming the erased person by address. The entries stay, as
 * acts with their actor's tier. The match is on `actor_id`, and must run BEFORE
 * the user row is deleted: afterwards the id is null and nothing links the row
 * to the person. An address is never matched — it is not unique over time.
 *
 * Drizzle binds `userId` as a parameter on both dialects.
 */
export async function shedActorEmailInDbTx(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const writer = tx as unknown as DrizzleDB
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect inside an open transaction
  await writer
    .update(auditLog)
    // eslint-disable-next-line unicorn/no-null -- a cleared address is SQL NULL, never a placeholder
    .set({ actorEmail: null })
    .where(eq(auditLog.actorId, userId))
}

/**
 * An equality predicate for one optional filter field, or `undefined` when the
 * caller did not supply it.
 *
 * Extracted so `buildAuditWhere` stays a flat list of column/field pairings:
 * inlining one ternary per filter field grows the function's branch count with
 * every new filter, which is what pushed it past the complexity cap when
 * `resourceType` was added.
 */
function eqWhenSet(column: Readonly<Column>, value: string | undefined) {
  return value === undefined ? undefined : eq(column, value)
}

/**
 * A membership predicate for one optional list filter, or `undefined` when the
 * caller did not supply it. An EMPTY list is a predicate that matches nothing
 * (`1 = 0`) rather than an absent filter: a caller asking for "entries whose
 * severity is one of none" means none, and `IN ()` is not valid SQL.
 */
function sinceWhenSet(since: Readonly<Date> | undefined) {
  return since === undefined ? undefined : gte(auditLog.createdAt, since as Date)
}

/**
 * A membership predicate for one optional list filter — see {@link inWhenSet}.
 */
function inWhenSet(column: Readonly<Column>, values: readonly string[] | undefined) {
  if (values === undefined) return undefined
  return values.length === 0 ? sql`1 = 0` : inArray(column, [...values])
}

/**
 * Return entries matching the optional filter, newest first.
 *
 * Conjunctive filter semantics (every supplied field must match) match the
 * in-memory implementation that the audit-log route already consumes, so the
 * swap is transparent.
 */
/**
 * Build the conjunctive WHERE predicate for an audit-log filter, or `undefined`
 * when no filter field is set (the caller then selects without a `.where`). Each
 * supplied field (`actorId` / `action` / `transport` / `resourceType`) must match
 * (AND semantics).
 *
 * `resourceType` is an equality match on the indexed `resource_type` column, not
 * a prefix match: `form` must exclude the dotted compound `form.submission`.
 */
function buildAuditWhere(filter: AuditListFilter = {}) {
  const conditions = [
    eqWhenSet(auditLog.actorId, filter.actorId),
    eqWhenSet(auditLog.action, filter.action),
    eqWhenSet(auditLog.transport, filter.transport),
    eqWhenSet(auditLog.resourceType, filter.resourceType),
    eqWhenSet(auditLog.resourceId, filter.resourceId),
    inWhenSet(auditLog.severity, filter.severities),
    inWhenSet(auditLog.action, filter.actions),
    sinceWhenSet(filter.since),
  ].filter((c): c is NonNullable<typeof c> => c !== undefined)
  if (conditions.length === 0) return undefined
  return conditions.length === 1 ? conditions[0] : and(...conditions)
}

export async function listAuditEntriesFromDb(
  filter?: AuditListFilter
): Promise<readonly AuditLogEntry[]> {
  const where = buildAuditWhere(filter)

  try {
    const rows =
      where === undefined
        ? await db.select().from(auditLog).orderBy(desc(auditLog.createdAt))
        : await db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt))

    return rows.map((row) => rowToEntry(row as AuditLogRow))
  } catch (error) {
    // Same boot-path tolerance as the writer — return an empty list rather
    // than crash the read endpoint when the table is missing.
    logError('[audit-log] failed to read entries', error)
    return []
  }
}

/**
 * `true` when an entry of `action` about `resourceId` has been written since the
 * latest entry of `sinceAction` about the same resource — or at any time, when
 * there is no `sinceAction` entry to measure from.
 *
 * Two reads on the indexed `action` column, each stopping at one row. It is how
 * a recurring job records a condition once per episode rather than once per
 * run: the episode starts at `sinceAction` (a new one starts over), and any
 * `action` entry after it means this episode is already on the trail.
 *
 * A failed read answers `false`, so the caller records again: a duplicate entry
 * is the lesser fault next to a missing one.
 */
export async function hasAuditEntrySinceLatest(
  input: Readonly<{ action: string; sinceAction: string; resourceId: string }>
): Promise<boolean> {
  try {
    const anchor = await db
      .select({ at: auditLog.createdAt })
      .from(auditLog)
      .where(and(eq(auditLog.action, input.sinceAction), eq(auditLog.resourceId, input.resourceId)))
      .orderBy(desc(auditLog.createdAt))
      .limit(1)
    const since = anchor[0]?.at
    const found = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, input.action),
          eq(auditLog.resourceId, input.resourceId),
          since === undefined ? undefined : gte(auditLog.createdAt, since)
        )
      )
      .limit(1)
    return found.length > 0
  } catch (error) {
    logError('[audit-log] failed to look up an earlier entry', error, { action: input.action })
    return false
  }
}

/** One action's count, as {@link countAuditEntriesByAction} answers it. */
export interface AuditActionCount {
  readonly action: string
  readonly count: number
}

/**
 * Count the audit entries of `severities` created in `[since, until)`, grouped
 * by action, most first (ties by action name), at most `limit` — grouped in
 * the database, so a noisy week costs one row per action rather than one per
 * entry. Backs the weekly summary's error line.
 *
 * Same boot-path tolerance as the reader: a missing table answers `[]`.
 */
export async function countAuditEntriesByAction(input: {
  readonly since: Readonly<Date>
  readonly until: Readonly<Date>
  readonly severities: readonly string[]
  readonly limit: number
}): Promise<readonly AuditActionCount[]> {
  if (input.severities.length === 0) return []
  try {
    const total = sql<unknown>`count(*)`
    const rows = await db
      .select({ action: auditLog.action, count: total })
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.severity, [...input.severities]),
          gte(auditLog.createdAt, input.since as Date),
          lt(auditLog.createdAt, input.until as Date)
        )
      )
      .groupBy(auditLog.action)
      .orderBy(desc(total), asc(auditLog.action))
      .limit(input.limit)
    return rows.map((row) => ({ action: row.action, count: Number(row.count) || 0 }))
  } catch (error) {
    logError('[audit-log] failed to count entries by action', error)
    return []
  }
}
