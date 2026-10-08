/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The server entry point: build the app, bind the socket, report, and expose
 * a stop handle.
 *
 * Everything that has a life of its own now lives beside this file —
 * `compose-hono-app` assembles the Hono application, `build-domain-app` builds
 * the runtime it answers requests on, `bun-listener` owns the socket, and
 * `startup-database` / `startup-phase-report` own the boot chain and its
 * banner. What is left is the SEQUENCE those pieces run in, which is the one
 * thing that has no smaller home.
 *
 * That sequence has a shorter sibling: `render-app.ts` runs its first half —
 * validations, CSS, runtime, app — and stops where the bind would be, because
 * producing HTML through `app.fetch` needs everything a server has except the
 * server.
 */

import { Effect } from 'effect'
import {
  deprecatedHostnameNotice,
  isStrictPortBoot,
  resolveBindHost,
  resolveListenUnix,
} from '@/domain/models/process-env/server-lifecycle'
import { LockFileWriteError } from '@/infrastructure/errors/lock-file-write-error'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { registerAccountPurgeScheduler } from '@/infrastructure/scheduling/register-account-purge'
import { registerActivityLogRetentionScheduler } from '@/infrastructure/scheduling/register-activity-log-retention'
import { registerApprovalExpiryScheduler } from '@/infrastructure/scheduling/register-approval-expiry'
import { registerCronAutomations } from '@/infrastructure/scheduling/register-cron-automations'
import { registerDelayedRunResumeScheduler } from '@/infrastructure/scheduling/register-delayed-run-resume'
import { registerFailureRollupScheduler } from '@/infrastructure/scheduling/register-failure-rollup'
import { registerFormDraftExpiryScheduler } from '@/infrastructure/scheduling/register-form-draft-expiry'
import { registerStuckRunSweepScheduler } from '@/infrastructure/scheduling/register-stuck-run-sweep'
import { registerWebhookOutboxScheduler } from '@/infrastructure/scheduling/register-webhook-outbox'
import {
  registerWeeklyDigestScheduler,
  runWeeklyDigestCatchUp,
} from '@/infrastructure/scheduling/register-weekly-digest'
import {
  buildDomainRuntimeAndApp,
  buildHonoAppFromConfig,
} from '@/infrastructure/server/build-domain-app'
import {
  createStopEffect,
  parsePort,
  reloadBunServer,
  resolveMaxRequestBodySize,
  startBunServer,
} from '@/infrastructure/server/bun-listener'
import { fireAgentSchedule } from '@/infrastructure/server/compose-hono-app'
import { writeLockFile as writeLockFileToDisk } from '@/infrastructure/server/lock-file'
import { registerLockFileCleanup } from '@/infrastructure/server/lock-file-cleanup'
import { registerAgentSchedules } from '@/infrastructure/server/register-agent-schedules'
import { publishBoundOrigin } from '@/infrastructure/server/server-origin-live'
import { createServerReload } from '@/infrastructure/server/server-reload'
import { runDeferredStartupMaintenance } from '@/infrastructure/server/startup-database'
import { buildStartupPhases } from '@/infrastructure/server/startup-degradation-phases'
import { collectAllPhases, renderStartup } from '@/infrastructure/server/startup-phase-report'
import { publishServerStatus } from '@/infrastructure/server/status-file'
import { removeSocketFile, startUnixServer } from '@/infrastructure/server/unix-listener'
import { validateOperatorEnv } from '@/infrastructure/server/validate-operator-env'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type {
  AuthConfigRequiredForUserFields,
  SchemaInitializationError,
} from '@/infrastructure/database/schema/schema-initializer'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'
import type { ServerConfig } from '@/infrastructure/server/server-config'
import type { Hono } from 'hono'

// Re-exported so importers that name this module still resolve.
// `apply-symbol-moves.ts` re-points the importers and deletes these.
export type { ServerConfig } from '@/infrastructure/server/server-config'

/**
 * Write lock file for server management (stop/restart/duplicate detection)
 * Must be written before startup summary so the lock file exists when
 * external tools detect the server URL in stdout.
 *
 * Includes configHash and configPath for reload/restart support.
 */
const writeLockFile = (
  listen: ListenAddress,
  configHash: string,
  configPath: string
): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () =>
      writeLockFileToDisk({ pid: process.pid, ...listenFields(listen), configHash, configPath }),
    catch: (cause) => new LockFileWriteError(cause),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        // Worth a WARNING rather than silence: without the lock file
        // `sovrium stop` and `sovrium restart` cannot find this process, so the
        // operator's next command fails for a reason that happened at boot.
        logWarning(`[server] could not write the lock file: ${String(cause)}`)
      })
    ),
    // effect-swallow: see the tap above. A server that cannot write its lock
    // file still serves correctly, so this must not fail the boot.
    Effect.ignore
  )

/**
 * Write BOTH sidecar files a bound listener owns: the lock file, and the status
 * file beside it.
 *
 * One call rather than two at the boot site, because the two are one fact —
 * there is an instance, here is its port and its config — split across two
 * readers. `sovrium stop` reads the first; a supervisor, a container and a CI
 * step read the second, and unlike the developer watching the banner they have
 * no terminal to fall back on. Publishing the status file only under `--watch`
 * was the obvious cheaper option and is exactly wrong: it would exist wherever
 * it is least needed.
 *
 * Best-effort on both halves. A server that cannot write a sidecar still serves
 * correctly, and a boot that failed over one would be a worse outcome than the
 * blind supervisor it was meant to prevent.
 */
const writeSidecarFiles = (
  listen: ListenAddress,
  configHash: string,
  configPath: string
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* writeLockFile(listen, configHash, configPath)
    // effect-promise: total -- publishServerStatus catches its own write failures and resolves
    yield* Effect.promise(() =>
      publishServerStatus({ state: 'serving', ...listenFields(listen), configHash, configPath })
    )
  })

/** Where a bound listener answers: a TCP port, or a Unix socket. */
interface ListenAddress {
  readonly port: number | undefined
  readonly socketPath: string | undefined
}

/**
 * The listener as the sidecar files record it: `socketPath` for a socket-bound
 * instance and no port at all — inventing one would send a reader to a port
 * nothing listens on — otherwise the bound `port`.
 */
const listenFields = (
  listen: ListenAddress
): { readonly port: number } | { readonly socketPath: string } =>
  listen.socketPath !== undefined ? { socketPath: listen.socketPath } : { port: listen.port ?? 0 }

/**
 * Bind the listener: the Unix socket `SOVRIUM_LISTEN_UNIX` names, or a TCP port
 * (`PORT`, else 3000; strict per `isStrictPortBoot`). `url` is what the banner
 * prints; `origin` is what background programs mint links from, which a
 * socket does not have — `BASE_URL` is the one to set there.
 */
const bindListener = (honoApp: Readonly<Hono>, config: ServerConfig, hostname: string) =>
  Effect.gen(function* () {
    const maxRequestBodySize = resolveMaxRequestBodySize(config.app)
    const socketPath = resolveListenUnix(process.env)
    if (socketPath !== undefined) {
      const server = yield* startUnixServer(honoApp, socketPath, maxRequestBodySize)
      return { server, url: `unix:${socketPath}`, origin: 'http://localhost', socketPath }
    }
    const port = config.port ?? parsePort(Bun.env.PORT) ?? 3000
    const strict = isStrictPortBoot(process.env)
    const server = yield* startBunServer(honoApp, { port, hostname, strict }, maxRequestBodySize)
    const url = `http://${hostname}:${server.port}`
    return { server, url, origin: url, socketPath: undefined }
  })

/**
 * Warn once at boot when a multi-language app has no public origin.
 *
 * Search engines reject relative `hreflang` alternates, so a page with no
 * absolute `canonical` omits them entirely when `BASE_URL` is unset. The
 * operator gets one line saying so rather than discovering it in a search
 * console weeks later.
 */
const warnWhenHreflangHasNoOrigin = (config: ServerConfig): void => {
  const multiLanguage = (config.app.languages?.supported.length ?? 0) > 1
  if (!multiLanguage || config.silent || config.reload || Bun.env.BASE_URL) return
  logWarning(
    '[seo] BASE_URL is not set, so pages without an absolute canonical publish no hreflang alternates. Set BASE_URL to the public origin of this multi-language app.'
  )
}

/**
 * The interface this server binds: the caller's `hostname`, else
 * `SOVRIUM_BIND_HOST`, else the deprecated `HOSTNAME` — said once per boot,
 * since a `--watch` reload re-enters here with nothing new to say — else
 * `localhost`.
 */
const resolveServerHostname = (config: ServerConfig): string => {
  if (config.hostname !== undefined) return config.hostname
  const bind = resolveBindHost(process.env)
  if (bind.fromDeprecatedHostname && !config.reload) logWarning(deprecatedHostnameNotice(bind.host))
  return bind.host
}

/**
 * Creates and starts a Bun server with Hono
 *
 * Collects startup phases and renders a clean summary at the end.
 *
 * @param config - Server configuration with app data and optional port/hostname
 * @returns Effect that yields ServerInstance or ServerCreationError
 */
// @knip-ignore - Used via dynamic import in StartServer.ts
export const createServer = (
  config: ServerConfig
): Effect.Effect<
  ServerInstance,
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | TransformPresetError
  | Error
> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    // Boot-time operator-environment validation, before anything is built or
    // bound. Refuses the boot on a malformed value rather than letting it
    // surface later on whichever request first touches that lever. Shared with
    // the render path so the two cannot come to disagree about which levers are
    // checked — see `validate-operator-env.ts`.
    yield* validateOperatorEnv.pipe(
      Effect.tap(() => Effect.sync(() => warnWhenHreflangHasNoOrigin(config)))
    )
    const hostname = resolveServerHostname(config)
    const { configHash = '', configPath = '' } = config

    // Initialize infrastructure and collect phases (incl. the static-asset
    // directory line via collectPublicDirPhases, silent on the silent-skip
    // mount path).
    const { infraPhases, cssLabel } = yield* collectAllPhases(config)

    // THE DOMAIN RUNTIME, owned by this server instance and by nothing else,
    // plus the Hono app built from its services. Never a module-level singleton
    // — see ./domain-runtime for why `serverMode: 'inprocess'` makes that a
    // correctness requirement rather than a preference.
    const domain = yield* buildDomainRuntimeAndApp(config)

    const { server, url, origin, socketPath } = yield* bindListener(
      domain.honoApp,
      config,
      hostname
    )

    // Publish the origin the socket ACTUALLY bound to, before any armed-up
    // scheduler can mint a URL. `server.port` is not `port`: the bind retries
    // on EADDRINUSE with an OS-assigned port, and the E2E harness asks for
    // `PORT=0` on purpose — so `PORT` is the request and this is the result.
    // A background program has no request to read a `Host` header from, so
    // this is the only place it can learn where it lives.

    publishBoundOrigin(origin)

    // Post-bind arm-ups: cron-triggered automations, scheduled agents, and the
    // GDPR Art. 17 erasure sweep (hourly; without it, scheduled account
    // erasures would never complete in production — see
    // register-account-purge.ts). Agent schedules were decoded and echoed back
    // for as long as agents have shipped but never armed; without this line
    // `agent.schedule.cron` is a promise the binary does not keep — see
    // register-agent-schedules.ts.
    //
    // All four arm jobs on the ONE `CronScheduler` the domain runtime carries.
    // None may `Effect.provide(CronSchedulerLive)` for itself, because the
    // scheduler is scoped: four provides would be four registries in four
    // scopes, each closing (and interrupting its jobs) the instant its own
    // registration returned. Providing the resolved domain context instead is
    // one build, one registry, one scope — the server's.
    yield* Effect.provide(
      Effect.all([
        registerCronAutomations(config.app, process.env),
        registerAgentSchedules(config.app, fireAgentSchedule),
        registerAccountPurgeScheduler(config.app),
        registerActivityLogRetentionScheduler,
        registerFailureRollupScheduler(config.app),
        registerStuckRunSweepScheduler(config.app),
        registerWebhookOutboxScheduler(config.app),
        // Approval timeouts: a boot sweep for the requests that expired while
        // the server was stopped — forked on the scheduler's scope, since a
        // resumed run's tail can take minutes and must not hold the banner —
        // then one every minute. Post-bind, because an `onTimeout: approve`
        // resumes its run through this runtime.
        registerApprovalExpiryScheduler(config.app, process.env),
        // Runs parked on a long wait: at boot for those due, then every minute.
        registerDelayedRunResumeScheduler(config.app, process.env),
        // Saved form drafts past their resume link's life: at boot, then hourly.
        registerFormDraftExpiryScheduler(config.app),
        registerWeeklyDigestScheduler(config.app),
        // The weekly summary's boot catch-up: one summary for a week missed
        // while the server was down. Post-bind, because it reads every domain
        // the summary covers — the app's own tables included — through this
        // runtime; awaited (the list runs in sequence), so a summary it sends
        // has gone out by the time the banner says the boot is complete. It
        // cannot fail the boot.
        runWeeklyDigestCatchUp(config.app),
      ]),
      domain.context
    )

    // AWAITED, not forked. The port is already bound above, so a health check
    // or load balancer sees the process live while this runs — that is the
    // whole boot win, and it is kept. What must NOT move ahead of it is the
    // startup banner: the `listening on` line is the LAST line of boot and is
    // exactly what operators and `waitForServerPort`
    // treat as "boot complete". Forking this made the banner print while the
    // attachment-URL backfill and RAG embedding were still running, so a
    // caller that boots a server and immediately asserts on backfilled URLs or
    // embedded knowledge raced a half-finished boot. Announcing readiness
    // before the work that readiness implies is a correctness bug, and
    // correctness outranks the extra seconds.
    yield* runDeferredStartupMaintenance(config.app)

    const durationMs = Date.now() - startTime

    // Collect all phases immutably (see buildStartupPhases for ordering).
    const phases = buildStartupPhases({
      app: config.app,
      infraPhases,
      cssLabel,
      durationMs,
      bindHost: hostname,
    })

    if (!config.silent) {
      yield* writeSidecarFiles({ port: server.port, socketPath }, configHash, configPath)
      registerLockFileCleanup(domain.honoApp, configPath)
      // A `--watch` reload skips the banner and nothing else. Reprinting the
      // version header, the phase list and `Server ready in …` on every save
      // buries the one fact the operator is waiting for — that the edit
      // landed — under a dozen lines they already read at boot. The `watch`
      // loop prints a single summary line in its place.
      yield* config.reload
        ? Effect.void
        : renderStartup({
            app: config.app,
            phases,
            url,
            durationMs,
            ...(config.bootstrapToken !== undefined
              ? { bootstrapToken: config.bootstrapToken }
              : {}),
          })
      // Structured lifecycle record (complements the human startup banner).
      // Kept on reloads: `waitForServerPort` parses it, and a reloaded server
      // is a bound listener like any other.
      logInfo(`[server] listening on ${url}`)
    }

    return {
      server,
      url,
      // A clean stop also removes the socket file a socket-bound listener made.
      stop: createStopEffect(server, domain.runtime).pipe(
        Effect.ensuring(
          Effect.sync(() => (socketPath === undefined ? undefined : removeSocketFile(socketPath)))
        )
      ),
      app: domain.honoApp,
      // The in-place `--watch` swap, bound to THIS listener and to the port it
      // actually bound to. A reload therefore cannot drift onto another port —
      // the failure a stop-then-rebind cycle has to guard against with a
      // port-release probe simply cannot arise here.
      reload: createServerReload({
        server,
        // The SAME domain services survive the swap. `createAppLayer` reads one
        // thing off the config — `app.auth` — and `auth` is in `RESTART_KEYS`
        // (`classify-config-change.ts`), so a save that could invalidate them
        // never reaches this path: it forces a full restart, which stops the
        // server, disposes the runtime, and boots a fresh one. Rebuilding here
        // would therefore be redundant work on every save AND would strand
        // whatever the superseded context still holds.
        buildHonoApp: (nextApp, nextHash) =>
          buildHonoAppFromConfig({ ...config, app: nextApp, configHash: nextHash }, domain.context),
        swapHandler: (nextHonoApp, nextApp) =>
          reloadBunServer(server, nextHonoApp, hostname, resolveMaxRequestBodySize(nextApp)),
        configPath,
        silent: config.silent === true,
      }),
    }
  })
