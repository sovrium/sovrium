/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, inArray } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  BootLedgerDatabaseError,
  BootLedgerRepository,
  type BootLedgerEntry,
  type BootLedgerEntryWithSnapshot,
  type BootLedgerStats,
} from '@/application/ports/repositories/admin/boot-ledger-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { bootLedger as bootLedgerPg } from '@/infrastructure/database/drizzle/schema/boot-ledger'
import { bootLedger as bootLedgerSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/boot-ledger'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type {
  AdminReleaseEngineMigration,
  AdminReleaseSchemaChange,
} from '@/domain/models/api/admin/releases/ledger'

/**
 * Drizzle implementation of the boot-ledger port.
 *
 * The pg and sqlite table objects are resolved once at module init through
 * `resolveDialectSchema` — the PG variant emits `system.boot_ledger`, the
 * SQLite one the flat `system_boot_ledger`, and a repository pinned to either
 * fails outright on the other engine. SQLite is Sovrium's zero-config default,
 * so pinning to PG is the failure this project has already shipped once.
 *
 * Nothing here redacts. By the time a value reaches this file it has already
 * been through `redactSecretsForApp` at capture, which is the boundary A6
 * moved earlier precisely because this table persists.
 */
const bootLedger = resolveDialectSchema(bootLedgerPg, bootLedgerSqlite)

/** Wrap a DB promise, adapting failures to `BootLedgerDatabaseError`. */
const wrap = makeDbWrap((cause) => new BootLedgerDatabaseError({ cause }))

/** All zeroes — what a row whose `stats` column is unreadable degrades to. */
const ZERO_STATS: BootLedgerStats = {
  added: 0,
  removed: 0,
  tables: 0,
  fields: 0,
  automations: 0,
  agents: 0,
  links: 0,
}

/** Read one numeric member of a stored `stats` document, tolerating anything else. */
const statOf = (source: Readonly<Record<string, unknown>>, key: keyof BootLedgerStats): number => {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Project a stored `stats` document onto the seven counts.
 *
 * Field-by-field rather than a cast: the column is `jsonb` / `text json`, so
 * the database will hand back whatever was written, and a row from an older
 * build carrying six of the seven keys must read as a zero rather than as an
 * `undefined` that a `toFiniteCount` downstream would turn into `NaN`.
 */
const decodeStats = (value: unknown): BootLedgerStats => {
  if (typeof value !== 'object' || value === null) return ZERO_STATS
  const source = value as Readonly<Record<string, unknown>>
  return {
    added: statOf(source, 'added'),
    removed: statOf(source, 'removed'),
    tables: statOf(source, 'tables'),
    fields: statOf(source, 'fields'),
    automations: statOf(source, 'automations'),
    agents: statOf(source, 'agents'),
    links: statOf(source, 'links'),
  }
}

/** A stored JSON array column, or an empty list when the column holds anything else. */
const decodeArray = <T>(value: unknown): readonly T[] =>
  Array.isArray(value) ? (value as T[]) : []

/** A stored JSON object column, or an empty object. */
const decodeObject = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** An optional text column: `null` and `''` alike become `undefined`. */
const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/**
 * A stored timestamp, on either dialect.
 *
 * Postgres hands back a `Date`; the SQLite mirror's `timestamp_ms` mode does
 * too. A raw number is accepted anyway so a row written by a driver that did
 * not apply the mode still reads rather than becoming an Invalid Date that
 * serialises as `null` and silently reorders the timeline.
 */
const decodeInstant = (value: unknown): Readonly<Date> =>
  value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value))

/** Project a raw row onto the port's record shape, snapshot excluded. */
const decodeRow = (row: Readonly<Record<string, unknown>>): BootLedgerEntry => ({
  id: String(row['id']),
  appVersion: optionalText(row['appVersion']),
  engineVersion: String(row['engineVersion'] ?? ''),
  prevEngineVersion: optionalText(row['prevEngineVersion']),
  configHash: String(row['configHash'] ?? ''),
  prevConfigHash: optionalText(row['prevConfigHash']),
  bootedAt: decodeInstant(row['bootedAt']),
  bootedBy: optionalText(row['bootedBy']),
  summary: String(row['summary'] ?? ''),
  stats: decodeStats(row['stats']),
  engineMigrations: decodeArray<AdminReleaseEngineMigration>(row['engineMigrations']),
  derivedDdl: decodeArray<AdminReleaseSchemaChange>(row['derivedDdl']),
})

/** The same projection, plus the snapshot a diff is computed from. */
const decodeRowWithSnapshot = (
  row: Readonly<Record<string, unknown>>
): BootLedgerEntryWithSnapshot => ({
  ...decodeRow(row),
  snapshot: decodeObject(row['snapshot']),
})

/** The newest single row matching a condition, with its snapshot. */
const newestWhere = (
  // drizzle's `SQL` is a class carrying its own methods; `Readonly<SQL>` drops them and
  // the query builder then refuses the value outright.
  // eslint-disable-next-line functional/prefer-immutable-types -- third-party mutable type
  condition: ReturnType<typeof and>
): Effect.Effect<BootLedgerEntryWithSnapshot | undefined, BootLedgerDatabaseError> =>
  wrap(() =>
    db.select().from(bootLedger).where(condition).orderBy(desc(bootLedger.bootedAt)).limit(1)
  ).pipe(
    Effect.map((rows) =>
      rows[0] === undefined ? undefined : decodeRowWithSnapshot(rows[0] as Record<string, unknown>)
    )
  )

export const BootLedgerRepositoryLive = Layer.succeed(BootLedgerRepository, {
  latest: (appName: string) => newestWhere(eq(bootLedger.appName, appName)),

  listNewestFirst: (appName: string) =>
    wrap(() =>
      db
        .select({
          id: bootLedger.id,
          appVersion: bootLedger.appVersion,
          engineVersion: bootLedger.engineVersion,
          prevEngineVersion: bootLedger.prevEngineVersion,
          configHash: bootLedger.configHash,
          prevConfigHash: bootLedger.prevConfigHash,
          bootedAt: bootLedger.bootedAt,
          bootedBy: bootLedger.bootedBy,
          summary: bootLedger.summary,
          stats: bootLedger.stats,
          engineMigrations: bootLedger.engineMigrations,
          derivedDdl: bootLedger.derivedDdl,
        })
        // The snapshot is deliberately absent from the projection: it is the
        // largest column by an order of magnitude and no list field derives
        // from it. Selecting it here would move the whole configuration once
        // per retained row to render a table of dates.
        .from(bootLedger)
        .where(eq(bootLedger.appName, appName))
        .orderBy(desc(bootLedger.bootedAt))
    ).pipe(Effect.map((rows) => rows.map((row) => decodeRow(row as Record<string, unknown>)))),

  findByAddress: (appName: string, address: string) =>
    // By HASH first, and by `id` only when that misses. A hash is the address
    // the console links and an operator reads off a diff, so it wins the tie;
    // the two spaces cannot collide in practice (twelve hex characters against
    // a UUID) and the order is what makes a repeated hash resolve to its
    // newest row rather than to whichever twin an id scan reached first.
    newestWhere(and(eq(bootLedger.appName, appName), eq(bootLedger.configHash, address))).pipe(
      Effect.flatMap((byHash) =>
        byHash === undefined
          ? newestWhere(and(eq(bootLedger.appName, appName), eq(bootLedger.id, address)))
          : Effect.succeed(byHash)
      )
    ),

  findPredecessor: (appName: string, bootedAt: Readonly<Date>) =>
    wrap(() =>
      db
        .select()
        .from(bootLedger)
        .where(eq(bootLedger.appName, appName))
        .orderBy(desc(bootLedger.bootedAt))
    ).pipe(
      Effect.map((rows) => {
        // Filtered in memory rather than with a `lt(bootedAt)` predicate: the
        // two dialects store the column as `timestamptz` and as milliseconds,
        // and a `Date` bound compared across that boundary is exactly the kind
        // of off-by-one-engine defect that shows as an empty diff on SQLite
        // only. The row count is bounded by retention.
        const earlier = rows.find(
          (row) => decodeInstant((row as Record<string, unknown>)['bootedAt']) < bootedAt
        )
        return earlier === undefined
          ? undefined
          : decodeRowWithSnapshot(earlier as Record<string, unknown>)
      })
    ),

  insert: (entry) =>
    wrap(async () => {
      // eslint-disable-next-line functional/no-expression-statements
      await db.insert(bootLedger).values({
        appName: entry.appName,
        ...(entry.appVersion === undefined ? {} : { appVersion: entry.appVersion }),
        engineVersion: entry.engineVersion,
        ...(entry.prevEngineVersion === undefined
          ? {}
          : { prevEngineVersion: entry.prevEngineVersion }),
        configHash: entry.configHash,
        ...(entry.prevConfigHash === undefined ? {} : { prevConfigHash: entry.prevConfigHash }),
        ...(entry.bootedBy === undefined ? {} : { bootedBy: entry.bootedBy }),
        bootedAt: entry.bootedAt,
        summary: entry.summary,
        stats: entry.stats,
        engineMigrations: entry.engineMigrations,
        derivedDdl: entry.derivedDdl,
        snapshot: entry.snapshot,
      })
    }),

  prune: (appName: string, keep: number) =>
    wrap(async () => {
      const rows = await db
        .select({ id: bootLedger.id })
        .from(bootLedger)
        .where(eq(bootLedger.appName, appName))
        .orderBy(desc(bootLedger.bootedAt))
      const doomed = rows.slice(keep).map((row) => String(row.id))
      if (doomed.length === 0) return
      // eslint-disable-next-line functional/no-expression-statements
      await db.delete(bootLedger).where(inArray(bootLedger.id, doomed))
    }),
})
