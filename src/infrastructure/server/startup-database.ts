/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The database half of startup: migrations, schema init, and the best-effort
 * post-schema maintenance that must never fail a boot.
 *
 * Split out of `server.ts` so the chain — and which of its steps are fatal
 * versus degradable — is readable without the listener and banner around it.
 */

import { Effect } from 'effect'
import { runSyncAgentUsers } from '@/infrastructure/auth/agent-user-sync'
import { seedMcpResourceServerClient } from '@/infrastructure/auth/better-auth/mcp-resource-server'
import { runOrgTeamSeeding } from '@/infrastructure/auth/better-auth/org-team-seeder'
import { runSeedAllConnectionDefinitions } from '@/infrastructure/connections/test-token-seeder'
import { runAdminSearchIndexPurge } from '@/infrastructure/database/admin-search-index-purge'
import {
  filterRagKnowledgeByRole,
  runRagKnowledgeStartup,
} from '@/infrastructure/database/ai-knowledge-listener'
import { runAttachmentUrlBackfill } from '@/infrastructure/database/attachment-url-backfill'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { runLinkShadowSweep } from '@/infrastructure/database/link-shadow-sweep'
import { BootLedgerRepositoryLive } from '@/infrastructure/database/repositories/admin/boot-ledger-repository-live'
import { countTokensEncryptedWithAnotherKey } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { initializeSchema } from '@/infrastructure/database/schema/schema-initializer'
import { reconcileUserForeignKeys } from '@/infrastructure/database/schema/user-foreign-key-reconciler'
import { runStorageBucketBackfill } from '@/infrastructure/database/storage-bucket-backfill'
import { reconcileTimestamptzColumns } from '@/infrastructure/database/timestamptz-column-reconciler'
import { StartupMaintenanceError } from '@/infrastructure/errors/startup-maintenance-error'
import { logError, logWarning } from '@/infrastructure/logging/logger'
import { captureBootLedgerEntry } from '@/infrastructure/server/boot-ledger-capture'
import { databaseStartupLabel } from '@/infrastructure/server/startup-degradation-phases'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import type {
  DatabaseConnectionError,
  MigrationError,
} from '@/infrastructure/database/drizzle/migrate'
import type {
  AuthConfigRequiredForUserFields,
  SchemaInitializationError,
} from '@/infrastructure/database/schema/schema-initializer'
import type { StartupPhase } from '@/infrastructure/logging/startup-summary'

/**
 * The boot ⚠ for signing keys that were regenerated because the auth secret
 * changed.
 *
 * Regenerating is not free — every JWT already issued against the old key stops
 * verifying — so it is never done quietly. The alternative was worse: without
 * this, a changed auth secret leaves every signing request answering 500 with a
 * cause visible only in the server log..
 */
const jwksRekeyWarningPhases = (count: number): readonly StartupPhase[] =>
  count > 0
    ? [
        {
          label:
            `${count} JWT signing keys could not be read with the current auth secret ` +
            'and were regenerated — previously issued tokens are no longer valid',
          type: 'warning' as const,
        },
      ]
    : []

/**
 * The boot ⚠ for stored tokens written under a different encryption key.
 *
 * Warn, never refuse: the affected users have to re-authorize, but taking a whole
 * deployment down over a subset of them would be a far larger outage than the one
 * being reported. Silent is the only genuinely wrong answer — see
 * [internal ref].
 */
const foreignKeyIdWarningPhases = (count: number): readonly StartupPhase[] =>
  count > 0
    ? [
        {
          // The noun stays plural at every count. It reads slightly oddly at
          // one, and that is the deliberate trade: `stored connection tokens` is
          // the phrase both [internal ref] and its regression sibling
          // match on, and a count-dependent noun would make the warning
          // undetectable exactly when a single user is affected.
          label:
            `${count} stored connection tokens encrypted with a different key ` +
            '— affected users must reconnect',
          type: 'warning' as const,
        },
      ]
    : []

/**
 * Run the database startup chain (migrations → schema → best-effort post-schema
 * steps).
 *
 * SQLite is a real, zero-config database — migrations and schema init **always**
 * run, regardless of whether `DATABASE_URL` is set. When the resolved dialect is
 * `postgres` the flow is behaviourally identical to the historical Postgres
 * path. `runRagKnowledgeStartup` is still keyed off `databaseUrl` (the RAG
 * pipeline is Postgres-only and self-skips with an empty string on SQLite).
 */
/**
 * Filter every agent's `knowledge.tables[]` down to the tables their declared
 * role is allowed to read. Returns the agent list in the
 * shape `runRagKnowledgeStartup` consumes, with admin-only tables dropped for
 * lower-privilege agents.
 */
export const runDatabaseStartup = (
  app: App,
  dialectConfig: DatabaseDialectConfig,
  /**
   * This PROCESS renders and exits rather than starting the instance, so it
   * writes no boot-ledger row — `build`'s case, and its only caller. See
   * `ServerFactory.startDatabase`. The ledger step is the only step in THIS
   * chain that reads it; every other step below still runs.
   */
  ephemeral = false
): Effect.Effect<
  readonly StartupPhase[],
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | DatabaseConnectionError
  | MigrationError
> => {
  return runMigrations(dialectConfig).pipe(
    Effect.flatMap(() => initializeSchema(app)),
    // Unify declared `created-at` / `updated-at` / `deleted-at` columns on
    // TIMESTAMPTZ, behind an operator opt-in. NOT best-effort: when the operator
    // has opted in and the `TimeZone` preflight refuses, that abort IS the
    // feature. With the gate off (the default) it emits no DDL and only warns.
    //
    // It sits HERE and not inside `initializeSchema` for the same reason as the
    // attachment-URL repair below: that path is guarded by a checksum computed
    // from `app.tables` alone, so an operator upgrading the binary without
    // editing their config never reaches it — exactly the install whose columns
    // drifted.
    Effect.flatMap(() => reconcileTimestamptzColumns(app)),
    // Put `ON DELETE SET NULL` on every `type: 'user'` foreign key that predates
    // it, so an account assigned on somebody else's record can be erased at all.
    // Unlike the timestamptz step above this one is NOT gated: on Postgres the
    // swap is catalog-only, and on SQLite — the zero-config default — a gate
    // defaulting to off would leave most self-hosted installs unerasable.
    //
    // Same placement and same reason as its two neighbours: the checksum
    // guarding `executeMigrationSteps` is computed from `app.tables` alone, so an
    // operator upgrading the binary without editing their config never reaches
    // it — exactly the install still carrying the unerasable key.
    Effect.flatMap(() => reconcileUserForeignKeys(app)),
    // Record this boot in `system.boot_ledger` ([internal ref] amendment A6) — one row
    // per start whose app version or config hash differs from the row before
    // it, and NO row when neither did.
    //
    // It sits HERE, and the position is the whole reason the step is
    // deterministic. `runMigrations` has finished, so `__drizzle_migrations` is
    // complete for this boot and the ledger's own table exists;
    // `initializeSchema` and both reconcilers have finished, so the app tables
    // match the configuration the row is about to claim. And it is PRE-BIND, so
    // no request can read a ledger the boot has not finished writing.
    //
    // Non-fatal like its best-effort neighbours — an observability row is not
    // worth an outage, and `captureBootLedgerEntry` absorbs its own failure
    // after logging the cause. But it keeps its ORDERING inside the fatal
    // chain rather than being appended after the seeders, because what it
    // records is the state those two reconcilers just finished establishing.
    //
    // And it is the one step in this chain a render-and-exit command skips.
    // `sovrium build` emits a site and starts nothing, so it has no boot to
    // record. The sharper half of that story is closed elsewhere: the static
    // render pass used to boot a server per language through `createServer`,
    // and each one wrote a row beside the real boot's, hashing a
    // token-substituted document nobody wrote. It binds nothing now
    // (`render-app.ts`), so there is no render boot left to exclude here.
    // [internal ref].
    Effect.flatMap(() =>
      ephemeral
        ? Effect.void
        : Effect.provide(captureBootLedgerEntry(app, dialectConfig), BootLedgerRepositoryLive)
    ),
    // Best-effort post-schema seeders (each never blocks startup): seed
    // system.connections, sync agent users, seed orgs/teams. These stay
    // PRE-bind because auth and agent routes may consult their rows on the
    // very first request. The two heavyweight best-effort steps — the
    // attachment-URL backfill and RAG embedding startup — moved to
    // `runDeferredStartupMaintenance`, which `createServer` runs AFTER the
    // listener binds and BEFORE it announces readiness: both can take
    // seconds-to-minutes on large datasets, and the port is open throughout.
    //
    // Drop the derived admin global-search index so the next lazy rebuild
    // repopulates it under the CURRENT indexing rules ([internal ref] R3). Narrowing
    // the indexer alone is prospective-only: `rebuildIndex` never deletes, so
    // rows it stops emitting — soft-deleted submissions, rows past the per-source
    // LIMIT, hard-deleted ones — would keep their old body forever.
    //
    // ORDERING IS LOAD-BEARING ON SQLITE and must stay after `runMigrations`,
    // which is where the FTS5 vtab + its content-sync triggers are created: the
    // SQLite index is external-content, so a content-row DELETE without the
    // `…_ad` trigger in place leaves the tokens in the inverted index. Invisible
    // on Postgres. It also has to stay PRE-BIND — after the listener opens, a
    // search request could rebuild and answer from residue first.
    // effect-promise: total -- `runAdminSearchIndexPurge` wraps its whole body in a try/catch that logs; that is what "never blocks startup" above means, and it is the callee's own guarantee rather than this call site's.
    Effect.flatMap(() => Effect.promise(() => runAdminSearchIndexPurge())),
    Effect.flatMap(() =>
      // effect-promise: total -- `runSeedAllConnectionDefinitions` runs its program through `Effect.result` and logs a failure; it resolves either way.
      Effect.promise(() => runSeedAllConnectionDefinitions({ connections: app.connections }))
    ),
    Effect.flatMap(() =>
      // effect-promise: total -- `runSyncAgentUsers` awaits `syncAgentUsers(...).catch(...)`, so a sync failure is logged inside and never rejects.
      Effect.promise(() => runSyncAgentUsers({ agents: app.agents, hasAuth: !!app.auth }))
    ),
    // effect-promise: total -- `runOrgTeamSeeding` wraps its whole body in a try/catch that logs.
    Effect.flatMap(() => Effect.promise(() => runOrgTeamSeeding(app))), // org + team seeding
    // Seed the MCP resource server's own confidential OAuth client and link it
    // to the MCP protected resource. It only ever authenticates the server to
    // its own introspection endpoint, so it is derived from the root secret
    // rather than configured, and it is skipped entirely unless both auth and
    // MCP are on. PRE-bind, because the very first MCP request introspects.
    //
    // The gate reads `MCP_ENABLED` raw rather than decoding the MCP env schema.
    // Decoding here would raise the schema's own error ahead of the dedicated
    // MCP validation step, replacing its actionable message
    // ("MCP env validation failed: ...") with a bare decode failure — which is
    // what an operator would then have to debug.
    Effect.flatMap(() =>
      // effect-promise: total -- the trailing `.catch(() => undefined)` absorbs every rejection; MCP client seeding is skipped entirely unless both auth and MCP are on, and a failure must not take the boot with it.
      Effect.promise(() =>
        seedMcpResourceServerClient({
          hasAuth: !!app.auth,
          mcpEnabled: process.env['MCP_ENABLED'] === 'true',
        }).catch(() => undefined)
      )
    ),
    // Two surveys of key material the current secrets may no longer be able to
    // read. Both run AFTER migrations and schema init, so the tables they touch
    // are guaranteed to exist, and both run at boot rather than on first use: an
    // operator whose key changed needs to hear it once, in the place they are
    // already looking, not one failed request at a time.
    //
    // They resolve opposite ways on purpose. Connection tokens are user data, so
    // the survey counts and warns and changes nothing. JWKS rows are derived key
    // material, so they are regenerated — see `rekeyUnreadableJwks`.
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: async () => ({
          foreignKeyIdCount: await countTokensEncryptedWithAnotherKey(),
          // JWKS rows only exist for an app that configured auth, so an app
          // without one has nothing to rekey and must not load `better-auth/crypto`
          // to discover that. `jwksRekeyWarningPhases(0)` emits no phase, so the
          // banner is byte-identical to the pre-lazy behaviour.
          rekeyedJwksCount: app.auth
            ? await import('@/infrastructure/auth/better-auth/server-runtime').then((runtime) =>
                runtime.rekeyUnreadableJwks()
              )
            : 0,
        }),
        catch: (cause) => new StartupMaintenanceError(cause),
      }).pipe(
        // A BANNER survey, not a migration: it counts key material the current
        // secrets can no longer read. Neither the dynamic import nor the rekey
        // carried a `catch`, so a failure here was a defect that took down a
        // boot which had already migrated the database successfully — a
        // diagnostic step failing the thing it was diagnosing.
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            logWarning(`[server] key-material survey skipped: ${String(cause)}`)
          })
        ),
        // effect-swallow: see the tap above. The survey only ever ADDS warning
        // lines to the startup banner; zero counts mean "nothing to report",
        // which is also what an operator sees on a healthy install.
        Effect.orElseSucceed(() => ({ foreignKeyIdCount: 0, rekeyedJwksCount: 0 }))
      )
    ),
    Effect.map(({ foreignKeyIdCount, rekeyedJwksCount }): readonly StartupPhase[] => [
      ...foreignKeyIdWarningPhases(foreignKeyIdCount),
      ...jwksRekeyWarningPhases(rekeyedJwksCount),
      { label: databaseStartupLabel(dialectConfig), type: 'success' as const },
    ])
  )
}

/**
 * Deferred best-effort startup maintenance, run by `createServer` AFTER the
 * listener binds but BEFORE the startup banner announces readiness:
 *
 * - Attachment-URL backfill: repairs `default`-bound attachment URLs
 *   accumulated before an upgrade. Table scans — seconds on large datasets.
 * - RAG embedding startup ([internal ref] filtering preserved): embeds
 *   agent knowledge tables and installs change listeners. Network-bound
 *   against the AI provider — the slowest boot step by far when agents exist.
 *
 * Both remain best-effort — a failure here is logged and never fails the boot
 * — but they are AWAITED rather than forked. Moving them off the boot path
 * entirely was tried and reverted: the startup banner then announced a
 * readiness the process had not reached, and a caller that boots and
 * immediately reads a backfilled attachment URL or queries embedded knowledge
 * observed a half-finished boot. Keeping them here still recovers most of the
 * win, because the listener is already bound when they run.
 */
export const runDeferredStartupMaintenance = (app: App): Effect.Effect<void, never> =>
  // Each step is `tryPromise` rather than `promise`: the trailing `catchCause`
  // absorbs the outcome either way, but a DEFECT skips the remaining steps of
  // this chain while a typed failure is what the chain is written to expect.
  Effect.tryPromise({
    try: () => runAttachmentUrlBackfill(app),
    catch: (cause) => new StartupMaintenanceError(cause),
  }).pipe(
    // AFTER the URL repair: that pass rewrites the stored `url` onto the bucket
    // the column declares, and this one reads those URLs to attribute objects.
    // Running it first would attribute them to the stale bucket.
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => runStorageBucketBackfill(app),
        catch: (cause) => new StartupMaintenanceError(cause),
      })
    ),
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => runRagKnowledgeStartup(filterRagKnowledgeByRole(app)),
        catch: (cause) => new StartupMaintenanceError(cause),
      })
    ),
    // Reconcile runtime-minted links against the slugs `app.links[]` now
    // declares. Deferred rather than a migration step because the checksum fast
    // path skips migrations entirely, which would mean skipping the sweep on
    // exactly the boot where the config changed.
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => runLinkShadowSweep(app),
        catch: (cause) => new StartupMaintenanceError(cause),
      })
    ),
    Effect.asVoid,
    Effect.catchCause((cause) =>
      Effect.sync(() => logError('[server] deferred startup maintenance failed', cause))
    )
  )
