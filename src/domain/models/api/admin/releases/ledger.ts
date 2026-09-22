/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/releases` and `GET /api/admin/releases/:hash`
 * — the boot ledger.
 *
 * One row per server start whose `app.version` or config hash differs from the
 * previous row, carrying both versions, both hashes, the boot time, the engine
 * migrations applied since the previous row, the app-table DDL the engine
 * derived from `tables`, and — stored but never served — a redacted snapshot of
 * the configuration that booted, from which the row-to-row diff is rendered.
 *
 * Source story: [internal ref]
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * [internal ref] amendment **A6** (ratified 2026-09-16), surface 8. A6 extends A1's
 * invariant — reading the running configuration is observability, mutating it
 * is authoring — with the one A1 could not state, because A1 had no ledger to
 * reason about:
 *
 *   > has what this surface describes already happened?
 *
 * Every row describes a boot that already ran. That is what separates this from
 * D1's refused "version ledger/history", whose referent is [internal ref]'s *draft*
 * store: a ledger of boots holds no candidate configuration and stages nothing.
 *
 * Two modules, two GET handlers, and **no request schema** in either — there is
 * no shape a caller can send, because there is nothing to send it to. The row
 * is written by the boot path; no HTTP verb creates, edits or deletes one.
 *
 * ─── BOUNDS THIS CONTRACT ENCODES ───────────────────────────────────────────
 *
 * **Both sides of any diff are boots that happened.** A6's sharpest bound and
 * the precise place the ledger would otherwise become the sandbox A1 refused.
 * The diff is row-to-row: never against an uploaded file, a working copy, a
 * branch, or a configuration typed into the console. The baseline row therefore
 * carries `diff: []` and `previousConfigHash: null` — *not* the whole snapshot
 * rendered as `+` lines, which would be a diff against an empty configuration
 * that never booted anywhere, which is A1's refusal wearing a convenience.
 *
 * **No snapshot is served.** The redacted snapshot is persisted to be diffed
 * against, not to be read. `GET /api/admin/config/schema` is where A1 put the
 * reflection and A6 re-homed its *page* rather than its endpoint; a second
 * serialisation of the whole configuration on a second route would be a second
 * place to leak. No field here carries it.
 *
 * **No revert, no rollback, no re-deploy.** A6 refuses them by name: restoring
 * a previous configuration changes what the instance runs, and the way to do it
 * is `git revert` and redeploy — D2's channel, which this ledger records rather
 * than replaces. There is no field here a client could POST back.
 *
 * ─── REDACTION HAPPENS AT CAPTURE, NOT HERE ─────────────────────────────────
 *
 * A1's condition governs unchanged and A6 moves its boundary earlier: because
 * the ledger **persists**, redaction runs before the row is written, never on
 * read. A row redacted on the way out is a plaintext credential at rest,
 * reachable by every backup, every restore, every ad-hoc query, and the
 * `MCP_EXPOSE_INTERNALS` reader. Nothing in this module redacts; by the time a
 * value reaches these schemas it has already been through `redactSecretsForApp`
 * — the SAME redactor A1's surface uses, never a sibling, because a second
 * serializer is a second place to leak.
 *
 * What that inherits, and it is counter-intuitive enough to be worth repeating
 * from `../config/schema.ts`: `redactSecretsForEnv` alone is a **no-op** on an
 * `App`. `$env.X` references are resolved at use time and never at boot, so the
 * object holds the token `'$env.STRIPE_KEY'` rather than the secret it names.
 * Only a hardcoded literal reaches the object, and only `collectConnectionSecrets`
 * — composed into `redactSecretsForApp` — catches it. A redaction test written
 * against a config that uses `$env.` everywhere passes vacuously.
 *
 * `$env.X` tokens survive by design: a variable name is not a credential, and
 * seeing which variable feeds a field is the observability A1 authorises.
 *
 * ─── THE ENVELOPES ARE FLAT, AND THAT IS A RENDERING CONSTRAINT ─────────────
 *
 * Every scalar sits at the top level of its response. A `kpi` binds a flat
 * scalar and `$record.` addresses a flat key, so `$record.added` resolves where
 * `$record.stats.added` prints `[object Object].added` — a rendering defect no
 * status check catches. The three arrays in the detail response sit beside the
 * scalars rather than wrapping them.
 *
 * @see [internal ref] (A6)
 * @see src/application/use-cases/automations/redact-secrets.ts
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The scalar fields every ledger row publishes, in both reads.
 *
 * Spread into two `Schema.Struct`s rather than composed with `Schema.extend`:
 * the list adds two counts, the detail adds the arrays those counts summarise,
 * and a plain spread makes the shared half one declaration without inviting the
 * duplicate-key throw `Schema.extend` raises at import time.
 */
const releaseScalars = {
  id: Schema.String.annotate({
    description:
      'Row identity — the exact, permanent address of one boot. Accepted by the detail read alongside the config hash, and the only address that stays unambiguous when a configuration is reverted and re-deployed.',
  }),
  version: Schema.NullOr(Schema.String).annotate({
    description:
      'app.version as this boot decoded it. Null when the configuration declares none, which most do not — the ledger still records the boot, keyed on the config hash.',
  }),
  engineVersion: Schema.String.annotate({
    description: 'The Sovrium engine version that ran this boot.',
  }),
  previousEngineVersion: Schema.NullOr(Schema.String).annotate({
    description:
      'The engine version of the previous ledger row. Null on the baseline row. Equal to engineVersion when the binary did not change.',
  }),
  configHash: Schema.String.annotate({
    description:
      'Twelve hex characters over the canonical JSON of the REDACTED snapshot — not over the config file bytes, so re-formatting app.ts writes no row and rotating a hardcoded secret writes no row. It is a different number from the one in the CLI lock file, which hashes file content.',
  }),
  previousConfigHash: Schema.NullOr(Schema.String).annotate({
    description:
      "The config hash of the previous ledger row — the other side of this row's diff, and itself a boot that happened. Null on the baseline row.",
  }),
  bootedAt: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp of the capture, which runs after the migrator and before the listener binds — within a second of the boot it records.',
  }),
  bootedBy: Schema.NullOr(Schema.String).annotate({
    description:
      'How the process started: "sovrium <verb>" when it entered through the CLI, "embedded" for a library boot. Never a person — the engine holds no operator identity at boot, and naming one would be the more precise-looking lie.',
  }),
  current: Schema.Boolean.annotate({
    description:
      'True on the newest row only. "Current" means the most recently recorded boot; a --watch hot reload changes the running configuration without writing a row, so it is the boot this process started from rather than a guarantee about the live object.',
  }),
  summary: Schema.String.annotate({
    description:
      'A one-line label generated from the diff at capture time. Derived, never operator prose — the ledger accepts no message.',
  }),
  added: Schema.Finite.annotate({
    description: 'Diff lines added against the previous row. Zero on the baseline row.',
  }),
  removed: Schema.Finite.annotate({
    description: 'Diff lines removed against the previous row. Zero on the baseline row.',
  }),
  tables: Schema.Finite.annotate({ description: 'Tables added by this boot.' }),
  fields: Schema.Finite.annotate({ description: 'Table fields added by this boot.' }),
  automations: Schema.Finite.annotate({ description: 'Automations added by this boot.' }),
  agents: Schema.Finite.annotate({ description: 'Agents added by this boot.' }),
  links: Schema.Finite.annotate({ description: 'Short links added by this boot.' }),
} as const

/**
 * One engine migration folder drizzle applied.
 *
 * "Applied **since the previous ledger row**", which is not the same as "at this
 * boot" and is deliberately the wider reading. A boot that upgrades the engine
 * without touching the configuration changes neither the version nor the hash,
 * so under A6 it writes no row while applying real migrations; attributing them
 * to the next row that IS written is what keeps the ledger complete. On an
 * ordinary boot the two readings coincide. On the baseline row, which has no
 * predecessor, it is every migration `__drizzle_migrations` holds — the honest
 * statement that this is the engine state the ledger starts from.
 */
export const engineMigrationEntrySchema = Schema.Struct({
  folder: Schema.String.annotate({
    description: "The migration directory name, which is drizzle v1's own identity for it.",
  }),
  appliedAt: looseIsoDateTime({
    description: 'When drizzle recorded it in __drizzle_migrations.',
  }),
  statements: Schema.Finite.annotate({
    description:
      'Statements in the shipped migration.sql, counted by splitting on the statement-breakpoint marker.',
  }),
}).annotate({
  identifier: 'AdminReleaseEngineMigration',
  title: 'Engine Migration Entry',
  description: 'One drizzle migration folder applied since the previous ledger row',
})

/** @public Awaiting the route in `presentation/api/admin/releases-routes.ts`. */
export type AdminReleaseEngineMigration = typeof engineMigrationEntrySchema.Type

/**
 * One app-table DDL statement the engine derived from `tables`.
 *
 * **Derived from the two snapshots, not observed from the transaction.** A6's
 * own wording is "the app-table DDL the engine *derived* from `tables`", and
 * `initializeSchema` returns void with its statements applied several layers
 * down inside a `TransactionLike`; threading a mutable sink through the whole
 * schema-migration layer for an observability row would be the larger change
 * and the more fragile one. Derivation and application agree wherever an
 * operator could tell: an unchanged `tables` derives nothing and also skips the
 * initializer (the checksum matches), and a changed one derives statements and
 * also forces a full migration.
 *
 * `appliedAt` is the row's `bootedAt`. There is no per-statement timestamp to
 * be had.
 */
export const schemaChangeEntrySchema = Schema.Struct({
  statement: Schema.String.annotate({
    description:
      'The DDL statement, after the same capture-time redaction pass as the snapshot — a DEFAULT clause derived from config can carry a config value with it.',
  }),
  table: Schema.String.annotate({ description: 'The table the statement operates on.' }),
  appliedAt: looseIsoDateTime({ description: 'The boot timestamp of the row that derived it.' }),
}).annotate({
  identifier: 'AdminReleaseSchemaChange',
  title: 'Derived Schema Change',
  description: 'One app-table DDL statement the engine derived from the config diff at boot',
})

/** @public Awaiting the route in `presentation/api/admin/releases-routes.ts`. */
export type AdminReleaseSchemaChange = typeof schemaChangeEntrySchema.Type

/**
 * One row as the list renders it: every scalar, plus counts in place of the
 * arrays the detail read carries.
 */
export const releaseSummarySchema = Schema.Struct({
  ...releaseScalars,
  engineMigrationCount: Schema.Finite.annotate({
    description: 'How many engine migrations this row carries.',
  }),
  schemaChangeCount: Schema.Finite.annotate({
    description: 'How many derived DDL statements this row carries.',
  }),
}).annotate({
  identifier: 'AdminReleaseSummary',
  title: 'Release Summary',
  description: 'One boot-ledger row as the timeline renders it',
})

/** @public Awaiting the route in `presentation/api/admin/releases-routes.ts`. */
export type AdminReleaseSummary = typeof releaseSummarySchema.Type

/**
 * Response shape of `GET /api/admin/releases`.
 *
 * Newest first, because a timeline is read from the top and the row an operator
 * wants is almost always the last one. An instance that has booted but recorded
 * nothing is impossible — the first boot always writes a baseline row — but an
 * instance whose ledger was pruned to nothing answers 200 with an empty list and
 * zeroes rather than 404: a 404-when-empty is indistinguishable from a route
 * that was never mounted, and the console draws its empty state from the 200.
 */
export const releasesListResponseSchema = Schema.Struct({
  releases: Schema.Array(releaseSummarySchema).annotate({
    description: 'Every retained row, newest boot first.',
  }),
  total: Schema.Finite.annotate({ description: 'How many rows the ledger retains.' }),
  since: Schema.NullOr(looseIsoDateTime()).annotate({
    description:
      "The boot time of the oldest retained row — the beginning of what this ledger can still answer for, which is not necessarily the instance's first boot once pruning has run.",
  }),
  engineMigrations: Schema.Finite.annotate({
    description: 'Engine migrations across every retained row.',
  }),
  schemaChanges: Schema.Finite.annotate({
    description: 'Derived DDL statements across every retained row.',
  }),
  currentVersion: Schema.NullOr(Schema.String).annotate({
    description: 'app.version of the newest row.',
  }),
  currentHash: Schema.NullOr(Schema.String).annotate({
    description: 'Config hash of the newest row.',
  }),
  generatedAt: looseIsoDateTime({
    description:
      'When this list was read. Per-request, because it timestamps the read rather than any boot.',
  }),
}).annotate({
  identifier: 'AdminReleasesListResponse',
  title: 'Boot Ledger List Response',
  description:
    'The boot ledger newest-first, with flat totals beside it for direct $record. binding',
})

/** @public Awaiting the route in `presentation/api/admin/releases-routes.ts`. */
export type AdminReleasesListResponse = typeof releasesListResponseSchema.Type

/**
 * Response shape of `GET /api/admin/releases/:hash`.
 *
 * The path parameter takes either a twelve-hex config hash or a row id. A hash
 * is the address the console links and an operator reads off a diff, so it has
 * to work — but A → B → A is a legitimate sequence of three boots in which two
 * rows carry the same hash, so a hash is not an identity. A hash therefore
 * resolves to the NEWEST row carrying it, and `id` addresses any row exactly:
 * git's ref-or-sha shape, failing in the direction an operator recovers from.
 *
 * Anything that resolves to neither is **404**, never 400. To a caller it is
 * indistinguishable from a hash belonging to another instance, and a 400 would
 * tell an anonymous prober the shape was right.
 */
export const releaseDetailResponseSchema = Schema.Struct({
  ...releaseScalars,
  previousBootedAt: Schema.NullOr(looseIsoDateTime()).annotate({
    description: 'When the other side of this diff booted. Null on the baseline row.',
  }),
  engineMigrations: Schema.Array(engineMigrationEntrySchema).annotate({
    description: 'Engine migrations applied since the previous row.',
  }),
  schemaChanges: Schema.Array(schemaChangeEntrySchema).annotate({
    description: "App-table DDL derived from this row's config diff.",
  }),
  diff: Schema.Array(Schema.String).annotate({
    description:
      'Unified lines against the previous row: "@@ path @@" hunk headers, "+" additions, "-" removals. Secrets are already redacted — they were redacted before either snapshot was stored. EMPTY on the baseline row, which has no previous boot to diff against: A6 requires both sides of a diff to have run, so the whole configuration rendered as additions would be a diff against something that never booted.',
  }),
  previousUnavailable: optionalField(
    Schema.Boolean.annotate({
      description:
        'Present and true when previousConfigHash names a row that retention has pruned. The diff is then empty because its other side is gone — stated rather than fabricated, and distinct from the baseline row, whose previousConfigHash is null.',
    })
  ),
  generatedAt: looseIsoDateTime({
    description: 'When this detail was read and its diff computed.',
  }),
}).annotate({
  identifier: 'AdminReleaseDetailResponse',
  title: 'Boot Ledger Detail Response',
  description:
    'One boot, its derived DDL and engine migrations, and its row-to-row diff against the boot before it',
})

/** @public Awaiting the route in `presentation/api/admin/releases-routes.ts`. */
export type AdminReleaseDetailResponse = typeof releaseDetailResponseSchema.Type
