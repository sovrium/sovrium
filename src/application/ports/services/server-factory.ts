/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'
import type { Effect } from 'effect'
import type { Hono } from 'hono'

/**
 * Server factory port for creating web servers
 *
 * This interface defines the contract for server creation,
 * allowing the Application layer to remain decoupled from
 * Infrastructure implementations.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const serverFactory = yield* ServerFactory
 *   const server = yield* serverFactory.create({
 *     app: validatedApp,
 *     port: 3000,
 *     renderHomePage: (app) => '<html>...</html>',
 *     renderNotFoundPage: () => '<html>404</html>',
 *     renderErrorPage: () => '<html>Error</html>',
 *   })
 *   return server
 * })
 * ```
 */

/**
 * One row of the startup banner, as the PORT declares it.
 *
 * It is a narrower view of the banner row infrastructure actually builds
 * (`StartupPhase`, `infrastructure/logging/startup-summary.ts`), re-declared
 * here rather than imported because a port may name domain models, other ports
 * and infrastructure ERROR types and nothing else — `[internal ref]`
 * is explicit about it, and widening that rule to let one port read a logging
 * module would be a worse trade than five lines.
 *
 * Narrower, not different: the value that travels is the infrastructure object
 * itself, so a field this interface does not mention still arrives intact at
 * the renderer. The application only ever THREADS these rows from
 * `startDatabase` back into `create`; nothing in it reads one.
 */
export interface StartupPhaseRow {
  readonly label: string
  readonly detail?: string
  readonly type: 'success' | 'warning' | 'skip'
}

/**
 * The receipt a completed database startup hands back — and the reason it is a
 * value rather than a boolean.
 *
 * The chain (migrations → schema init → both reconcilers → the boot-ledger
 * capture → the seeders → the key-material survey) runs ONCE per process that
 * boots, and a server built afterwards must not repeat it. Handing `create` a
 * receipt rather than a `skip: true` flag makes that ordering a type-level
 * fact: the only way to obtain one is to have run the chain, so a caller
 * cannot claim the work is done without having done it.
 *
 * It carries the banner rows the chain produced, because those are the one
 * output of it a later `create` still needs — the `✓ Database:` line, and the
 * two ⚠ rows the key-material survey may add.
 */
export interface DatabaseStartupReport {
  readonly phases: readonly StartupPhaseRow[]
}

/**
 * Configuration for server creation
 */
export interface ServerFactoryConfig {
  readonly app: App
  readonly port?: number
  readonly hostname?: string
  readonly publicDir?: string
  readonly silent?: boolean
  readonly configHash?: string
  readonly configPath?: string
  /**
   * A `--watch` reload rather than a first start: skip the startup banner but
   * keep the lock file, its cleanup registration, and the `listening on` line.
   * See `StartOptions.reload` for why this is not `silent`.
   */
  readonly reload?: boolean
  /**
   * The receipt of a database startup this process already ran — so this server
   * reuses its banner rows instead of repeating the chain behind them.
   *
   * Set by the real boot only (`startServer`), which runs `startDatabase`
   * before the render pass and threads the result here. Absent on a server
   * nobody hoisted for: such a server runs the chain itself.
   */
  readonly databaseStartup?: DatabaseStartupReport
  readonly renderPage: (
    app: App,
    path: string,
    requestContext?: {
      readonly detectedLanguage?: string
      readonly session?: SessionInfo
      readonly cookies?: Readonly<Record<string, string>>
      /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
      readonly urlLanguage?: string
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer ([internal ref] — [internal ref]).
   *
   * Optional so callers (eg. SSG) that don't yet wire RSS through still
   * compile — the Hono `/feed.xml` route 404s when undefined.
   */
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  /**
   * One-time plaintext bootstrap token, threaded down from `startServer`'s
   * `bootstrapAdminAndToken` when a fresh token was generated this boot. The
   * server factory hands it to `renderStartupSummary` so the clean startup
   * banner gets a `→ First-admin token (POST …)` footer line. `undefined`
   * (the default) means no token was generated — the banner is unchanged.
   */
  readonly bootstrapToken?: string
}

/**
 * What it takes to RENDER, which is strictly less than what it takes to serve.
 *
 * `ServerFactoryConfig` minus everything that is about a socket or about a
 * start: no `port`, no `hostname`, no `silent`, no `reload`, no `configHash`,
 * no `configPath`, no `bootstrapToken`, no `databaseStartup`. Rendering drives
 * `app.fetch` in-process (`ssg-adapter.ts`), so what it needs is the Hono app
 * and the services behind it — an address is the one thing it has no use for.
 *
 * Narrowing the config is how the absence is made structural rather than
 * disciplined: the render pass cannot ask for a listener by mistake, because
 * there is no field on this type that would describe one.
 */
export interface RenderAppConfig {
  readonly app: App
  readonly publicDir?: string
  readonly renderPage: ServerFactoryConfig['renderPage']
  readonly renderNotFoundPage: ServerFactoryConfig['renderNotFoundPage']
  readonly renderErrorPage: ServerFactoryConfig['renderErrorPage']
  readonly renderRssFeed?: ServerFactoryConfig['renderRssFeed']
}

/**
 * A Hono app built to render, and the one call that releases what it holds.
 *
 * Deliberately NOT a `ServerInstance`: there is no `server`, no `url` and no
 * `reload`, because none of them exists. `dispose` is not a `stop` either — it
 * releases the domain runtime's layer scope (database clients, the cron
 * registry, the pg `LISTEN` sockets) and there is no listener to drain ahead of
 * it, so it cannot fail the way a stop can and its error channel says so.
 */
export interface RenderApp {
  readonly app: Readonly<Hono>
  readonly dispose: Effect.Effect<void, never>
}

/**
 * ServerFactory service for creating and starting web servers
 *
 * Use this service via Effect Context to create server instances
 * with type-safe dependency injection.
 *
 * It owns the INSTANCE BOOT SEQUENCE, of which `create` is the last step.
 * `startDatabase` and `runDeferredMaintenance` are the two steps ahead of it
 * that belong to the process rather than to any one server: a command that
 * renders before it serves runs each of them once, then builds as many render
 * apps as it has languages and at most one real server.
 *
 * `buildRenderApp` is the fourth method and the one that binds nothing. It
 * exists because rendering and serving are different jobs that happened to
 * share an implementation: a render pass asked `create` for a server purely to
 * reach the `app` field on what it returned, and paid for a socket to get it.
 */
export class ServerFactory extends Context.Service<
  ServerFactory,
  {
    /**
     * Run the database startup chain for this process, once.
     *
     * Migrations, schema init, both column reconcilers, the boot-ledger
     * capture, the best-effort seeders and the key-material survey — in that
     * order, all pre-bind. Returns the receipt `create` takes to skip repeating
     * it, carrying the banner rows the chain produced.
     *
     * Callers run this BEFORE anything that renders, because rendering a page
     * bound to a table needs the table.
     *
     * @param app - The validated app whose schema the chain reconciles
     * @param options.ephemeral - This PROCESS renders and exits rather than
     *   starting the instance, so the boot-ledger capture is skipped —
     *   `build`'s case, and the only caller that sets it. A `start` omits it
     *   and gets its row. It is about the command, not about any one server:
     *   the flag that used to mark an individual server as throwaway is gone
     *   along with the throwaway servers themselves (`buildRenderApp`).
     */
    readonly startDatabase: (
      app: App,
      options?: { readonly ephemeral?: boolean }
    ) => Effect.Effect<
      DatabaseStartupReport,
      AuthConfigRequiredForUserFields | SchemaInitializationError | Error
    >
    /**
     * Run the deferred best-effort maintenance pass for this process, once.
     *
     * The attachment-URL backfill, the storage-bucket backfill, RAG embedding
     * and the link-shadow sweep. `create` runs it itself on a real boot — AFTER
     * the listener binds and before the banner announces readiness, which is
     * the ordering that makes it deferred at all — so only a command with NO
     * real boot to hang it on calls this directly. `build` is that command.
     *
     * Never fails: every step absorbs and logs its own failure, because a
     * maintenance pass is not worth an outage.
     */
    readonly runDeferredMaintenance: (app: App) => Effect.Effect<void, never>
    /**
     * Build a Hono app to RENDER through, binding no socket.
     *
     * The static render pass wants HTML, and `toSSG` produces it by calling
     * `app.fetch` in-process. Everything a listener brings with it — the bind,
     * the published origin, the four scheduler arm-ups, the lock file, the
     * startup banner and the `listening on` line — is therefore work whose
     * result nobody reads, and the socket itself is one nothing ever connects
     * to. `create` could not be asked to skip it: binding is what it means.
     *
     * What this DOES do is everything the rendered page depends on: the
     * operator-environment validations (a malformed `SOVRIUM_IMAGE_PRESET_*`,
     * storage-public-access or `ECO_*` lever still refuses the build rather
     * than surfacing on whichever page first touches it), the CSS compile, the
     * domain runtime, and the Hono app built from its resolved services.
     *
     * It runs NEITHER process-wide chain. `startDatabase` and
     * `runDeferredMaintenance` are the caller's to run once, ahead of the
     * render pass, and they must be: a `dataSource`-bound page needs its table
     * to exist before anything renders.
     *
     * [internal ref].
     */
    readonly buildRenderApp: (
      config: RenderAppConfig
    ) => Effect.Effect<
      RenderApp,
      ServerCreationError | CSSCompilationError | TransformPresetError | Error
    >
    /**
     * Creates and starts a server instance
     *
     * @param config - Server configuration with app data and rendering functions
     * @returns Effect that yields ServerInstance or creation/compilation/auth config/migration errors
     */
    readonly create: (
      config: ServerFactoryConfig
    ) => Effect.Effect<
      ServerInstance,
      | ServerCreationError
      | CSSCompilationError
      | AuthConfigRequiredForUserFields
      | SchemaInitializationError
      | TransformPresetError
      | Error
    >
  }
>()('ServerFactory') {}
