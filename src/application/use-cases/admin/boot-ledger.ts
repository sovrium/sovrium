/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two reads behind `GET /api/admin/releases` and
 * `GET /api/admin/releases/:hash` ([internal ref] amendment A6, surface 8).
 *
 * Both are projections of `system.boot_ledger` and nothing else. Neither writes:
 * the row is put there by the boot path, and there is no HTTP verb anywhere that
 * creates, edits or deletes one.
 *
 * ─── NO SNAPSHOT IS SERVED ──────────────────────────────────────────────────
 *
 * The detail read loads two snapshots and returns neither. They exist to be
 * DIFFED — `GET /api/admin/config/schema` is where A1 put the reflection, A6
 * re-homed its page rather than its endpoint, and a second serialisation of the
 * whole configuration on a second route would be a second place to leak.
 *
 * ─── EVERY COUNT IS DERIVED FROM THE ROWS IT SUMMARISES ─────────────────────
 *
 * The list's four totals are reduced out of the list it returns, never carried
 * beside it, so the two cannot disagree. A ledger of three whose total reads
 * four is the kind of defect that survives a 200 and is noticed months later by
 * an operator who no longer trusts the page.
 */

import { Effect } from 'effect'
import {
  BootLedgerRepository,
  type BootLedgerDatabaseError,
  type BootLedgerEntry,
} from '@/application/ports/repositories/admin/boot-ledger-repository'
import { diffSnapshots } from '@/application/use-cases/admin/boot-ledger-diff'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import type {
  AdminReleaseDetailResponse,
  AdminReleasesListResponse,
  AdminReleaseSummary,
} from '@/domain/models/api/admin/releases/ledger'

/** An absent optional string, in the shape the wire contract declares for it. */
// eslint-disable-next-line unicorn/no-null -- the contract is `Schema.NullOr`; `undefined` would drop the key and break a `$record.` binding that expects it present.
const orNull = (value: string | undefined): string | null => value ?? null

/** The scalars every row publishes, shared by both reads. */
const scalarsOf = (
  entry: BootLedgerEntry,
  current: boolean
): Omit<AdminReleaseSummary, 'engineMigrationCount' | 'schemaChangeCount'> => ({
  id: entry.id,
  version: orNull(entry.appVersion),
  engineVersion: entry.engineVersion,
  previousEngineVersion: orNull(entry.prevEngineVersion),
  configHash: entry.configHash,
  previousConfigHash: orNull(entry.prevConfigHash),
  bootedAt: entry.bootedAt.toISOString(),
  bootedBy: orNull(entry.bootedBy),
  current,
  summary: entry.summary,
  added: toFiniteCount(entry.stats.added),
  removed: toFiniteCount(entry.stats.removed),
  tables: toFiniteCount(entry.stats.tables),
  fields: toFiniteCount(entry.stats.fields),
  automations: toFiniteCount(entry.stats.automations),
  agents: toFiniteCount(entry.stats.agents),
  links: toFiniteCount(entry.stats.links),
})

/**
 * Every retained boot, newest first.
 *
 * A timeline is read from the top and the row an operator wants is almost always
 * the last one. Exactly one row is marked `current` — the newest — and it is
 * computed here rather than stored, because a later boot changes the answer and
 * a stored flag would need a second write to keep true.
 *
 * An instance whose ledger has been pruned to nothing answers 200 with an empty
 * list and zeroes, never 404: a 404-when-empty is indistinguishable from a route
 * that was never mounted, and the console draws its empty state from the 200.
 */
export const listBootLedger = (
  appName: string
): Effect.Effect<AdminReleasesListResponse, BootLedgerDatabaseError, BootLedgerRepository> =>
  Effect.gen(function* () {
    const ledger = yield* BootLedgerRepository
    const entries = yield* ledger.listNewestFirst(appName)

    const releases = entries.map((entry, index) => ({
      ...scalarsOf(entry, index === 0),
      engineMigrationCount: entry.engineMigrations.length,
      schemaChangeCount: entry.derivedDdl.length,
    }))

    const newest = releases[0]
    const oldest = releases[releases.length - 1]

    return {
      releases,
      total: releases.length,
      // The beginning of what this ledger can still answer for — which is not
      // necessarily the instance's first boot, once pruning has run.
      // eslint-disable-next-line unicorn/no-null -- `Schema.NullOr`; `undefined` would drop the key the console binds.
      since: oldest?.bootedAt ?? null,
      engineMigrations: releases.reduce((sum, release) => sum + release.engineMigrationCount, 0),
      schemaChanges: releases.reduce((sum, release) => sum + release.schemaChangeCount, 0),
      // eslint-disable-next-line unicorn/no-null -- `Schema.NullOr`, as above.
      currentVersion: newest?.version ?? null,
      // eslint-disable-next-line unicorn/no-null -- `Schema.NullOr`, as above.
      currentHash: newest?.configHash ?? null,
      // Per-request, because it timestamps the READ rather than any boot.
      generatedAt: new Date().toISOString(),
    }
  }).pipe(Effect.withSpan('admin.list-boot-ledger'))

/**
 * One boot, with its diff against the boot before it.
 *
 * `address` is either a twelve-hex config hash or a row id, and anything that
 * resolves to neither yields `undefined` — which the handler answers **404** to,
 * never 400. To a caller an unknown hash is indistinguishable from one belonging
 * to another instance, and a 400 would tell an anonymous prober the shape was
 * right.
 *
 * ─── THE BASELINE ROW'S DIFF IS EMPTY, AND THAT IS THE BOUND ────────────────
 *
 * A6: both sides of any diff are boots that happened. The first row has no other
 * side, so it returns `diff: []` and `previousConfigHash: null` — NOT the whole
 * configuration rendered as `+` lines, which would be a diff against an empty
 * configuration that never booted anywhere. If a future change makes that
 * assertion fail by producing additions, the change has left the authorisation.
 *
 * A row whose predecessor RETENTION removed is a third case and says so:
 * `previousConfigHash` is present, `previousUnavailable` is true, and the diff
 * is empty because its other side is gone — stated rather than fabricated.
 */
export const readBootLedgerEntry = (
  appName: string,
  address: string
): Effect.Effect<
  AdminReleaseDetailResponse | undefined,
  BootLedgerDatabaseError,
  BootLedgerRepository
> =>
  Effect.gen(function* () {
    const ledger = yield* BootLedgerRepository
    const entry = yield* ledger.findByAddress(appName, address)
    if (entry === undefined) return undefined

    const newest = yield* ledger.latest(appName)
    const predecessor = yield* ledger.findPredecessor(appName, entry.bootedAt)

    // Three cases, and they are genuinely different: no predecessor because
    // this is the first boot (`prevConfigHash` absent), no predecessor because
    // retention removed it (`prevConfigHash` present), and a predecessor to
    // diff against.
    const pruned = predecessor === undefined && entry.prevConfigHash !== undefined
    const diff = diffSnapshots(predecessor?.snapshot, entry.snapshot)

    return {
      ...scalarsOf(entry, newest?.id === entry.id),
      // eslint-disable-next-line unicorn/no-null -- `Schema.NullOr`; null is "there was no previous boot", which is not the same as an absent key.
      previousBootedAt: predecessor?.bootedAt.toISOString() ?? null,
      engineMigrations: entry.engineMigrations,
      schemaChanges: entry.derivedDdl,
      diff,
      ...(pruned ? { previousUnavailable: true } : {}),
      generatedAt: new Date().toISOString(),
    }
  }).pipe(Effect.withSpan('admin.read-boot-ledger-entry'))
