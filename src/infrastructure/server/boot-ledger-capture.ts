/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The boot ledger's WRITE — one row per server start whose app version or
 * config hash differs from the row before it ([internal ref] amendment A6, surface 8).
 *
 * This is the only thing in the console that writes because of its own
 * operation, and A6 states the bound that makes it admissible: **the row is an
 * effect of a boot, never a cause of one.** It is written after the instance has
 * already decided what it runs, from what it already ran. Nothing in the ledger
 * is read by the boot path other than the previous row — read to compute a diff,
 * never to influence what starts. A row a future boot consulted would be a
 * config-mutation transport with a table for a front door.
 *
 * ─── THE ORDERING IS LOAD-BEARING ───────────────────────────────────────────
 *
 * Read the newest row → build the whole payload → redact it → hash the redacted
 * snapshot → compare → insert, or do nothing. Two of those steps are easy to
 * swap and both swaps are defects:
 *
 *   - **Redact before you hash.** The hash is over the REDACTED snapshot, which
 *     is what makes "the hash changed" and "the snapshot differs" the same
 *     statement. Hash the raw config instead and a rotated hardcoded credential
 *     writes a row whose diff is empty — a change that never happened, recorded
 *     forever — while reformatting `app.ts` does the same.
 *   - **Redact before you diff.** The stored side is already redacted. Diffing a
 *     raw configuration against it reports `***` → literal as a change on every
 *     single boot, and carries the literal into the diff on the way out.
 *
 * ─── AND THE REDACTOR RUNS OVER THE WHOLE ROW ───────────────────────────────
 *
 * A1's condition — a config-reflection surface that leaks a secret is an
 * unauthorised surface, not a defective one — with A6's boundary moved earlier
 * because this table PERSISTS. A row redacted on the way out is a plaintext
 * credential at rest, reachable by every backup, every restore, every ad-hoc
 * query and the `MCP_EXPOSE_INTERNALS` reader.
 *
 * So the payload goes through `redactSecretsForApp` — A1's redactor, never a
 * sibling, because a second serializer is a second place to leak — TWICE, and
 * the second pass is not belt-and-braces. The snapshot is scrubbed first so the
 * diff has two comparable sides; the assembled row is scrubbed again because
 * the derived DDL is generated from the REAL `app.tables`, and a `DEFAULT`
 * clause derived from configuration carries a configuration value into the SQL
 * with it. Same function, idempotent, and the second call is the one that
 * covers everything A6 says the cover extends to.
 */

import { Effect } from 'effect'
import {
  BootLedgerRepository,
  type BootLedgerEntryWithSnapshot,
  type BootLedgerStats,
  type NewBootLedgerEntry,
} from '@/application/ports/repositories/admin/boot-ledger-repository'
import {
  canonicalJson,
  deriveStats,
  diffSnapshots,
  summariseDiff,
  type Snapshot,
} from '@/application/use-cases/admin/boot-ledger-diff'
import { redactSecretsForApp } from '@/application/use-cases/automations/redact-secrets'
import { readAppliedMigrations } from '@/infrastructure/database/drizzle/applied-migrations'
import {
  resolveMigrationsFolder,
  shippedMigrations,
} from '@/infrastructure/database/drizzle/migration-folder'
import {
  deriveConfigDdl,
  type PriorTable,
} from '@/infrastructure/database/schema/derived-config-ddl'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { computeConfigHash } from '@/infrastructure/server/lock-file'
import type { AdminReleaseEngineMigration } from '@/domain/models/api/admin/releases/ledger'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/**
 * How many rows one app's ledger retains.
 *
 * A row is written only on a CHANGE, so two hundred is many years for a settled
 * app and a couple of months for one under active development — the shape of the
 * curve that matters. A count bound rather than an age bound, deliberately: an
 * age bound empties the ledger of a dormant instance, and a dormant instance is
 * precisely the one whose operator has forgotten what it runs. It would also
 * delete the baseline row first, which is the single most valuable one.
 *
 * The cost it buys off is size: a row is roughly the size of the configuration,
 * so two hundred boots of a 100 KB config is about 20 MB on one table.
 *
 * A6 left retention to the schema owners by name, pruning being a delete and so
 * data CRUD. This is the story's proposed default, and the founder question it
 * carries is whether to prune at all.
 */
const RETAINED_ROWS = 200

/** The `App` reduced to a plain JSON document — no functions, no `undefined`. */
const plainSnapshot = (app: App): Snapshot =>
  JSON.parse(JSON.stringify(app)) as Record<string, unknown>

/**
 * How the process started — never who started it.
 *
 * The engine holds no operator identity at boot: there is no session, no
 * credential and no name to attribute a deploy to, and inventing one would be
 * the more precise-looking lie. The honest half is the command, so a bare
 * lowercase word in the verb position is reported as the verb it is and
 * anything else — a config path, a flag, an absent argument, a library boot —
 * reads `embedded`.
 */
export const resolveBootedBy = (argv: readonly string[]): string => {
  const candidate = argv[2]
  return typeof candidate === 'string' && /^[a-z][a-z0-9-]*$/.test(candidate)
    ? `sovrium ${candidate}`
    : 'embedded'
}

/** The `tables` of a stored snapshot, as much of them as the DDL derivation reads. */
const priorTables = (snapshot: Snapshot | undefined): readonly PriorTable[] | undefined => {
  if (snapshot === undefined) return undefined
  const list = snapshot['tables']
  if (!Array.isArray(list)) return []
  return list.flatMap((entry): readonly PriorTable[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const source = entry as Readonly<Record<string, unknown>>
    const { name } = source
    if (typeof name !== 'string') return []
    const fields = Array.isArray(source['fields'])
      ? source['fields'].flatMap((field: unknown) => {
          if (typeof field !== 'object' || field === null) return []
          const fieldName = (field as Readonly<Record<string, unknown>>)['name']
          return typeof fieldName === 'string' ? [{ name: fieldName }] : []
        })
      : []
    return [{ name, fields }]
  })
}

/**
 * The engine migrations applied SINCE a given instant — or every migration the
 * database records, when there is no instant because there is no previous row.
 *
 * "Since the previous row" is deliberately wider than "at this boot", and the
 * gap it closes is reachable: a boot that upgrades the engine without touching
 * the configuration changes neither the version nor the hash, so under A6 it
 * writes no row while applying real migrations. Attributing them to the next row
 * that IS written keeps the ledger complete. On an ordinary boot the two
 * readings coincide.
 *
 * A recorded migration this build does not ship is DROPPED rather than reported
 * with a statement count of zero. That is a downgrade or a fork — a different
 * finding, which this reader is not entitled to make, and a zero would read as
 * "a migration that did nothing".
 */
const engineMigrationsSince = (
  dialect: DatabaseDialectConfig['dialect'],
  since: Readonly<Date> | undefined
): Effect.Effect<readonly AdminReleaseEngineMigration[], never> =>
  Effect.gen(function* () {
    const folder = yield* resolveMigrationsFolder(dialect === 'sqlite' ? 'sqlite' : 'pg')
    const shipped = new Map(
      shippedMigrations(folder).map((entry) => [entry.name, entry.statements] as const)
    )
    const applied = yield* readAppliedMigrations

    return applied
      .filter((entry) => since === undefined || entry.appliedAt > since)
      .flatMap((entry): readonly AdminReleaseEngineMigration[] => {
        const statements = shipped.get(entry.name)
        return statements === undefined
          ? []
          : [{ folder: entry.name, appliedAt: entry.appliedAt.toISOString(), statements }]
      })
      .toSorted((left, right) =>
        left.appliedAt === right.appliedAt
          ? left.folder.localeCompare(right.folder)
          : left.appliedAt.localeCompare(right.appliedAt)
      )
  }).pipe(
    // An unreadable migrations folder must not cost the ledger its row. The
    // rest of the capture is a function of the two configurations and is still
    // entirely true; a row naming no migrations is a smaller loss than no row.
    Effect.tapCause((cause) =>
      Effect.logWarning(`[boot-ledger] engine migrations unavailable: ${String(cause)}`)
    ),
    // effect-swallow: see the tap above — this column is observability about
    // observability, and its absence is reported rather than propagated.
    Effect.orElseSucceed(() => [])
  )

interface LedgerRowInput {
  readonly app: App
  readonly previous: BootLedgerEntryWithSnapshot | undefined
  readonly redactedSnapshot: Snapshot
  readonly configHash: string
  readonly engineVersion: string
  readonly engineMigrations: readonly AdminReleaseEngineMigration[]
}

/**
 * Assemble the row a changed boot writes.
 *
 * Redaction runs TWICE, and both passes are load-bearing. The caller redacts
 * the snapshot BEFORE hashing it, so the hash is over what is actually stored
 * and the two sides of a diff are comparable. The pass here covers the
 * ASSEMBLED row, because A6 names the derived DDL as the reason the snapshot
 * alone is not enough.
 *
 * The DDL is derived from the REAL tables rather than from the redacted clone:
 * the generators read field options a redactor may have rewritten, and their
 * output is covered by that whole-payload pass.
 */
const buildLedgerRow = (input: LedgerRowInput): NewBootLedgerEntry => {
  const { app, previous, redactedSnapshot, engineMigrations } = input
  const diff = diffSnapshots(previous?.snapshot, redactedSnapshot)
  const bootedAt = new Date()

  const derivedDdl = deriveConfigDdl({
    previousTables: priorTables(previous?.snapshot),
    currentTables: (app.tables ?? []) as readonly Table[],
    hasAuthConfig: app.auth !== undefined,
  }).map((entry) => ({ ...entry, appliedAt: bootedAt.toISOString() }))

  const payload = {
    summary: summariseDiff(diff),
    stats: deriveStats(previous?.snapshot, redactedSnapshot, diff) satisfies BootLedgerStats,
    engineMigrations,
    derivedDdl,
    snapshot: redactedSnapshot,
  }

  const redacted = redactSecretsForApp(
    payload,
    app.env,
    process.env,
    app.connections as readonly Readonly<Record<string, unknown>>[] | undefined
  ) as typeof payload

  return {
    appName: app.name,
    appVersion: app.version,
    engineVersion: input.engineVersion,
    prevEngineVersion: previous?.engineVersion,
    configHash: input.configHash,
    prevConfigHash: previous?.configHash,
    bootedAt,
    bootedBy: resolveBootedBy(process.argv),
    ...redacted,
  }
}

/**
 * Write a row for this boot, or determine that nothing changed and write none.
 *
 * The second outcome is the one most easily lost, and it is what separates a
 * ledger from a log: a server under a process supervisor restarts on a
 * schedule, and recording every one of those turns the timeline into a wall of
 * empty diffs. Nothing about what the instance runs changed, so nothing is
 * written — not a second identical row, and not the original row re-stamped
 * with a new time.
 */
export const captureBootLedgerEntry = (
  app: App,
  dialectConfig: DatabaseDialectConfig
): Effect.Effect<void, never, BootLedgerRepository> =>
  Effect.gen(function* () {
    const ledger = yield* BootLedgerRepository
    const appName = app.name
    const previous = yield* ledger.latest(appName)

    // Redact FIRST — the hash is over the redacted snapshot, and the previous
    // side it is compared against was stored redacted.
    const redactedSnapshot = redactSecretsForApp(
      plainSnapshot(app),
      app.env,
      process.env,
      app.connections as readonly Readonly<Record<string, unknown>>[] | undefined
    ) as Snapshot

    const configHash = computeConfigHash(canonicalJson(redactedSnapshot))
    const appVersion = app.version

    if (
      previous !== undefined &&
      previous.configHash === configHash &&
      previous.appVersion === appVersion
    ) {
      return
    }

    // effect-promise: total -- `getSovriumVersion` catches its own read failure and degrades to the '0.0.0' fallback; it is documented as never throwing.
    const engineVersion = yield* Effect.promise(() => getSovriumVersion())
    const engineMigrations = yield* engineMigrationsSince(dialectConfig.dialect, previous?.bootedAt)

    yield* ledger.insert(
      buildLedgerRow({
        app,
        previous,
        redactedSnapshot,
        configHash,
        engineVersion,
        engineMigrations,
      })
    )

    yield* ledger.prune(appName, RETAINED_ROWS)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning(`[boot-ledger] capture skipped: ${String(cause)}`)
    ),
    // effect-swallow: see the tap above. An observability row is not worth an
    // outage — an instance that cannot write one is still an instance that
    // runs, and the next changed boot writes the row that carries the gap.
    Effect.ignoreCause
  )
