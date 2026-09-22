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
import { ServerFactory } from '@/application/ports/services/server-factory'
import { createAdminAccount } from '@/application/use-cases/auth/bootstrap-admin'
import { decodeAppConfigObject } from '@/application/use-cases/config/decode-app-config'
import {
  extractCodeActionRefusal,
  findCodeActionRefusalInCause,
  validateCodeActionBodies,
} from '@/application/use-cases/config/validate-code-actions'
import { generateSearchIndex } from '@/application/use-cases/server/generate-search-index'
import { generateStatic as generateStaticUseCase } from '@/application/use-cases/server/generate-static'
import { prebuildSearchIndex as prebuildSearchIndexUseCase } from '@/application/use-cases/server/prebuild-search-index'
import { startServer } from '@/application/use-cases/server/start-server'
import { ConfigRejectedError, isConfigRejectedError } from '@/domain/errors/config-rejected'
import { isDatabaseUnreachable } from '@/domain/errors/driver-failure'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { getPublicPagePaths } from '@/domain/models/app/pages/public-pages'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { provisionRootSecret } from '@/infrastructure/crypto/root-secret'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { createAppLayer, createStaticBuildLayer } from '@/infrastructure/layers/app-layer'
import { formatRuntimeError, logDebug } from '@/infrastructure/logging'
import { installShutdownHandlers } from '@/infrastructure/server/lifecycle'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type { DecodeAppConfigResult } from '@/application/use-cases/config/decode-app-config'
import type {
  GenerateStaticOptions,
  GenerateStaticResult,
} from '@/application/use-cases/server/generate-static'
import type { StartOptions } from '@/application/use-cases/server/start-server'
import type { App, AppEncoded } from '@/domain/models/app'
import type { ActionTemplate as ActionTemplateModel } from '@/domain/models/app/actions'
import type { Agent } from '@/domain/models/app/agents'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'
import type { Auth } from '@/domain/models/app/auth'
import type { Automation } from '@/domain/models/app/automations'
import type { Action as AutomationActionUnion } from '@/domain/models/app/automations/actions'
import type { ComponentTemplate } from '@/domain/models/app/components/component'
import type { Connection } from '@/domain/models/app/connections'
import type { Design } from '@/domain/models/app/design'
import type { EnvVar } from '@/domain/models/app/env'
import type { Form } from '@/domain/models/app/forms'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Table } from '@/domain/models/app/tables'

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
const decodeOrThrow = (app: AppConfig): Extract<DecodeAppConfigResult, { valid: true }> => {
  const decoded = decodeAppConfigObject(app)
  if (!decoded.valid) {
    // eslint-disable-next-line functional/no-throw-statements -- surfaced by the caller's catch
    throw new ConfigRejectedError(decoded.errors.join('\n'))
  }
  return decoded
}

/**
 * Start a Sovrium server. Used internally by the CLI start command.
 */
export const start = async (app: AppConfig, options: StartOptions = {}): Promise<SimpleServer> => {
  try {
    const { raw: rawApp, app: validatedApp } = decodeOrThrow(app)

    // Resolve the root secret before anything derives from it. Every later
    // consumer (the auth signing secret, token encryption, signed storage URLs)
    // reads the same memo, so doing it once here is what makes the outcome — and
    // the banner line reporting it — consistent for the whole boot. It is also
    // the only place a failure to WRITE the key can be reported as a refusal to
    // start rather than as a mid-boot surprise.
    // eslint-disable-next-line functional/no-expression-statements -- boot-time provisioning; the resolved value is read from the memo by every later consumer
    provisionRootSecret()

    const program = Effect.gen(function* () {
      const server = yield* startServer(rawApp, options)
      // Registered on THIS fiber, deliberately. The handler used to be forked
      // into a child that parked on `Effect.never`; Effect 4 interrupts a child
      // when its parent completes, so `process.on(...)` never ran and the
      // server ignored SIGTERM outright. `installShutdownHandlers` registers
      // and returns — there is no fiber left to interrupt.
      yield* installShutdownHandlers(server)
      return server
    }).pipe(Effect.provide(createAppLayer(validatedApp.auth)))

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
      // eslint-disable-next-line functional/no-throw-statements -- re-throw as a config refusal
      if (causeRefusal !== undefined) throw new ConfigRejectedError(causeRefusal)
      // Everything else keeps the exact value the old `runPromise` rejected
      // with, so the catch block below is unchanged in what it receives.
      // eslint-disable-next-line functional/no-throw-statements -- re-raise the squashed failure verbatim
      throw Cause.squash(exit.cause)
    }
    return toSimpleServer(exit.value, validatedApp)
  } catch (error) {
    // A refused config is already an author-readable report. Enriching it with
    // a stack and an issue link would tell the author to file a bug about their
    // own typo, so it passes through untouched — see `ConfigRejectedError`.
    // eslint-disable-next-line functional/no-throw-statements -- re-throw the refusal verbatim
    if (isConfigRejectedError(error)) throw error
    // A code action that does not type-check is the same kind of thing: an
    // author's mistake in their own config, not an engine fault. It arrives
    // here as a `TSValidationError` inside Effect's `FiberFailure` rather than
    // as a `ConfigRejectedError` — a tagged error cannot extend that class too —
    // so it used to fall through to the "please open an issue" wrapper below and
    // send the author to file a bug about their own typo. Re-raise it as the
    // refusal it is.
    const codeActionRefusal = extractCodeActionRefusal(error)
    // eslint-disable-next-line functional/no-throw-statements -- re-throw as a config refusal
    if (codeActionRefusal !== undefined) throw new ConfigRejectedError(codeActionRefusal)
    const message = formatRuntimeError(error)
    // eslint-disable-next-line functional/no-throw-statements -- re-throw with enriched message
    throw new Error(
      `Sovrium failed to start: ${message}\n\n` +
        `If this looks like a bug, please open an issue:\n` +
        `  https://github.com/sovrium/sovrium/issues/new`
    )
  }
}

/**
 * Run the process-wide startup chains a build needs, exactly once, before its
 * render pass.
 *
 * `build` used to run no migrations of its own: the database reached the chain
 * ONLY through the throwaway servers the render pass booted, so a build
 * migrated once per supported language plus once for the root index — two runs
 * for the single-language case, and it scaled with the language count
 *. The render pass creates no server at all
 * now — `buildRenderApp` binds nothing and runs neither chain — so this call is
 * the only place either one happens, and it has to come first: the tables a
 * `dataSource`-bound page renders against must exist before anything renders
 *.
 *
 * `ephemeral: true` on the receipt-producing call, because a build starts
 * nothing — it emits a site and exits — so it records no boot-ledger row, which
 * is also what it did before this hoist. The receipt itself is discarded: a
 * build prints no startup banner, so there are no rows to carry.
 */
const runBuildStartupOnce = (validatedApp: App) =>
  Effect.gen(function* () {
    const serverFactory = yield* ServerFactory
    yield* serverFactory.startDatabase(validatedApp, { ephemeral: true })
    yield* serverFactory.runDeferredMaintenance(validatedApp)
  })

/**
 * Build static site files. Used internally by the CLI build command.
 */
export const build = async (
  app: AppConfig,
  options: GenerateStaticOptions = {}
): Promise<GenerateStaticResult> => {
  try {
    // `generateStatic` re-decodes the config it is handed, so it must receive
    // the same object `decodeOrThrow` validated — not a separately-parsed one.
    const { raw: rawApp, app: validatedApp } = decodeOrThrow(app)

    // A static build never executes an automation, so refusing a code action
    // that does not type-check buys this command nothing on its own. It is here
    // because the contract is that all three commands agree on what a valid
    // config IS: `build` emitting a complete site for a config `start` refuses
    // is the same divergence as `validate` passing it, and a command that
    // disagrees is the next one to be found disagreeing by a user.
    const codeActionErrors = await validateCodeActionBodies(validatedApp)
    if (codeActionErrors.length > 0) {
      // eslint-disable-next-line functional/no-throw-statements -- surfaced by the caller's catch
      throw new ConfigRejectedError(codeActionErrors.join('\n'))
    }

    const program = Effect.gen(function* () {
      yield* runBuildStartupOnce(validatedApp)
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
        // [internal ref]). Drift here would re-introduce the
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
    // eslint-disable-next-line functional/no-throw-statements -- re-throw the refusal verbatim
    if (isConfigRejectedError(error)) throw error
    const message = formatRuntimeError(error)
    // eslint-disable-next-line functional/no-throw-statements -- re-throw with enriched message
    throw new Error(
      `Sovrium failed to build: ${message}\n\n` +
        `If this looks like a bug, please open an issue:\n` +
        `  https://github.com/sovrium/sovrium/issues/new`
    )
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
 * `cli/commands/utils.ts`), where there is no boot to hang the work on, and it
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
export const prebuildSearchIndex = async (app: AppConfig, publicDir: string): Promise<boolean> => {
  const { raw: rawApp, app: validatedApp } = decodeOrThrow(app)
  return Effect.runPromise(
    prebuildSearchIndexUseCase(rawApp, validatedApp, publicDir).pipe(
      Effect.provide(createStaticBuildLayer)
    )
  )
}

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
  app: AppConfig,
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

    const program = Effect.gen(function* () {
      yield* runMigrations(parseDatabaseDialectConfig())
      return yield* createAdminAccount(validatedApp, {
        email: credentials.email,
        password: credentials.password,
        name: credentials.name ?? 'Administrator',
      })
    }).pipe(Effect.provide(createAppLayer(validatedApp.auth)), Effect.result)

    const result = await Effect.runPromise(program)

    if (Result.isSuccess(result)) {
      return { ok: true, created: !result.success.alreadyExists, email: credentials.email }
    }

    const error = result.failure
    const message =
      error._tag === 'InvalidEmailError'
        ? `Invalid email address: ${error.email}`
        : error._tag === 'WeakPasswordError'
          ? error.message
          : error._tag === 'BootstrapDatabaseError'
            ? error.cause instanceof Error
              ? error.cause.message
              : String(error.cause)
            : formatRuntimeError(error)
    return { ok: false, message, databaseUnreachable: isDatabaseUnreachable(error) }
  } catch (error) {
    // Defects (e.g. migration connection failure) bypass the typed channel.
    return {
      ok: false,
      message: formatRuntimeError(error),
      databaseUnreachable: isDatabaseUnreachable(error),
    }
  }
}

// ============================================================================
// Type Exports (consumed by scripts/build/build-types.ts → the shipped sovrium.d.ts)
// ============================================================================

/** Application configuration type for YAML/JSON/TypeScript config files. */
export type AppConfig = AppEncoded

/** Single page configuration (element of `AppConfig['pages']`). */
export type PageConfig = Page

/** Single table configuration (element of `AppConfig['tables']`). */
export type TableConfig = Table

/** Reusable component template (element of `AppConfig['components']`). */
export type ComponentConfig = ComponentTemplate

/**
 * Design / design tokens configuration.
 *
 * The canonical position is `AppConfig['design']['design']`; top-level
 * `AppConfig['design']` is a deprecated alias for the same type, removed at the
 * next major. The alias here is unchanged — one type serves both positions.
 */
export type ThemeConfig = Design

/** Design-system configuration (`AppConfig['design']`) — tokens, principles, voice, usage rules. */
export type DesignConfig = Design

/** Authentication configuration (`AppConfig['auth']`). */
export type AuthConfig = Auth

/** Multi-language configuration (`AppConfig['languages']`). */
export type LanguageConfig = Languages

/** Built-in analytics configuration (`AppConfig['analytics']`). */
export type AnalyticsConfig = BuiltInAnalytics

/** Single automation configuration (element of `AppConfig['automations']`). */
export type AutomationConfig = Automation

/** Single external connection configuration (element of `AppConfig['connections']`). */
export type ConnectionConfig = Connection

/** Single form configuration (element of `AppConfig['forms']`). */
export type FormConfig = Form

/** Single env-var declaration (element of `AppConfig['env']`). */
export type EnvConfig = EnvVar

/** Single autonomous AI agent configuration (element of `AppConfig['agents']`). */
export type AgentConfig = Agent

/**
 * Reusable action template (element of `AppConfig['actions']`).
 *
 * Deliberately NOT named `ActionConfig`, which the `*Config` convention above would
 * suggest: `ActionTemplate` is already the public name every config author writes,
 * and one public name per concept beats naming symmetry.
 */
export type ActionTemplate = ActionTemplateModel

// Re-export function parameter and return types
export type { StartOptions, GenerateStaticOptions, GenerateStaticResult }

// ============================================================================
// Sandbox action surface (`CodeContext['actions']`)
// ============================================================================

/**
 * The action families callable from a `code` action body, DERIVED from the
 * automation action schemas rather than restated by hand.
 *
 * WHY DERIVED, AND WHY CLOSED
 * ---------------------------
 * `actions` used to be an open index signature:
 *
 *   { ref: … } & Record<string, Record<string, (props?: Record<string, unknown>) => Promise<any>>>
 *
 * Two things were wrong with it, and the second is the one that made the first
 * unavoidable. `sovrium types` emits a `tsconfig.json` setting
 * `noUncheckedIndexedAccess: true`, and under that flag every index-signature
 * access gains `| undefined` — so the call the docs give,
 * `context.actions.http.request({…})`, produced TS18048 + TS2722 against the very
 * tsconfig the same command wrote. And an open signature accepts
 * `context.actions.record.lst({})` — a typo for `list` — which then fails at
 * runtime with nothing having warned.
 *
 * Closing it fixes both at once, and deriving it means the closed surface cannot
 * fall behind the schema the way a hand-written list would.
 *
 * `ref` is deliberately NOT part of this map: it is a reserved method on
 * `actions`, not a family, and `Exclude<…, 'ref'>` keeps the `ref` action type
 * (a declaration-time indirection, expanded before dispatch) out of the surface.
 *
 * WHAT THESE TYPES DO NOT PROMISE
 * -------------------------------
 * Props are NOT validated against these schemas at runtime — the native dispatch
 * path performs template substitution and no schema decode. So a wrong prop is
 * caught in the editor and nowhere else; treat these as authoring aids, not as a
 * runtime contract. *
 * THREE MEMBERS ARE TYPED BUT DO NOT WORK FROM A CODE BODY
 * --------------------------------------------------------
 * The surface describes what DISPATCH accepts, which is every registered
 * handler. Three of them are broken in this position, for one shared reason:
 * the sandbox sub-run-context built in `run/action-invokers.ts` omits fields the
 * top-level step context sets.
 *
 *   - `automation.call`   ALWAYS REJECTS. The sub-context has no
 *                         `invokeAutomation`, so the handler fails with
 *                         "not available in this execution context".
 *   - `filter.continue`   Silent no-op. Returns `{status:'filtered'}`, which the
 *                         dispatcher does not treat as failure, so it resolves
 *                         `undefined` and the halt never propagates.
 *   - `flow.stop`         Inert. Its effect rides in `responseOverride` /
 *                         `returnData`, both discarded by the dispatcher.
 *
 * They are NOT excluded from the type. Excluding them would mean a hand-kept
 * deny-list that silently goes stale the day one is fixed, and nothing can
 * mechanically prove "still broken". These are runtime defects; the fix belongs
 * in the sandbox context, not in a type that hides them.
 */
type ActionFamily = Exclude<AutomationActionUnion['type'], 'ref'>

type ActionMemberOf<T extends ActionFamily> = Extract<AutomationActionUnion, { readonly type: T }>

/**
 * `A` is a naked defaulted parameter so the conditional DISTRIBUTES over the
 * union — that is what collects every member's operator into one union, and what
 * flattens a member whose `operator` is itself a union (`http` declares one
 * schema member with `"post" | "put" | "patch"`, since the three share a shape).
 */
type ActionOperatorOf<T extends ActionFamily, A = ActionMemberOf<T>> = A extends {
  readonly operator: infer O
}
  ? O
  : never

/**
 * Reverse assignability on purpose: `O extends Op`, never
 * `Extract<…, { operator: O }>`. Extract fails on the merged `http` member
 * because `"post" | "put" | "patch"` is not assignable to `"post"`, which would
 * silently drop props for three real operators.
 */
type ActionPropsOf<T extends ActionFamily, O extends string, A = ActionMemberOf<T>> = A extends {
  readonly operator: infer Op
  readonly props: infer P
}
  ? O extends Op
    ? P
    : never
  : never

/**
 * `{} extends P` holds exactly when every prop of `P` is optional, so the
 * argument is optional for those operators (`context.actions.date.now()`) and
 * required for the rest (`context.actions.http.request()` is an error).
 */
export type CodeContextActions = {
  readonly [T in ActionFamily]: {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends P` is the all-props-optional test; Record<never, never> does not behave the same here
    readonly [O in ActionOperatorOf<T> & string]: {} extends ActionPropsOf<T, O>
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handler return shapes are per-operator and not modelled in the schema
        (props?: ActionPropsOf<T, O>) => Promise<any>
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same
        (props: ActionPropsOf<T, O>) => Promise<any>
  }
}

// `CodeContext` is an INTERFACE and must stay one. `build-types.ts` cannot extract it
// structurally: its loop only resolves `SymbolFlags.TypeAlias`, so `typeToString` on an
// interface prints the interface NAME and would emit `export type CodeContext =
// CodeContext` (TS2456). Declaring it as a type alias to force extraction is worse —
// `typeToString` emits no comments at all, which would strip the `log` warning below
// from every user's generated `sovrium.d.ts`. The emitter therefore hand-writes this
// text (see its `lines.push` block); `[internal ref]`
// keeps the copies honest.
//
// That check slices from the FIRST occurrence of the declaration keyword+name pair
// below, so no comment in this file may spell that pair literally — the slice would
// start in the comment and parse zero properties. This paragraph is deliberately
// worded around it; the first draft was not, and failed exactly that way.

/**
 * CodeContext - typed context object passed to every runTypescript code action.
 *
 * Operators MUST annotate their execute() parameter as CodeContext:
 *   async function execute(context: CodeContext) { ... }
 *
 * The TypeScriptValidator rejects any code action whose execute() declares a
 * first parameter without this annotation, so type errors on context.<key>
 * accesses surface at server startup instead of failing silently at request
 * time.
 *
 * Five properties: `inputData`, `actions`, `env`, `log`, `run`. The
 * trigger payload and prior step outputs are NOT exposed directly — every
 * value the code needs must be declared explicitly via the action's
 * `inputData` prop using `{{trigger.data.X}}` / `{{steps.Y.Z}}` template
 * references, resolved before the sandbox sees the data. This makes a
 * code action a pure function of its declared inputs.
 *
 * `actions` references reusable action templates declared at the schema
 * root (`app.actions[]`), NOT sibling steps in the same automation.
 * `context.actions.<templateName>(input)` invokes the named template,
 * substituting its `$vars` with the caller-supplied `input` shallow-
 * merged on top of declared variable defaults.
 *
 * `inputData` and the `actions` return type use `any` (not `unknown`):
 * they hold dynamic JSON / action-output shapes, and `unknown` would
 * force narrowing on every property access. `log` is strictly typed so
 * `context.log.debug()` (or any unknown method) fails type-checking at
 * startup.
 */
export interface CodeContext {
  /** Template-resolved key-value pairs declared in the action's inputData prop */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape, see interface JSDoc
  readonly inputData: Record<string, any>
  /**
   * Two-shape callable surface:
   * - `actions.ref('<templateName>', vars)` — invoke a template declared at app.actions[]
   * - `actions.<actionType>.<operator>(props)` — invoke a native action type directly (no template required)
   *
   * The reserved method `ref` disambiguates templates from native types;
   * a template named `ref` is rejected at schema validation.
   */
  readonly actions: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, functional/prefer-immutable-types -- dynamic return shape (templates return arbitrary handler output). No Readonly<> here: this interface is a hand-maintained MIRROR of the CodeContext text emitted by scripts/build/build-types.ts (and of CODE_CONTEXT_PRELUDE in src/infrastructure/automations/typescript-validator/layer.ts).
    readonly ref: (templateName: string, vars?: Record<string, unknown>) => Promise<any>
  } & CodeContextActions
  /** Environment variables (values redacted in logs when length >= 8) */
  readonly env: Record<string, string>
  /**
   * Structured logging — info/warn/error.
   *
   * NOT YET WIRED: all three methods currently DISCARD their arguments. The
   * sandbox is handed a no-op implementation, so `context.log.info(…)` emits
   * nothing — not to stdout, not to run history, not to the error tracker.
   * The surface is typed and stable so code actions can call it today and
   * start producing output when a real sink lands, without a rewrite; until
   * then, anything a code action must actually surface belongs in its return
   * value (which is persisted as the step output) or in a thrown error.
   */
  readonly log: {
    readonly info: (...args: ReadonlyArray<unknown>) => void
    readonly warn: (...args: ReadonlyArray<unknown>) => void
    readonly error: (...args: ReadonlyArray<unknown>) => void
  }
  /**
   * Run-scoped metadata. `attempt` is the 1-indexed retry attempt number —
   * 1 on the initial dispatch, 2 on the first retry, etc. Used by code
   * actions that want to short-circuit retry on a recoverable transient:
   * `if (context.run.attempt === 1) throw …`.
   */
  readonly run: {
    readonly attempt: number
  }
}

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
