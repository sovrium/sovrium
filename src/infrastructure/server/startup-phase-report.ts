/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The startup banner: collect every phase, then render it once.
 *
 * The phases come from three places — the database chain, the degradation
 * probes, and the public-directory check — and the only thing this module does
 * is gather them and hand the result to `renderStartupSummary`.
 */

import { Effect } from 'effect'
import { LOGIN_RELATIVE_PATH } from '@/application/use-cases/mount/embedded-app-mount'
import { appRequiresEmail } from '@/domain/models/app'
import { mountHref } from '@/domain/models/app/admin/mount-hrefs'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { compileCSS } from '@/infrastructure/css/compiler'
import { renderStartupSummary } from '@/infrastructure/logging/startup-summary'
import { isEmailConfigured } from '@/infrastructure/process/env'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { adminMountsFor } from '@/infrastructure/server/admin-mounts'
import { applyBootstrapTokenToSummary } from '@/infrastructure/server/bootstrap-banner'
import { runDatabaseStartup } from '@/infrastructure/server/startup-database'
import {
  collectAdminPhases,
  collectAiListenerPhases,
  collectAiProviderPhases,
  collectPublicDirPhases,
  collectStoragePhases,
  collectTelemetryPhases,
} from '@/infrastructure/server/startup-degradation-phases'
import type { DatabaseStartupReport } from '@/application/ports/services/server-factory'
import type { App } from '@/domain/models/app'
import type {
  AuthConfigRequiredForUserFields,
  SchemaInitializationError,
} from '@/infrastructure/database/schema/schema-initializer'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { StartupPhase } from '@/infrastructure/logging/startup-summary'
import type { ServerConfig } from '@/infrastructure/server/server-config'

/**
 * Read Sovrium's build version (build-time define, package.json fallback).
 */
const getPackageVersion = (): Effect.Effect<string, never> =>
  // effect-promise: total -- `getSovriumVersion` wraps its `package.json` read in a try/catch and falls back to the build-time define, so it always resolves a string.
  Effect.promise(() => getSovriumVersion())

/**
 * The database rows of the banner, and who actually earned them.
 *
 * Two cases. A `report` means the caller ran the chain for this process already
 * and handed back what it produced — reuse the rows, run nothing; that is what
 * `startServer` does, hoisting the chain ahead of its render pass. Otherwise
 * this IS the process's one run.
 *
 * There is no third case any more. A render no longer creates a server at all
 * (`render-app.ts`), so every caller reaching here is a real boot, and the
 * `ephemeral` branch that used to return no rows has nobody left to take it.
 *
 * SQLite is a real, zero-config database — the historical "DATABASE_URL not
 * set → skip database" branch is gone. The dialect resolver picks PostgreSQL
 * when `DATABASE_URL` is set and SQLite (`./.sovrium/database.db` by default)
 * otherwise; the chain always runs migrations → schema → seeds.
 */
const collectDatabasePhases = (
  app: App,
  report: DatabaseStartupReport | undefined
): Effect.Effect<
  readonly StartupPhase[],
  AuthConfigRequiredForUserFields | SchemaInitializationError | Error
> => {
  if (report) return Effect.succeed(report.phases)
  return runDatabaseStartup(app, parseDatabaseDialectConfig(), false)
}

/**
 * Collect startup phases from infrastructure initialization
 */
const collectInfraPhases = (
  app: App,
  databaseStartup: DatabaseStartupReport | undefined
): Effect.Effect<
  {
    readonly phases: readonly StartupPhase[]
    readonly cssSizeKB: number
    readonly cssLabel: string
  },
  CSSCompilationError | AuthConfigRequiredForUserFields | SchemaInitializationError | Error
> =>
  Effect.gen(function* () {
    const databasePhases = yield* collectDatabasePhases(app, databaseStartup)

    // Admin display phase — emitted right after the database phase so the
    // operator sees the admin email and the data location side-by-side. See
    // `collectAdminPhases` for the three-branch contract (silent on auth-less
    // apps, silent on fresh boots where the bootstrap-token banner is the
    // source of truth, ✓ when an admin exists, ⚠ when users exist but no
    // admin does). [internal ref].
    // effect-promise: total -- `collectAdminPhases` returns early for an app with no auth and otherwise ends its program in `Effect.orElseSucceed(() => [])`; a banner lookup must not regress the rest of the startup pipeline.
    const adminPhases = yield* Effect.promise(() => collectAdminPhases(app))

    // SMTP check — only warn when email is LOAD-BEARING for this app (magic
    // link, email OTP, `requireEmailVerification`, or an `email` automation
    // action) AND SMTP is unconfigured. See `appRequiresEmail` for why a bare
    // `emailAndPassword` app is deliberately not warned. When unconfigured,
    // outgoing email is disabled (journalled in development, logged in
    // production) rather than routed to a local fallback transport.
    const smtpPhases: readonly StartupPhase[] =
      appRequiresEmail(app) && !isEmailConfigured()
        ? [
            {
              label: 'Email sending disabled — SMTP not configured (set SMTP_HOST to enable)',
              type: 'warning' as const,
            },
          ]
        : []

    // AI-provider check — the same shape as the SMTP one and placed beside it
    // on purpose: both name a subsystem the config asked for and the
    // environment did not supply. See collectAiProviderPhases.
    const aiProviderPhases = collectAiProviderPhases(app)

    // Storage check — see collectStoragePhases for the contract.
    const storagePhases = collectStoragePhases(app)

    // Telemetry destinations — a
    // `✓ Telemetry:` line per active signal, host-only, silent when off.
    const telemetryPhases = collectTelemetryPhases()

    // AI-listener degradation notice — see collectAiListenerPhases.
    const aiListenerPhases = collectAiListenerPhases(app)

    // CSS phase
    const cssResult = yield* compileCSS(app)
    const cssSizeKB = Math.round(cssResult.css.length / 1024)
    const cssLabel = cssResult.precompiled
      ? `CSS loaded from file (${cssSizeKB} KB)`
      : `CSS compiled (${cssSizeKB} KB)`

    // NOTE: the AI compute NOTIFY listener is NOT started here any more. It is a
    // scoped layer on the domain runtime (`database/ai-compute-listener.ts`),
    // built a few lines below in `buildDomainRuntimeAndApp` and released by
    // `runtime.dispose()`. `collectAiListenerPhases` above still reports the
    // SQLite degradation, which is a config fact rather than a connection one.
    return {
      phases: [
        ...databasePhases,
        ...adminPhases,
        ...smtpPhases,
        ...aiProviderPhases,
        ...storagePhases,
        ...telemetryPhases,
        ...aiListenerPhases,
      ],
      cssSizeKB,
      cssLabel,
    }
  })

/**
 * The operator console's sign-in address, or `undefined` when there is none
 * worth printing.
 *
 * Nothing on a Sovrium site links to `/_admin` — the console does not advertise
 * its own existence, and `/_admin` itself answers 404 rather than redirecting
 * to its sign-in page. The startup banner is therefore where the address is
 * PUBLISHED, and an operator who does not know to type it has no way to find
 * it.
 *
 * Two conditions, and the row is silent unless both hold:
 *
 * - **The console is served.** `adminMountsFor` already folds the `admin` key
 *   and the `SOVRIUM_ADMIN` kill switch together and answers with the mount or
 *   with nothing, so this reads the decision rather than re-deriving it — and
 *   the list is memoized per app, so asking here costs nothing (the route
 *   registration asked first, during `createHonoApp`).
 * - **The app declares `auth`.** The `admin` key says nothing about auth, so a
 *   console can be mounted with no way to sign into it. Printing its address
 *   then hands the operator a door with no key — the same silent-skip
 *   reasoning that keeps the `✓ Admin:` line off an auth-less banner.
 *
 * [internal ref] (both hold → the row, directly under the URL),
 * [internal ref] (console off), [internal ref] (no auth).
 */
const adminConsoleLocator = (app: App, url: string): string | undefined => {
  if (!app.auth) return undefined
  const [mount] = adminMountsFor(app)
  if (!mount) return undefined
  return `${url}${mountHref(mount.basePath, LOGIN_RELATIVE_PATH)}`
}

/**
 * Render startup summary with version, phases, and server URL.
 *
 * When `bootstrapToken` is defined, `applyBootstrapTokenToSummary` prepends a
 * `⚠ No admin user …` warning phase and attaches a `BootstrapTokenBanner` so
 * the renderer emits a further `→` footer line with the plaintext. The
 * plaintext is shown EXACTLY ONCE and is never routed through the persistent
 * structured logger.
 */
export const renderStartup = (params: {
  readonly app: App
  readonly phases: readonly StartupPhase[]
  readonly url: string
  readonly durationMs: number
  readonly bootstrapToken?: string
}): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const { app, phases, url, durationMs, bootstrapToken } = params
    const version = yield* getPackageVersion()
    const augmented = applyBootstrapTokenToSummary(phases, bootstrapToken)
    const adminConsoleUrl = adminConsoleLocator(app, url)
    yield* renderStartupSummary({
      app: { name: app.name, version: app.version, description: app.description },
      version,
      phases: augmented.phases,
      url,
      durationMs,
      ...(adminConsoleUrl ? { adminConsoleUrl } : {}),
      ...(augmented.bootstrapToken ? { bootstrapToken: augmented.bootstrapToken } : {}),
    })
  })

/** Combine infrastructure phases + the static-asset directory phase. */
export const collectAllPhases = (config: ServerConfig) =>
  Effect.gen(function* () {
    const r = yield* collectInfraPhases(config.app, config.databaseStartup)
    // effect-promise: total -- `collectPublicDirPhases` returns early without a `publicDir` and otherwise guards its single `stat` with `.catch(() => false)`.
    const pd = yield* Effect.promise(() => collectPublicDirPhases(config.publicDir))
    return { ...r, infraPhases: [...r.phases, ...pd] }
  })
