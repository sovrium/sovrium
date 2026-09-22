/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { resolveAdminRole } from '@/domain/models/app/auth/roles'
import { appRequiresAi } from '@/domain/models/app/requires-ai'
import { appUsesStorage } from '@/domain/models/app/requires-storage'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import {
  parseStorageEnvConfig,
  type StorageEnvConfig,
} from '@/domain/models/process-env/storage/storage'
import {
  describeRootSecretSource,
  provisionRootSecret,
  ROOT_SECRET_ENV_VAR,
} from '@/infrastructure/crypto/root-secret'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { formatPathForDisplay } from '@/infrastructure/logging/format-path'
import { formatDuration } from '@/infrastructure/logging/startup-summary'
import { collectInsecureEnvWarning, getNodeEnv } from '@/infrastructure/process/env'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import type { StartupPhase } from '@/infrastructure/logging/startup-summary'

/**
 * Startup-summary phases that surface a *graceful-degradation* notice — a
 * configuration or runtime choice that disables an optional feature, shown to
 * the operator at boot so the degradation is never silent.
 *
 * Extracted from `server.ts` so the composition root stays under the
 * `max-lines` budget; both helpers are pure functions of the resolved config.
 */

/**
 * Emit a warning startup phase when storage is unconfigured.
 *
 * Detects the "no-storage stub" branch in `storage-service-live.ts` and warns
 * at startup that attachment fields will fail-fast (instead of letting the
 * operator discover it on the first upload).
 *
 * Keyed directly off `parseStorageEnvConfig()` — the single source of truth for
 * storage resolution — so it stays correct for every dialect:
 *
 * - PostgreSQL with no `STORAGE_PROVIDER` → bytea auto-fallback (configured).
 * - SQLite (zero-config) with no `STORAGE_PROVIDER` → local filesystem default
 *   at `<dataDir>/uploads` (configured — `success` label with the resolved dir).
 * - No database and no `STORAGE_PROVIDER` → genuinely undefined → warning.
 *
 * When storage IS configured, emits a `success` phase naming the active
 * provider (mirroring `databaseStartupLabel`) so the operator sees where files
 * are persisted — for local storage this includes the resolved directory. When
 * storage is unconfigured, the warning text matches the docstring in
 * `storage-service-live.ts` verbatim so a "grep for the warning" search works
 * from either side.
 *
 * ── GATED ON THE CONFIG, BOTH BRANCHES ─────────────────────────────────────
 *
 * An app that declares no bucket, no attachment column and no file-upload form
 * field cannot put a byte in storage, so NEITHER branch has anything to tell
 * its operator: the success row names a subsystem they do not use, and the
 * warning warns about a capability they never asked for. Both go silent there
 * — the same silent-skip contract as `collectPublicDirPhases` /
 * `collectAiListenerPhases`. [internal ref] (a bucket → the row appears)
 * against [internal ref] (nothing → no row in either form).
 */
export const collectStoragePhases = (app: Readonly<App>): readonly StartupPhase[] => {
  if (!appUsesStorage(app)) return []
  const config = parseStorageEnvConfig()
  if (config === undefined) {
    return [
      {
        label: 'Storage: Not configured (attachment fields will be disabled)',
        type: 'warning' as const,
      },
    ]
  }
  return [{ label: storageStartupLabel(config), type: 'success' as const }]
}

/**
 * Build the startup-summary line identifying the active database.
 *
 * - SQLite     → `Database: SQLite (./.sovrium/database.db)` — path runs through
 *                `formatPathForDisplay`, falls back to absolute when the data
 *                dir sits outside cwd; the `:memory:` sentinel passes through.
 * - PostgreSQL → `Database: PostgreSQL`
 */
export const databaseStartupLabel = (config: DatabaseDialectConfig): string =>
  config.dialect === 'sqlite'
    ? `Database: SQLite (${formatPathForDisplay(config.path)})`
    : 'Database: PostgreSQL'

/**
 * Build the startup-summary line identifying the active storage provider,
 * mirroring `databaseStartupLabel`. Secrets are never surfaced — only the
 * provider and a non-sensitive locator (local directory / S3 bucket).
 */
const storageStartupLabel = (config: StorageEnvConfig): string => {
  switch (config.provider) {
    case 'local':
      return `Storage: Local (${formatPathForDisplay(config.directory)})`
    case 's3':
      return `Storage: S3 (${config.bucket})`
    case 'bytea':
      return 'Storage: PostgreSQL (bytea)'
  }
}

/**
 * Emit a warning startup phase when the schema relies on the PL/pgSQL +
 * `pg_notify` AI listeners but the runtime is SQLite.
 *
 * The AI knowledge listener (auto-embed on record change) and AI compute
 * listener (`ai-categorize` / `ai-summary` / …) both require PostgreSQL
 * triggers + `LISTEN` — they self-skip on SQLite (see `ai-knowledge-listener.ts`
 * / `ai-compute-listener.ts`). This phase surfaces that degradation at startup
 * so an operator running an AI-enabled app on the zero-config SQLite engine
 * understands why auto-embedding / auto-compute are inactive, rather than
 * discovering it silently.
 */
export const collectAiListenerPhases = (app: Readonly<App>): readonly StartupPhase[] => {
  if (!isSqliteRuntime()) return []
  const tables = app.tables ?? []
  const hasAiComputeField = tables.some((table) =>
    table.fields.some((field) => isAiComputeFieldType(field.type))
  )
  const hasRagAgents = (app.agents ?? []).length > 0
  if (!hasAiComputeField && !hasRagAgents) return []
  return [
    {
      label: 'AI knowledge listener disabled — requires PostgreSQL',
      type: 'warning' as const,
    },
  ]
}

/**
 * Emit a warning startup phase when the app USES AI but no provider is chosen.
 *
 * With `AI_PROVIDER` unset an AI-bearing app still boots — that is deliberate
 *: declared agents come up INERT, discoverable but not runnable, and
 * an `ai-*` column keeps serving its baseline value rather than erroring. A
 * template deployed without an API key must be a working app with the
 * assistant switched off, never a refusal.
 *
 * That graceful degradation is exactly what makes the notice necessary: from
 * the outside an inert agent looks identical to a working one until someone
 * tries to use it. The label names BOTH consequences, because "AI disabled"
 * alone leaves the operator to guess whether their agents crashed or their
 * `ai-*` columns went null.
 *
 * Gated on the CONFIG in the same way the SMTP phase is: an app that declares
 * no AI surface loses nothing to an unset `AI_PROVIDER`, so warning it would
 * describe a capability it never asked for.
 */
export const collectAiProviderPhases = (app: Readonly<App>): readonly StartupPhase[] => {
  if (!appRequiresAi(app) || isAiProviderConfigured(process.env)) return []
  return [
    {
      label:
        'AI disabled — AI_PROVIDER not set ' +
        '(agents are inert, ai-* fields fall back to their baseline)',
      type: 'warning' as const,
    },
  ]
}

/**
 * Emit a success startup phase identifying the static-asset directory, IF one
 * is configured AND the directory exists on disk.
 *
 * Mirrors `databaseStartupLabel` / `storageStartupLabel` — silent when no
 * publicDir is in effect (no flag, no env var, no anchored `./public` next to
 * `app.yaml`), silent when the configured directory does not exist (the route
 * is not mounted either; see `setupPublicDirRoute`). The label uses
 * `formatPathForDisplay` so paths inside CWD render as the friendlier `./public`
 * form, otherwise the absolute path.
 */
export const collectPublicDirPhases = async (
  publicDir: string | undefined
): Promise<readonly StartupPhase[]> => {
  if (!publicDir) return []
  // Stat once at boot; the request-time handler also re-checks for changes.
  // A missing dir → no line (matches the silent-skip mount contract).
  const exists = await stat(publicDir)
    .then((s) => s.isDirectory())
    .catch(() => false)
  if (!exists) return []
  return [
    {
      label: `Public directory: ${formatPathForDisplay(publicDir)}`,
      type: 'success' as const,
    },
  ]
}

/**
 * Emit the admin-display banner phase.
 *
 * Three branches, mirroring the silent-skip contract used by
 * `collectPublicDirPhases` / `collectAiListenerPhases`:
 *
 * - `app.auth` is undefined (auth-less app) → silent (no admin concept applies).
 * - An admin exists → emit `✓ Admin: <email>` success phase (lowest-`id` admin
 *   for stable ordering across reboots; see `AuthRepository.findFirstAdmin`).
 * - Auth is configured, no users exist at all → silent. The existing
 *   bootstrap-token banner (`bootstrap-banner.ts`) is the single source of
 *   truth for the "no admin yet" state on a fresh boot; emitting an admin
 *   warning here would duplicate the token banner's `⚠ No admin user —
 *   claim one within 1 hour` message.
 * - Auth is configured, HUMAN users exist but none has `role = 'admin'` → emit
 *   `⚠ No admin user — provision one via 'sovrium admin create'`. This is
 *   the recovery hint for the case where every admin was demoted/deleted but
 *   regular users remain, so the bootstrap-token window is closed (the token
 *   only mints when no human user exists). The count is `countHumanUsers()`,
 *   not `countUsers()`, so synthetic `type='agent'` service identities (no
 *   `auth.account`, can't sign in) declared via `app.agents[]` don't suppress
 *   the still-valid first-admin token banner on a fresh agent-bearing app.
 *
 * Failures of the underlying lookup are swallowed silently — the banner must
 * not regress the rest of the startup pipeline if the Better Auth users table
 * is briefly unavailable. Real configuration failures still surface via
 * `ensureBetterAuthUsersTable` earlier in the boot sequence.
 */
export const collectAdminPhases = (app: Readonly<App>): Promise<readonly StartupPhase[]> => {
  if (!app.auth) return Promise.resolve([])
  // Resolve the admin-equivalent role (built-in `admin`, or the highest-`level`
  // custom role like cloud `operator` / partner `engineer`) so the banner does
  // not falsely warn "No admin user" when a custom-role superuser is seeded (WI-5).
  const adminRole = resolveAdminRole(app)
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    const admin = yield* repo.findFirstAdmin(adminRole)
    if (admin) {
      return [{ label: `Admin: ${admin.email}`, type: 'success' as const }] as const
    }
    // No admin found. Distinguish "no human users yet" (silent — bootstrap-token
    // banner owns the message) from "human users exist but none are admin"
    // (operator recovery warning). Agent service users are excluded so an
    // agent-bearing fresh app stays in the token-banner branch.
    const userCount = yield* repo.countHumanUsers
    if (userCount === 0) return [] as const
    return [
      {
        label: "No admin user — provision one via 'sovrium admin create'",
        type: 'warning' as const,
      },
    ] as const
  }).pipe(
    Effect.provide(AuthRepositoryLive),
    // effect-swallow: stated in the doc comment above — this only decides whether the startup BANNER prints an admin line, and a banner lookup must not regress the boot it is describing. A real misconfiguration is caught earlier, by the Better Auth users-table check.
    Effect.orElseSucceed(() => [] as readonly StartupPhase[])
  )
  return Effect.runPromise(program)
}

/**
 * Emit a `✓ Telemetry:` success phase per ACTIVE observability signal, naming
 * the destination HOST ONLY.
 *
 * Mirrors the silent-skip contract of `collectStoragePhases` /
 * `collectPublicDirPhases`: a disabled signal contributes NO line. The DSN key
 * and `OTEL_EXPORTER_OTLP_HEADERS` values are NEVER rendered — the host is
 * parsed from the DSN / OTLP endpoint (`config.*.host`), which the domain parser
 * already stripped of credentials. Performance appends its sample percentage;
 * logs are tagged `(OTLP)`.
 */
export const collectTelemetryPhases = (): readonly StartupPhase[] => {
  const config = getTelemetryConfig()
  const errorsHost = config.errorReporting?.dsn.host

  const errorPhase: readonly StartupPhase[] = errorsHost
    ? [{ label: `Telemetry: errors → ${errorsHost}`, type: 'success' as const }]
    : []
  const logPhase: readonly StartupPhase[] = config.logExport
    ? [{ label: `Telemetry: logs → ${config.logExport.host} (OTLP)`, type: 'success' as const }]
    : []
  const performancePhase: readonly StartupPhase[] =
    config.performance && errorsHost
      ? [
          {
            label: `Telemetry: performance → ${errorsHost} (${Math.round(
              config.performance.sampleRate * 100
            )}% sampled)`,
            type: 'success' as const,
          },
        ]
      : []

  return [...errorPhase, ...logPhase, ...performancePhase]
}

/**
 * Assemble the ordered startup phases: optional insecure-env ⚠ warning → ✓ Mode
 * → ✓ Encryption key → infra → CSS → ready. `renderStartupSummary` groups all `warning` phases
 * ahead of `success` phases, so the ⚠ surfaces above the banner while `✓ Mode:`
 * leads the success block.
 *
 * The insecure-env warning is collected here ("silent in dev, loud in prod via
 * banner"); `✓ Mode:` reflects `getNodeEnv()` with an unset value displayed as
 * `development`. Extracted from `server.ts` to keep the composition root under
 * the `max-lines` / `max-statements` budgets.
 */
export const collectRootSecretPhases = (app: Readonly<App>): readonly StartupPhase[] => {
  const resolution = provisionRootSecret()
  const reported: StartupPhase = {
    label: `Encryption key: ${describeRootSecretSource(resolution, formatPathForDisplay)}`,
    type: 'success' as const,
  }
  // The one shape where the key and the data it protects do NOT share a fate: an
  // external database outlives the container filesystem, so a freshly-generated
  // key means every connection token written before this restart just became
  // unreadable — and will again on the next one. Nothing else in the system
  // notices, which is precisely why it is said out loud here.
  //
  // `connections[]` is the third condition and it is not decoration: connection
  // tokens are the ONLY thing sealed with the root secret, so an app that
  // declares none has nothing durable encrypted with the key that just changed.
  // Warning it about a loss it cannot suffer is the noise this whole pass
  // exists to remove.
  const ephemeral: readonly StartupPhase[] =
    resolution.source === 'generated' &&
    (process.env['DATABASE_URL'] ?? '') !== '' &&
    (app.connections ?? []).length > 0
      ? [
          {
            label:
              'Encryption key was generated on this boot while DATABASE_URL points at an external database — ' +
              `set ${ROOT_SECRET_ENV_VAR} to a fixed value so stored connection tokens survive a restart`,
            type: 'warning' as const,
          },
        ]
      : []
  return [...ephemeral, reported]
}

export const buildStartupPhases = (params: {
  readonly app: Readonly<App>
  readonly infraPhases: readonly StartupPhase[]
  readonly cssLabel: string
  readonly durationMs: number
  readonly bindHost?: string
}): readonly StartupPhase[] => {
  const insecureEnvPhase = collectInsecureEnvWarning(params.bindHost)
  const mode = getNodeEnv() === 'production' ? 'production' : 'development'
  return [
    ...(insecureEnvPhase ? [insecureEnvPhase] : []),
    { label: `Mode: ${mode}`, type: 'success' as const },
    ...collectRootSecretPhases(params.app),
    ...params.infraPhases,
    { label: params.cssLabel, type: 'success' as const },
    { label: `Server ready in ${formatDuration(params.durationMs)}`, type: 'success' as const },
  ]
}
