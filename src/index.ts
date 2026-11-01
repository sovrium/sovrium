/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium — Internal Entry Point
 *
 * This file provides:
 * 1. Runtime functions (start, build) used internally by the CLI (src/cli/index.ts)
 * 2. The config-type surface `scripts/build/build-types.ts` extracts to produce the
 *    `declare module 'sovrium'` declaration the binary embeds and `sovrium types`
 *    writes out. That makes the type-export block below a PUBLIC CONTRACT: adding a
 *    name here and to that script's TYPE_EXPORTS is what ships it to config authors.
 *
 * The bare `sovrium` specifier resolves HERE in-repo, via the `paths` alias in
 * tsconfig.json — so `apps/*` configs typecheck against exactly the surface the
 * emitter reads. That is deliberate: a separate alias target was maintained by hand
 * until it drifted, and `AgentConfig`/`ActionTemplate` typechecked in-repo for months
 * while being absent from the shipped declaration. One surface, no drift.
 *
 * This is NOT a public npm library API. Sovrium is distributed as a standalone CLI
 * binary; nothing is published to npm. See src/cli/index.ts for the CLI entry point.
 */

import { Cause, Effect, Exit, Result } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { ServerEnv } from '@/application/ports/services/server-env'
import { ServerFactory } from '@/application/ports/services/server-factory'
import {
  createAdminAccount,
  describeBootstrapDatabaseError,
  type BootstrapDatabaseError,
  type InvalidEmailError,
  type WeakPasswordError,
} from '@/application/use-cases/auth/bootstrap-admin'
import { resetAccountPasswords } from '@/application/use-cases/auth/reset-account-password'
import {
  createSeedUnclaimedAccounts,
  issueSeedInvitations,
  type SeedInvitationOutcome,
  type SeedInvitee,
  type SeedUnclaimedAccount,
  type SeedUnclaimedOutcome,
} from '@/application/use-cases/auth/seed-invitations'
import { decodeAppConfigObject } from '@/application/use-cases/config/decode-app-config'
import {
  extractCodeActionRefusal,
  findCodeActionRefusalInCause,
  validateCodeActionBodies,
} from '@/application/use-cases/config/validate-code-actions'
import { buildDesignSystemBundle as buildDesignSystemBundleUseCase } from '@/application/use-cases/design/bundle'
import {
  buildDesignSystemBundleWithPages,
  type PageExportSelection,
} from '@/application/use-cases/design/pages'
import { generateSearchIndex } from '@/application/use-cases/server/generate-search-index'
import { generateStatic as generateStaticUseCase } from '@/application/use-cases/server/generate-static'
import { prebuildSearchIndex as prebuildSearchIndexUseCase } from '@/application/use-cases/server/prebuild-search-index'
import { startServer } from '@/application/use-cases/server/start-server'
import { refuseUndersizedDatabaseBudget } from '@/application/use-cases/server/validate-boot-environment'
import { ConfigRejectedError, isConfigRejectedError } from '@/domain/errors/config-rejected'
import { EngineFailureError } from '@/domain/errors/engine-failure-error'
import { InjectedFaultError } from '@/domain/errors/injected-fault-error'
import { isDatabaseUnreachable } from '@/domain/errors/unreachable-database-error'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { getPublicPagePaths } from '@/domain/models/app/pages/public-pages'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { parseFaultInjection } from '@/domain/models/process-env/fault-injection'
import { provisionRootSecret } from '@/infrastructure/crypto/root-secret'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import {
  createAppLayer,
  createDesignBundleLayer,
  createStaticBuildLayer,
  runEachInAppLayer,
} from '@/infrastructure/layers/app-layer'
import { formatRuntimeError, logDebug } from '@/infrastructure/logging'
import { withIdleExit } from '@/infrastructure/server/idle-exit'
import { installShutdownHandlers, requestGracefulStop } from '@/infrastructure/server/lifecycle'
import type { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import type { PasswordReset } from '@/application/ports/services/account-provisioner'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type {
  DecodeAppConfigOptions,
  DecodeAppConfigResult,
} from '@/application/use-cases/config/decode-app-config'
import type { DesignSystemBundle } from '@/application/use-cases/design/bundle'
import type {
  GenerateStaticOptions,
  GenerateStaticResult,
} from '@/application/use-cases/server/generate-static'
import type { StartOptions } from '@/application/use-cases/server/start-server-options'
import type { App, AppEncoded } from '@/domain/models/app'
import type { AuthoredTableIds } from '@/domain/models/app/tables/authored-table-ids-service'

// ============================================================================
// Internal Runtime API (used by src/cli/index.ts — NOT a public npm API)
// ============================================================================

/** Simple server interface with Promise-based methods. */
export interface SimpleServer {
  readonly url: string
  /**
   * The port the listener ACTUALLY bound to, which is not necessarily the one
   * that was asked for: `PORT=0` asks the kernel to choose, and a bind retries
   * on an OS-assigned port when the requested one is taken. `--watch` needs the
   * result rather than the request, so a full restart rebinds the port the
   * operator's browser tab is already pointed at.
   */
  readonly port: number
  /**
   * The DECODED config this server is running. `--watch` diffs it against the
   * config a save produced to decide whether that save can be swapped in place
   * (`classifyConfigChange`); without it the first edit of a session would have
   * nothing to compare against.
   */
  readonly config: App
  stop: () => Promise<void>
  /**
   * Swap the request handler in place, keeping the listener bound. The
   * Promise-shaped view of `ServerInstance.reload` — see that member for what
   * a swap does and does not re-run.
   */
  reload: (app: App, configHash?: string) => Promise<void>
}

/** Convert Effect-based ServerInstance to simple Promise-based interface. */
const toSimpleServer = (server: Readonly<ServerInstance>, config: App): SimpleServer => ({
  url: server.url,
  port: server.server.port ?? 0,
  config,
  stop: () => Effect.runPromise(server.stop),
  reload: (app, configHash) => Effect.runPromise(server.reload(app, configHash)),
})

/**
 * Run a config through the shared decode pipeline, throwing on refusal.
 *
 * `start` and `build` read the same file `sovrium validate` reads, and now read
 * it identically: same normalization, same post-decode semantic checks, and —
 * since the excess-property flip — the same refusal of a property AppSchema
 * does not declare. There is no per-call-site policy left to pass; the shared
 * decoder's `onExcessProperty: 'error'` default IS the contract.
 *
 * The refusal is thrown as {@link ConfigRejectedError} rather than a plain
 * `Error` so the CLI prints the report instead of a stack — see that type.
 */
const decodeOrThrow = (
  app: AppEncoded,
  attribution: DecodeAppConfigOptions = {}
): Extract<DecodeAppConfigResult, { valid: true }> => {
  const decoded = decodeAppConfigObject(app, attribution)
  if (!decoded.valid) {
    // The REPORT, not the flat list: the same count, grouping and ceiling
    // `sovrium validate` prints, so the three commands print one report.
    throw new ConfigRejectedError(decoded.report.join('\n'))
  }
  return decoded
}

/**
 * The non-production `SOVRIUM_FAULT_INJECTION=start` seam: fail the start here,
 * inside its startup and after the configuration validated, with an error
 * Sovrium has no handling for — the path that offers a bug report.
 */
const failStartIfInjected = (): void => {
  const fault = parseFaultInjection(process.env)
  if (fault?.kind !== 'start') return
  throw new InjectedFaultError({
    value: fault.value,
    command: 'start',
    cwd: process.cwd(),
    detail: fault.detail,
  })
}

/**
 * Start a Sovrium server. Used internally by the CLI start command.
 */
export const start = async (
  app: AppEncoded,
  options: StartOptions = {},
  attribution: DecodeAppConfigOptions = {}
): Promise<SimpleServer> => {
  try {
    const { raw: rawApp, app: validatedApp } = decodeOrThrow(app, attribution)
    failStartIfInjected()

    // Resolve the root secret before anything derives from it. Every later
    // consumer (the auth signing secret, token encryption, signed storage URLs)
    // reads the same memo, so doing it once here is what makes the outcome — and
    // the banner line reporting it — consistent for the whole boot. It is also
    // the only place a failure to WRITE the key can be reported as a refusal to
    // start rather than as a mid-boot surprise.
    provisionRootSecret()

    const startServerWithLayers = Effect.gen(function* () {
      const started = yield* startServer(rawApp, options)
      // `SOVRIUM_IDLE_EXIT_SECONDS`: the same graceful stop, once nobody uses
      // the server. The monitor belongs to this server: its stop ends it, so a
      // `--watch` restart arms the next server's afresh (`idle-exit.ts`).
      const idleSeconds = (yield* ServerEnv).idleExitSeconds
      const server =
        idleSeconds === undefined
          ? started
          : yield* withIdleExit(started, validatedApp, idleSeconds, requestGracefulStop)
      // Registered on THIS fiber, deliberately. A handler forked into a child
      // that parks on `Effect.never` would be interrupted when its parent
      // completes (Effect 4), so `process.on(...)` would never run and the
      // server would ignore SIGTERM outright. `installShutdownHandlers`
      // registers and returns — there is no fiber left to interrupt.
      yield* installShutdownHandlers(server)
      return server
    }).pipe(Effect.provide(createAppLayer(validatedApp.auth)))
    // The connection budget is checked before the layers are built: the
    // storage layer checks the database as it is built, and a start this
    // refuses must open no connection. `startServer` checks it again, for any
    // other composition of it.
    const program = refuseUndersizedDatabaseBudget(validatedApp).pipe(
      Effect.andThen(startServerWithLayers)
    )

    // EFFECT 4: run for an `Exit` rather than a Promise rejection, so the
    // code-action guard reads the CAUSE instead of whatever `Cause.squash`
    // chose to surface. v4's `runPromise` does reject with the squashed error
    // value (v3's `FiberFailure` wrapper is gone), and for this pipeline that
    // value is always the right one — `startServer` type-checks code actions in
    // one sequential step. Depending on that is the part worth removing: a
    // cause carrying more than one reason squashes to one of them, and if it
    // picks the other, an author's type error silently becomes "please open an
    // issue" again. Searching the reasons costs nothing and does not care.
    const exit = await Effect.runPromiseExit(program)
    if (Exit.isFailure(exit)) {
      const causeRefusal = findCodeActionRefusalInCause(exit.cause)
      if (causeRefusal !== undefined) throw new ConfigRejectedError(causeRefusal)
      // Everything else keeps the exact value the old `runPromise` rejected
      // with, so the catch block below is unchanged in what it receives.
      throw Cause.squash(exit.cause)
    }
    return toSimpleServer(exit.value, validatedApp)
  } catch (error) {
    // A refused config is already an author-readable report. Enriching it with
    // a stack and an issue link would tell the author to file a bug about their
    // own typo, so it passes through untouched — see `ConfigRejectedError`.
    if (isConfigRejectedError(error)) throw error
    // A code action that does not type-check is the same kind of thing: an
    // author's mistake in their own config, not an engine fault. It arrives
    // here as a `TSValidationError` inside Effect's `FiberFailure` rather than
    // as a `ConfigRejectedError` — a tagged error cannot extend that class too —
    // so without this it would fall through to the "please open an issue"
    // wrapper below and send the author to file a bug about their own typo.
    // Re-raise it as the refusal it is.
    const codeActionRefusal = extractCodeActionRefusal(error)
    if (codeActionRefusal !== undefined) throw new ConfigRejectedError(codeActionRefusal)
    // Anything else is a failure Sovrium did not foresee. The CLI offers the
    // prefilled bug report for it, built from `failure` (its class and stack).
    throw new EngineFailureError(`Sovrium failed to start: ${formatRuntimeError(error)}`, error)
  }
}

/**
 * Run the process-wide startup chains a build needs, exactly once, before its
 * render pass.
 *
 * The render pass creates no server at all — `buildRenderApp` binds nothing and
 * runs neither chain — so this call is the only place either one happens, once
 * per build rather than once per supported language, and it has to come first:
 * the tables a `dataSource`-bound page renders against must exist before
 * anything renders.
 *
 * `ephemeral: true` on the receipt-producing call, because a build starts
 * nothing — it emits a site and exits — so it records no boot-ledger row. The
 * receipt itself is discarded: a
 * build prints no startup banner, so there are no rows to carry.
 */
const runBuildStartupOnce = (validatedApp: App, authoredTableIds: AuthoredTableIds) =>
  Effect.gen(function* () {
    const serverFactory = yield* ServerFactory
    yield* serverFactory.startDatabase(validatedApp, { ephemeral: true, authoredTableIds })
    yield* serverFactory.runDeferredMaintenance(validatedApp)
  })

/**
 * Build static site files. Used internally by the CLI build command.
 */
export const build = async (
  app: AppEncoded,
  options: GenerateStaticOptions = {},
  attribution: DecodeAppConfigOptions = {}
): Promise<GenerateStaticResult> => {
  try {
    // `generateStatic` re-decodes the config it is handed, so it must receive
    // the same object `decodeOrThrow` validated — not a separately-parsed one.
    const { raw: rawApp, app: validatedApp, authoredTableIds } = decodeOrThrow(app, attribution)

    // A static build never executes an automation, so refusing a code action
    // that does not type-check buys this command nothing on its own. It is here
    // because the contract is that all three commands agree on what a valid
    // config IS: `build` emitting a complete site for a config `start` refuses
    // is the same divergence as `validate` passing it, and a command that
    // disagrees is the next one to be found disagreeing by a user.
    const codeActionErrors = await validateCodeActionBodies(validatedApp)
    if (codeActionErrors.length > 0) {
      throw new ConfigRejectedError(codeActionErrors.join('\n'))
    }

    const program = Effect.gen(function* () {
      yield* runBuildStartupOnce(validatedApp, authoredTableIds)
      logDebug('[ssg] generating static site...')
      const result = yield* generateStaticUseCase(rawApp, options)
      logDebug(`[ssg] static site generated to ${result.outputDir} (${result.files.length} files)`)

      // Activation gate for the public-pages search feature: only run the
      // search indexer when a page-scoped `search-input` component is present
      // somewhere in the page tree. Absent the component, no
      // `<outputDir>/sovrium-search/` directory is emitted.
      // See: src/domain/models/app/pages/has-page-search.ts
      if (hasPageSearchComponent(validatedApp)) {
        // Single source of truth: same filter the static-language-generators
        // apply (underscore-prefix + non-public access excluded — see
        // The pages public search requirement). Drift here would re-introduce the
        // access-leak regression.
        const publicPagePaths = getPublicPagePaths(validatedApp.pages)

        const searchResult = yield* generateSearchIndex({
          inputDir: result.outputDir,
          outputDir: result.outputDir,
          publicPagePaths,
        })

        return {
          outputDir: result.outputDir,
          files: [...result.files, ...searchResult.files],
        }
      }

      return result
    }).pipe(Effect.provide(createStaticBuildLayer))

    return await Effect.runPromise(program)
  } catch (error) {
    // Same reasoning as `start`: a refusal is the author's to read, not a bug
    // report about Sovrium.
    if (isConfigRejectedError(error)) throw error
    // No `cause`: the message already embeds the inner error, and a cause would
    // make logError render the inner chain (and any query parameters it
    // carries) on every failed build. The original rides as `failure`, which
    // the logger does not render, for the bug report the CLI offers.
    throw new EngineFailureError(`Sovrium failed to build: ${formatRuntimeError(error)}`, error)
  }
}

/**
 * Pre-build the public-pages search artifacts into a `publicDir` so a running
 * server can serve `/sovrium-search/index.json` and `/sovrium-search/runtime.js`
 * via the static-asset route.
 *
 * THIS IS NO LONGER ON THE BOOT PATH. `startServer` runs the same indexer
 * itself, as a step of its boot sequence, so every caller of it gets the
 * artifacts — see `application/use-cases/server/prebuild-search-index.ts`. What
 * remains here is the standalone entry point: the `--watch` reload path calls
 * it to re-emit the index after a config change (via `buildSearchIndex` in
 * `cli/commands/reload-server.ts`), where there is no boot to hang the work on, and it
 * stays part of the published `sovrium` specifier surface.
 *
 * Trade-off (v1): the full `generateStatic` pipeline (CSS, hydration, asset
 * copies, optimizations) runs into a temp dir rather than a leaner "HTML-only"
 * pass. The indexer only reads HTML, so the rest is wasted — but factoring
 * that out across `generate-static.ts`'s seven steps is a larger refactor, and
 * the waste only happens when a page-scoped `search-input` component is present.
 *
 * @param app - Raw application config (validated identically to `build()` /
 *              `start()`).
 * @param publicDir - Directory that will be served. `sovrium-search/` is
 *                    written under it; the caller guarantees it matches what
 *                    the server actually serves.
 * @returns `true` when the indexer ran (artifacts were written), `false` when
 *          the activation gate is closed (no page-scoped `search-input` component).
 */
export const prebuildSearchIndex = async (app: AppEncoded, publicDir: string): Promise<boolean> => {
  const { raw: rawApp, app: validatedApp } = decodeOrThrow(app)
  return Effect.runPromise(
    prebuildSearchIndexUseCase(rawApp, validatedApp, publicDir).pipe(
      Effect.provide(createStaticBuildLayer)
    )
  )
}

/**
 * Build the portable design-system bundle of a DECODED app, offline. Used
 * internally by `sovrium design-system --format bundle`, which validates the
 * config first and writes the files.
 *
 * Runs in the static-build layer — the page renderer, the stylesheet compiler
 * and the embedded files the bundle copies; no database, no auth.
 */
export const buildDesignSystemBundle = (
  app: App,
  options: { readonly publicDir?: string; readonly pages?: PageExportSelection } = {}
): Promise<DesignSystemBundle> =>
  Effect.runPromise(
    // The app's own logo files are read from its public directory, when the
    // caller names one; everything else comes from the binary. The pages are
    // added only when asked for (`--pages`).
    (options.pages === undefined
      ? buildDesignSystemBundleUseCase(app)
      : buildDesignSystemBundleWithPages(app, options.pages)
    ).pipe(Effect.provide(createDesignBundleLayer(options.publicDir)))
  )

/** Credentials for `createAdmin`. */
export interface CreateAdminCredentials {
  readonly email: string
  readonly password: string
  readonly name?: string
}

/** Result of `createAdmin` — never throws for expected failures (mirrors `validateConfig`). */
export type CreateAdminResult =
  | { readonly ok: true; readonly created: boolean; readonly email: string }
  | {
      readonly ok: false
      readonly message: string
      /**
       * The failure was the database being UNREACHABLE, not it rejecting the
       * request. Classified here — by driver code, via `isDatabaseUnreachable` —
       * because this is the last place the error OBJECT exists; `message` alone
       * cannot answer it, and the CLI's previous attempt to do so from message
       * fragments was wrong in both directions (see the doc comment on
       * `UNREACHABLE_DRIVER_CODES`).
       */
      readonly databaseUnreachable?: boolean
    }

/**
 * Create an admin user from explicit credentials. Used internally by the CLI
 * `sovrium admin create` command.
 *
 * Mirrors `start`: validates the app, then runs migrations + the create-admin
 * use case inside the full app layer. Expected failures (auth not configured,
 * invalid email, weak password, duplicate user) are returned as a typed result
 * rather than thrown, so the CLI can print actionable messages.
 */
export const createAdmin = async (
  app: AppEncoded,
  credentials: CreateAdminCredentials
): Promise<CreateAdminResult> => {
  try {
    const { app: validatedApp } = decodeOrThrow(app)
    if (!validatedApp.auth) {
      return {
        ok: false,
        message:
          'Auth is not configured for this app. Add an `auth:` block to your config before creating an admin.',
      }
    }
    const [result] = await createAccounts(validatedApp, [
      { ...credentials, name: credentials.name ?? 'Administrator', role: 'admin' },
    ])
    return result ?? { ok: false, message: 'No account was created.' }
  } catch (error) {
    // Defects (e.g. a config that does not decode) bypass the typed channel.
    return {
      ok: false,
      message: formatRuntimeError(error),
      databaseUnreachable: isDatabaseUnreachable(error),
    }
  }
}

/** One account for {@link createAccounts}: credentials plus the role it is created with. */
export interface CreateAccountCredentials {
  readonly email: string
  readonly password: string
  readonly name: string
  readonly role: string
}

/** The operator-facing message for an expected account-creation failure. */
const describeAccountFailure = (
  error: Readonly<
    InvalidEmailError | WeakPasswordError | BootstrapDatabaseError | AuthDatabaseError
  >
): string =>
  error._tag === 'InvalidEmailError'
    ? `Invalid email address: ${error.email}`
    : error._tag === 'WeakPasswordError'
      ? error.message
      : error._tag === 'BootstrapDatabaseError'
        ? describeBootstrapDatabaseError(error)
        : formatRuntimeError(error)

/**
 * Create sign-in accounts, each with its own role, against an already-decoded
 * app. The path `sovrium admin create` takes, run once for a list — so
 * `sovrium seed` gives `seed/users.yaml` accounts the same credential, the same
 * verified-email handling and the same idempotency: an email that already has
 * an account reports `created: false` and is left unchanged.
 *
 * Results come back in input order. Expected failures are returned, not thrown.
 */
export const createAccounts = (
  app: Readonly<App>,
  accounts: readonly CreateAccountCredentials[]
): Promise<readonly CreateAdminResult[]> =>
  runEachInAppLayer(
    app.auth,
    accounts,
    Effect.gen(function* () {
      yield* runMigrations(parseDatabaseDialectConfig(yield* ProcessEnv))
      return yield* Effect.forEach(accounts, (account) =>
        createAdminAccount(app, account).pipe(
          Effect.result,
          Effect.map((result): CreateAdminResult =>
            Result.isSuccess(result)
              ? { ok: true, created: !result.success.alreadyExists, email: account.email }
              : {
                  ok: false,
                  message: describeAccountFailure(result.failure),
                  databaseUnreachable: isDatabaseUnreachable(result.failure),
                }
          )
        )
      )
    }),
    {
      noAuth:
        'Auth is not configured for this app. Add an `auth:` block to your config before creating an account.',
      // A defect (e.g. a migration connection failure) bypasses the typed channel.
      item: (_account, message, error): CreateAdminResult => ({
        ok: false,
        message,
        databaseUnreachable: isDatabaseUnreachable(error),
      }),
    }
  )

/** One account a seed run could not create or invite. */
type SeedAccountFailure = { readonly ok: false; readonly email: string; readonly message: string }

/** Every email fails alike: no auth, or a defect stopped the run. */
const seedAccountFailure = {
  noAuth: 'Auth is not configured for this app.',
  item: ({ email }: { readonly email: string }, message: string): SeedAccountFailure => ({
    ok: false,
    email,
    message,
  }),
}

/**
 * Issue pending invitations against an already-decoded app, sending nothing:
 * the path `sovrium seed` takes for a `seed/users.yaml` entry with
 * `invited: true`. Each invitee gets an account with no credential and a
 * stored token; each outcome carries the invitation link under `origin`, for
 * the caller to print once. Expected failures are returned, not thrown.
 */
export const inviteAccounts = (
  app: Readonly<App>,
  invitees: readonly SeedInvitee[],
  origin: string
): Promise<readonly SeedInvitationOutcome[]> =>
  runEachInAppLayer(
    app.auth,
    invitees,
    issueSeedInvitations({ app, invitees, origin }),
    seedAccountFailure
  )

/**
 * Create unclaimed accounts against an already-decoded app: the path
 * `sovrium seed` takes for a `seed/users.yaml` entry with `unclaimed: true`.
 * Each gets an account with no credential and no invitation; nothing is sent
 * and nothing is printed. Expected failures are returned, not thrown.
 */
export const createUnclaimedAccounts = (
  app: Readonly<App>,
  accounts: readonly SeedUnclaimedAccount[]
): Promise<readonly SeedUnclaimedOutcome[]> =>
  runEachInAppLayer(
    app.auth,
    accounts,
    createSeedUnclaimedAccounts({ accounts }),
    seedAccountFailure
  )

/**
 * Give existing accounts a new password each and sign their sessions out: the
 * path `sovrium admin reset-password` takes. An address with no account is
 * refused (`unknownAccount`) and nothing is created. Failures are returned.
 */
export const resetPasswords = (app: Readonly<App>, resets: readonly PasswordReset[]) =>
  runEachInAppLayer(app.auth, resets, resetAccountPasswords(resets), seedAccountFailure)

// ============================================================================
// Type Exports (consumed by scripts/build/build-types.ts → the shipped sovrium.d.ts)
// ============================================================================
//
// The config types live in `src/domain/models/config-types/`; this file
// re-exports them so `build-types.ts` reads ONE entry and the in-repo
// `sovrium` path alias resolves the same surface the declaration ships.

export type {
  AgentConfig,
  AnalyticsConfig,
  AppConfig,
  AuthConfig,
  ComponentConfig,
  ConnectionConfig,
  DesignConfig,
  EnvConfig,
  FormConfig,
  LanguageConfig,
  PageConfig,
  TableConfig,
  ThemeConfig,
} from '@/domain/models/config-types/app-config'
export type {
  ActionTemplate,
  AuthoredAutomationAction,
  AutomationConfig,
} from '@/domain/models/config-types/automation-config'
export type { CodeContext, CodeContextActions } from '@/domain/models/config-types/code-context'

// Re-export function parameter and return types
export type { StartOptions, GenerateStaticOptions, GenerateStaticResult }

// ============================================================================
// Removed: `validateConfig` and the `generateAppJsonSchema` re-export
// ============================================================================
//
// `validateConfig` was a FOURTH config contract — lenient, and it
// returned the caller's original object rather than the decoded one, so its
// `{ valid: true }` said nothing about what would actually run. It had zero
// call sites anywhere in this repository. Config validation now has exactly one
// implementation, `decodeAppConfigObject`
// (`@/application/use-cases/config/decode-app-config`), reachable from a shell
// as `sovrium validate` and run implicitly by `sovrium start` / `sovrium build`.
//
// `generateAppJsonSchema` here was a dead re-export of
// `@/domain/services/json-schema`, which the `sovrium schema` command and the
// schema-drift check import directly.
