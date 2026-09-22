/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type {
  AdminReleaseEngineMigration,
  AdminReleaseSchemaChange,
} from '@/domain/models/api/admin/releases/ledger'

/** Database error for boot-ledger operations. */
export class BootLedgerDatabaseError extends Data.TaggedError('BootLedgerDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * The seven counts a row carries, derived once at capture from the diff against
 * the previous row.
 *
 * `added` / `removed` are DIFF LINES; the other five are objects the boot
 * introduced. All seven are zero on the baseline row, which has no predecessor
 * to be counted against — A6's "both sides of any diff are boots that happened"
 * applies to a count exactly as it applies to a line.
 */
export interface BootLedgerStats {
  readonly added: number
  readonly removed: number
  readonly tables: number
  readonly fields: number
  readonly automations: number
  readonly agents: number
  readonly links: number
}

/**
 * One ledger row as the application layer sees it, WITHOUT the snapshot.
 *
 * The list read never needs a snapshot and must never pay for one: a row is
 * roughly the size of the configuration that booted, so selecting the column
 * for a two-hundred-row timeline would move tens of megabytes to render a
 * table of dates. The detail read does not carry it either — it is stored to
 * be diffed against, not to be served.
 */
export interface BootLedgerEntry {
  readonly id: string
  readonly appVersion: string | undefined
  readonly engineVersion: string
  readonly prevEngineVersion: string | undefined
  readonly configHash: string
  readonly prevConfigHash: string | undefined
  readonly bootedAt: Date
  readonly bootedBy: string | undefined
  readonly summary: string
  readonly stats: BootLedgerStats
  readonly engineMigrations: readonly AdminReleaseEngineMigration[]
  readonly derivedDdl: readonly AdminReleaseSchemaChange[]
}

/** A row plus the redacted snapshot it stored — what a diff needs, and only a diff. */
export interface BootLedgerEntryWithSnapshot extends BootLedgerEntry {
  readonly snapshot: Readonly<Record<string, unknown>>
}

/** Everything the capture writes. Already redacted by the time it gets here. */
export interface NewBootLedgerEntry {
  readonly appName: string
  readonly appVersion: string | undefined
  readonly engineVersion: string
  readonly prevEngineVersion: string | undefined
  readonly configHash: string
  readonly prevConfigHash: string | undefined
  /**
   * Stamped by the capture rather than defaulted by the database, so that the
   * row's own time and the `appliedAt` on every derived DDL entry it carries
   * are the SAME instant. Two clocks a few microseconds apart would make a
   * statement look as though it ran before the boot that derived it.
   */
  readonly bootedAt: Date
  readonly bootedBy: string | undefined
  readonly summary: string
  readonly stats: BootLedgerStats
  readonly engineMigrations: readonly AdminReleaseEngineMigration[]
  readonly derivedDdl: readonly AdminReleaseSchemaChange[]
  readonly snapshot: Readonly<Record<string, unknown>>
}

/**
 * `system.boot_ledger` port — one write, on the boot path, and three reads.
 *
 * There is no update and no delete beyond {@link BootLedgerRepository.prune},
 * and that is the surface's whole shape: A6 authorises two `GET`s, the row is
 * an effect of a boot, and nothing above this line can edit one. A `revoke`
 * or `restore` here would be the config-mutation transport A6 refuses, with a
 * table for a front door.
 *
 * ─── A HASH IS AN ADDRESS, NOT AN IDENTITY ──────────────────────────────────
 *
 * {@link BootLedgerRepository.findByAddress} takes either. A → B → A is a
 * legitimate sequence of three boots in which two rows carry the same config
 * hash, so a hash resolves to the NEWEST row bearing it while `id` resolves any
 * row exactly — git's ref-or-sha shape, failing in the direction an operator
 * recovers from.
 */
export class BootLedgerRepository extends Context.Service<
  BootLedgerRepository,
  {
    /**
     * The newest row for this app, WITH its snapshot — the one thing the
     * capture reads, and the only ledger read on the boot path.
     */
    readonly latest: (
      appName: string
    ) => Effect.Effect<BootLedgerEntryWithSnapshot | undefined, BootLedgerDatabaseError>

    /** Every retained row for this app, newest boot first. */
    readonly listNewestFirst: (
      appName: string
    ) => Effect.Effect<readonly BootLedgerEntry[], BootLedgerDatabaseError>

    /**
     * The row this address names: the newest row whose `config_hash` matches,
     * or the row whose `id` matches. `undefined` for anything else — which the
     * handler answers 404 to, never 400.
     */
    readonly findByAddress: (
      appName: string,
      address: string
    ) => Effect.Effect<BootLedgerEntryWithSnapshot | undefined, BootLedgerDatabaseError>

    /**
     * The row immediately before `bootedAt` for this app — the OTHER SIDE of
     * the diff, and itself a boot that happened.
     *
     * Resolved by position rather than by `prev_config_hash`, because a hash is
     * not an identity: after a revert two rows share one, and a lookup by hash
     * would answer with whichever of them the index reached first.
     */
    readonly findPredecessor: (
      appName: string,
      bootedAt: Date
    ) => Effect.Effect<BootLedgerEntryWithSnapshot | undefined, BootLedgerDatabaseError>

    /** Append one row. The only write this surface has. */
    readonly insert: (entry: NewBootLedgerEntry) => Effect.Effect<void, BootLedgerDatabaseError>

    /**
     * Keep the `keep` most recent rows for this app and delete the rest.
     *
     * A delete, which D1 authorises as data CRUD and A6 left explicitly to the
     * schema owners. Pruning the oldest row leaves the next-oldest pointing at
     * a `prev_config_hash` that no longer resolves; the detail read states that
     * (`previousUnavailable`) rather than fabricating a diff or answering 500.
     */
    readonly prune: (appName: string, keep: number) => Effect.Effect<void, BootLedgerDatabaseError>
  }
>()('BootLedgerRepository') {}
