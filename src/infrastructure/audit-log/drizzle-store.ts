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

import { eq, and, desc, sql, type Column } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { auditLog } from '@/infrastructure/database/drizzle/schema/audit-log'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import { logError } from '@/infrastructure/logging/logger'
import type { ActorRole, ActorType } from '@/domain/models/api/admin/_shared/actor'
import type { Severity } from '@/domain/models/api/admin/_shared/severity'
import type {
  AuditLogEntry,
  AuditResult,
  AuditTransport,
} from '@/domain/models/api/admin/audit-log/entry'
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
function buildAuditWhere(filter?: AuditListFilter) {
  const conditions = [
    eqWhenSet(auditLog.actorId, filter?.actorId),
    eqWhenSet(auditLog.action, filter?.action),
    eqWhenSet(auditLog.transport, filter?.transport),
    eqWhenSet(auditLog.resourceType, filter?.resourceType),
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
 * Reset (truncate) the DB-backed `audit_log` table.
 *
 * Called at server boot from `createApiRoutes` so each E2E spec sees a clean
 * log even when the spawned-server process is reused. Best-effort — boot paths
 * that run before migration 0006 applies will skip silently.
 */
export async function clearAuditLogTable(): Promise<void> {
  try {
    // Intentional unconditional truncate — every E2E spec wants a clean
    // slate at boot. The `.where(sql\`true\`)` satisfies the drizzle/
    // enforce-delete-with-where lint guard (which protects against
    // accidental whole-table deletes by requiring an explicit predicate).
    // eslint-disable-next-line functional/no-expression-statements -- DB side effect
    await db.delete(auditLog).where(sql`true`)
  } catch (error) {
    // The `audit_log` table is absent on boot paths that run before migration
    // 0006 applies (CLI `schema`/`validate` subcommands, app configs whose
    // database has not been migrated to the canonical event store). PostgreSQL
    // reports this as `42P01` (undefined_table) and SQLite as a "no such table"
    // message. That case is expected and benign — skip silently so it does not
    // spam the server log on every E2E spec boot. Any *other* failure is a real
    // problem and is still surfaced.
    if (isMissingTableError(error)) return
    logError('[audit-log] failed to clear table', error)
  }
}

/**
 * Detect the "audit_log table does not exist yet" error across both dialects.
 *
 * - PostgreSQL: the bun-sql driver surfaces a `PostgresError` whose `errno` /
 *   `code` is `42P01` (undefined_table). drizzle wraps it, so the original is
 *   reachable via `error.cause`.
 * - SQLite: `bun:sqlite` / `node:sqlite` throw an `Error` whose message
 *   contains `no such table`.
 */
function isMissingTableError(error: unknown): boolean {
  const pgErrno = (error as { cause?: { errno?: unknown } } | undefined)?.cause?.errno
  if (pgErrno === '42P01') return true
  const message = error instanceof Error ? error.message : String(error)
  return /no such table/i.test(message) || /relation .* does not exist/i.test(message)
}
