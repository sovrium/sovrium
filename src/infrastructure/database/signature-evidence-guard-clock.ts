/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The clock the signing chain's delete guard reads, kept on the server's
 * development timeline (`SOVRIUM_DEV_CLOCK`).
 *
 * The guard (`signature_evidence_guard_delete`, created by the migration that
 * adds the evidence tables) admits the delete of a chain row only once its
 * request's `keep_until` is before the database's own clock. The retention
 * sweep reads the ENGINE clock, which a pinned development clock moves; the
 * database's clock it cannot reach. So on a pinned boot the guard is
 * rewritten to read the same timeline the engine reads, the pinned instant
 * plus the real time elapsed since the boot (`devTimelineInstant`), and it
 * carries {@link GUARD_PINNED_MARKER}; a later boot without the pin finds the
 * marker and puts the database's own clock back. An unpinned boot that finds
 * no marker changes nothing.
 *
 * Production cannot reach the rewrite: a development clock is refused when
 * `NODE_ENV=production` or the public origin is not loopback
 * (`readSovriumDevClock`), and the guard then reads the database's clock as
 * the migration wrote it.
 *
 * The marker deliberately does not spell the formula triggers' own marker
 * (`DEV_CLOCK_MARKER`), whose presence makes the schema fast path rebuild
 * every formula trigger.
 */

import { sql } from 'drizzle-orm'
import { readSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import { readServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'

/** What a guard rewritten on a pinned clock carries. */
export const GUARD_PINNED_MARKER = 'signature-guard-pinned-timeline'

const GUARD_NAME = 'signature_evidence_guard_delete'

/** The pinned instant and the boot it counts from, or `undefined` on the real clock. */
export interface PinnedTimeline {
  readonly pinnedMs: number
  readonly bootedMs: number
}

/** The timeline this boot runs on. */
export const currentTimeline = (): PinnedTimeline | undefined => {
  const pinned = readSovriumDevClock(process.env)
  return pinned === undefined
    ? undefined
    : { pinnedMs: pinned.getTime(), bootedMs: readServerBootInstant().getTime() }
}

/** The SQLite expression for "now", in epoch milliseconds, on `timeline`. */
const sqliteNow = (timeline: PinnedTimeline | undefined): string => {
  const real = `CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`
  return timeline === undefined
    ? real
    : `(${String(Math.trunc(timeline.pinnedMs))} + ${real} - ${String(Math.trunc(timeline.bootedMs))})`
}

/** The PostgreSQL expression for "now", on `timeline`. */
const postgresNow = (timeline: PinnedTimeline | undefined): string =>
  timeline === undefined
    ? 'now()'
    : `(TIMESTAMPTZ '${new Date(timeline.pinnedMs).toISOString()}' + (now() - TIMESTAMPTZ '${new Date(timeline.bootedMs).toISOString()}'))`

/** The marker line a pinned guard carries, nothing on the real clock. */
const markerOf = (timeline: PinnedTimeline | undefined): string =>
  timeline === undefined ? '' : `  -- ${GUARD_PINNED_MARKER}\n`

/** The body of the PostgreSQL guard function, reading `timeline`. */
export const postgresGuardBody = (timeline: PinnedTimeline | undefined): string => `
BEGIN
${markerOf(timeline)}  IF NOT EXISTS (
    SELECT 1 FROM "system"."signature_requests" AS r
    WHERE r."id" = OLD."request_id" AND r."keep_until" IS NOT NULL AND r."keep_until" < ${postgresNow(timeline)}
  ) THEN
    RAISE EXCEPTION 'signature evidence is kept until its keep date: refused delete from system.signature_evidence %', OLD."id" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
`

/** The SQLite guard trigger, reading `timeline`. */
export const sqliteGuardTrigger = (timeline: PinnedTimeline | undefined): string =>
  `CREATE TRIGGER \`${GUARD_NAME}\` BEFORE DELETE ON \`system_signature_evidence\`
WHEN NOT EXISTS (
${markerOf(timeline)}  SELECT 1 FROM \`system_signature_requests\` AS r
  WHERE r.\`id\` = OLD.\`request_id\` AND r.\`keep_until\` IS NOT NULL
    AND r.\`keep_until\` < ${sqliteNow(timeline)}
)
BEGIN
  SELECT RAISE(ABORT, 'signature evidence is kept until its keep date: refused delete from system_signature_evidence');
END`

/** The guard's current definition, or `undefined` when the database has none. */
const currentDefinition = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect
): Promise<string | undefined> => {
  const rows = await executeRawTypedOn<{ readonly definition: unknown }>(
    dialect.kind,
    runner,
    dialect.kind === 'sqlite'
      ? sql`SELECT sql AS definition FROM sqlite_master WHERE type = 'trigger' AND name = ${GUARD_NAME}`
      : sql`SELECT p.prosrc AS definition FROM pg_proc AS p
            JOIN pg_namespace AS n ON n.oid = p.pronamespace
            WHERE n.nspname = 'system' AND p.proname = ${GUARD_NAME}`
  )
  const definition = rows[0]?.definition
  return typeof definition === 'string' ? definition : undefined
}

/** Replace the guard with one that reads `timeline`. */
const rewriteGuard = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  timeline: PinnedTimeline | undefined
): Promise<void> => {
  if (dialect.kind === 'sqlite') {
    // sql-literal: ddl -- a module-constant trigger name
    await executeRawOn(dialect.kind, runner, sql.raw(`DROP TRIGGER IF EXISTS \`${GUARD_NAME}\``))
    // sql-literal: ddl -- the guard's own text, its clock built from two numbers the engine read
    await executeRawOn(dialect.kind, runner, sql.raw(sqliteGuardTrigger(timeline)))
    return
  }
  await executeRawOn(
    dialect.kind,
    runner,
    // sql-literal: ddl -- the guard's own text, its clock built from two instants the engine read
    sql.raw(
      `CREATE OR REPLACE FUNCTION "system"."${GUARD_NAME}"() RETURNS trigger LANGUAGE plpgsql AS $guard$${postgresGuardBody(timeline)}$guard$`
    )
  )
}

/**
 * Put the guard on the timeline this boot runs on: rewritten on a pinned
 * boot, restored on an unpinned boot that finds a pinned guard, untouched
 * otherwise (and on a database without the evidence tables). Resolves to
 * whether it rewrote the guard.
 */
export const alignSignatureEvidenceGuardClock = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  timeline: PinnedTimeline | undefined = currentTimeline()
): Promise<boolean> => {
  const definition = await currentDefinition(runner, dialect)
  if (definition === undefined) return false
  if (timeline === undefined && !definition.includes(GUARD_PINNED_MARKER)) return false
  await rewriteGuard(runner, dialect, timeline)
  return true
}
