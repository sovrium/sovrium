/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Bun listener: bind, swap on reload, and drain on stop.
 *
 * Everything here is about the SOCKET rather than about the app it serves —
 * `Bun.serve` options, the EADDRINUSE fallback, the live-reload handler swap,
 * and the three-step stop sequence whose order is a documented contract.
 */

import { Effect } from 'effect'
import { websocket } from 'hono/bun'
import { confineHost } from '@/domain/kernel/url/request-base-url'
import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import { drainBackgroundRuns } from '@/infrastructure/automations/background-runs'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import { ServerStopError } from '@/infrastructure/errors/server-stop-error'
import { logDebug, logError, logInfo, logWarning } from '@/infrastructure/logging/logger'
import { disposeDomainRuntime } from '@/infrastructure/server/domain-runtime'
import { shutdownTelemetry } from '@/infrastructure/telemetry/telemetry-sink'
import type { App } from '@/domain/models/app'
import type { DomainRuntime } from '@/infrastructure/server/domain-runtime'
import type { Hono } from 'hono'

/**
 * Parse a port string into a valid port number, or return undefined
 */
export const parsePort = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const parsed = parseInt(value, 10)
  return !isNaN(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : undefined
}

/**
 * How long in-flight requests get to finish before open connections are cut.
 *
 * `Bun.serve().stop()` without an argument waits for every connection to close
 * ON ITS OWN, and the server holds long-lived ones by design — SSE streams and
 * the WebSocket heartbeat both re-arm an interval forever. Waiting for those is
 * waiting for a client to navigate away, which is why an unbounded `stop()`
 * looked like "the server ignores SIGTERM". So: a short drain for real
 * requests, then a forced close.
 */
const SHUTDOWN_DRAIN_MS = 150

/**
 * How long a stop waits for background automation runs to finish before
 * interrupting them — each interrupted run is then recorded as stopped by the
 * shutdown, so none is left `running`. Short, like the request drain above: a
 * supervisor escalates to SIGKILL soon after SIGTERM (the E2E fixture after
 * 500 ms), and a run killed there is exactly the run left `running` forever.
 */
const BACKGROUND_RUN_GRACE_MS = 150

/**
 * What a stop needs to know beyond the socket and the runtime.
 */
export interface StopOptions {
  /**
   * The telemetry teardown itself, injected so a test can observe whether it
   * was reached. Defaults to the real one. It is a parameter rather than a
   * `mock.module()` because that call contaminates Bun's module cache for every
   * other test file in the process (CLAUDE.md).
   */
  readonly telemetryShutdown?: () => Promise<void>
  /**
   * Where a swallowed teardown failure is reported. Defaults to `logError`.
   *
   * It exists for the same reason `telemetryShutdown` does, and only for that
   * reason: the failure below is absorbed, so the ONLY evidence it happened is
   * the log line — and a test cannot observe a line written by the module-level
   * `logError` helper without `mock.module()`, which is banned. Injecting the
   * sink is what makes "it is logged, with its cause" an assertion rather than
   * a claim in a comment.
   */
  readonly logFailure?: (message: string, cause: unknown) => void
}

/**
 * Create server stop effect: drain the socket, dispose the runtime, flush
 * telemetry. Three steps, in that order, and the order is the contract.
 *
 * The domain runtime is disposed AFTER the socket is fully closed, never
 * before. Its services are what in-flight requests are running against, so
 * releasing them while the drain is still under way would fail exactly the
 * requests the drain exists to let finish. `server.stop(true)` is what makes
 * "fully closed" reachable at all: SSE streams and the WebSocket heartbeat
 * re-arm forever, so the drain alone never completes. Telemetry is last so
 * anything logged during teardown still has somewhere to go.
 *
 * ## Why there are no explicit disposers here (standing rule E3)
 *
 * The cron scheduler and the two pg `LISTEN` clients are not torn down by
 * calls between these steps. They are finalizers on the runtime's own scope —
 * the cron registry is an
 * `Effect.acquireRelease` whose release interrupts every armed fiber
 * (`scheduling/cron-scheduler-live.ts`), and each pg `LISTEN` client is an
 * `Effect.acquireRelease` inside its layer (`database/ai-*-listener.ts`). So
 * `runtime.dispose()` releases them, in reverse acquisition order, on every
 * exit path rather than only on the graceful one. Re-adding an explicit
 * disposer here would run the teardown twice.
 *
 * Cron's ordering is worth naming: it is interrupted AFTER the drain, not
 * before, so a tick can start work against a closing socket. The window is the
 * 150 ms drain plus the forced close, and a
 * tick landing inside it is already handled — `runCallbackSafely` absorbs the
 * whole cause, and `run-cron-automation` re-checks the pause table at fire
 * time. Trading that for a teardown that also fires when the boot FAILS is the
 * better side of the deal.
 *
 * ## Why the telemetry teardown is safe to take unconditionally
 *
 * `shutdownTelemetry()` is `disposeObsRuntime()`, which does
 * `runtimes.delete('full')` on a module-level map, and `activeRuntime()` reads
 * `runtimes.get('full') ?? bootstrapRuntime()` with no lazy re-creation — so it
 * is one-way for the whole PROCESS rather than for this server. That makes it
 * wrong for any stop happening BEFORE the real listener has bound: a throwaway
 * server stopped while the server that matters has not started would switch
 * OTLP export off for the rest of the process — silently, since
 * `initObsRuntime()` is `void`-ed in `telemetry-sink.ts`.
 *
 * No such stop exists. Rendering binds nothing (`render-app.ts`), so every
 * `createStopEffect` in the process belongs to a listener that really was
 * serving and really is ending — which is what makes this step unconditional,
 * with no flag guarding it.
 */
export const createStopEffect = (
  server: ReturnType<typeof Bun.serve>,
  runtime: DomainRuntime,
  options: StopOptions = {}
): Effect.Effect<void, ServerStopError> =>
  Effect.gen(function* () {
    logDebug('[server] stopping...')
    // Drain, then force. The race resolves on whichever comes first; the
    // second call closes whatever is left (`closeActiveConnections`).
    //
    // Declared rather than swallowed: the shutdown handler already exits 1 on a
    // failed stop, and an operator whose port is not released needs that.
    yield* Effect.tryPromise({
      try: () => Promise.race([server.stop(), Bun.sleep(SHUTDOWN_DRAIN_MS)]),
      catch: (cause) => new ServerStopError(cause),
    })
    yield* Effect.tryPromise({
      try: () => server.stop(true),
      catch: (cause) => new ServerStopError(cause),
    })
    // A run an automation's write started in the background finishes now, or
    // is interrupted and recorded as stopped — while the services it writes
    // its row through are still up (the chained-run shutdown and cross-automation cycle rule, `background-runs.ts`).
    yield* drainBackgroundRuns(BACKGROUND_RUN_GRACE_MS)
    // The socket is closed; nothing can still be running against these services.
    // `dispose` releases the layer scope — which is what makes a scoped resource
    // reachable at all, since a scope is only useful when something holds it for
    // longer than a boot program. A finalizer that fails is logged and absorbed
    // rather than allowed to stall the rest of the shutdown — the reason lives
    // with the release, in `disposeDomainRuntime`, which the render path shares.
    yield* disposeDomainRuntime(runtime)
    // Flush + close the OTLP log-export runtime (no-op unless log export is on).
    //
    // The rejection is ABSORBED, and that part is deliberate: the socket is
    // already closed and the runtime already released, so there is nothing left
    // to protect by failing here — only a process that would refuse to exit
    // because its telemetry backend was unreachable.
    //
    // What it is not allowed to be is SILENT. Standing rule E6
    // — a swallowed failure
    // is logged with its cause and carries a written reason — and this one is
    // precisely the kind nothing else would ever report: the failing subsystem
    // IS the one that ships logs, so a flush that dies takes the last records of
    // the shutdown with it and leaves no trace in either sink. The log line is
    // that trace, and it goes out over stdout via the sink that is still there.
    const { telemetryShutdown = shutdownTelemetry, logFailure = logError } = options
    // effect-promise: total -- the `.catch` below handles every rejection and returns `void`, so the thunk cannot reject.
    yield* Effect.promise(() =>
      telemetryShutdown().catch((cause: unknown) => {
        logFailure('[server] the telemetry runtime did not flush cleanly', cause)
      })
    )
    logInfo('[server] stopped')
  })

/**
 * Whether a request names a `Host` that is not a host name.
 *
 * Bun accepts ANY `Host` text, and when that text carries a path, userinfo or
 * markup it hands the handler a URL built from it — Hono then reads the path
 * out of the wrong segment and the SEO routes throw on an unparseable URL, so a
 * client typing a bogus `Host` could turn any route into a 500. The header is
 * judged by the same rule the address resolver applies ({@link confineHost}),
 * applied to the WHOLE value: `confineHost` keeps the first entry of a
 * comma-joined list (a forwarded header's shape), but a `Host` is one host, and
 * `a.example,evil.example/x` reaches Hono as a relative URL exactly as the
 * bare markup does. So the refused hosts are the ones no address would ever be
 * built from, lists included.
 *
 * A request with no `Host` at all is not malformed — HTTP/1.0 omits it — and is
 * rebuilt on the listener's own address instead ({@link withBindAddressUrl}).
 */
export const hasMalformedHost = (request: Readonly<Request>): boolean => {
  const host = request.headers.get('Host')
  return host !== null && confineHost(host) !== host
}

/** The authority part of a URL for a bound address — an IPv6 literal in brackets. */
const authorityOf = (hostname: string, port: number): string =>
  `${hostname.includes(':') ? `[${hostname}]` : hostname}:${String(port)}`

/**
 * A request that sent no `Host`, rebuilt as if it had named the address this
 * listener is bound to.
 *
 * HTTP/1.0 does not require `Host`, and without one Bun hands the handler a
 * RELATIVE URL (`/robots.txt`), which the router and every route that parses
 * `request.url` cannot read — so an old client got a 500 for a request that is
 * perfectly well formed. Rebuilding the URL on the bind address routes it
 * exactly as a request carrying a correct `Host` would. The live server's own
 * port is preferred to the configured one, which is `0` when the OS picked it.
 * A request that carries a `Host` is returned untouched.
 */
export const withBindAddressUrl = (
  request: Request,
  bound: { readonly hostname: string; readonly port: number }
): Request => {
  if (request.headers.get('Host') !== null) return request
  const origin = `http://${authorityOf(bound.hostname, bound.port)}`
  const { pathname, search } = new URL(request.url, origin)
  return new Request(new URL(`${pathname}${search}`, origin), request)
}

/** The address the live server reports, falling back to the configured one. */
const boundAddress = (
  server: unknown,
  configured: { readonly hostname: string; readonly port: number }
): { readonly hostname: string; readonly port: number } => {
  const live = server as { readonly hostname?: unknown; readonly port?: unknown } | undefined
  return {
    hostname: typeof live?.hostname === 'string' ? live.hostname : configured.hostname,
    port: typeof live?.port === 'number' && live.port > 0 ? live.port : configured.port,
  }
}

/**
 * The refusal for a malformed `Host`: a bare `400`, echoing nothing of the
 * value the client sent.
 */
const malformedHostResponse = (): Response =>
  new Response('Bad Request', { status: 400, headers: { 'Content-Type': 'text/plain' } })

/** The upload limit when neither a bucket nor `STORAGE_MAX_FILE_SIZE` sets one (100 MiB). */
const DEFAULT_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024

/** The JSON API body limit when `API_BODY_LIMIT_BYTES` is unset (25 MiB). */
const DEFAULT_API_BODY_LIMIT_BYTES = 25 * 1024 * 1024

/** Room for a multipart envelope around the largest file the deployment accepts. */
const MULTIPART_ENVELOPE_BYTES = 1024 * 1024

/**
 * The largest request body the LISTENER accepts, before any route reads it.
 *
 * Bun buffers a request body up to `maxRequestBodySize` (128 MiB when unset)
 * whatever the route, so a route that reads its body before anything else —
 * sign-in, an anonymous form — made every client able to park that much memory
 * per request. The ceiling is derived from what the deployment can legitimately
 * receive: the largest file any bucket accepts (a bucket's own `maxFileSize`,
 * or the global `STORAGE_MAX_FILE_SIZE`, else 100 MiB, which the built-in
 * `system` bucket and every bucket without its own limit use) plus 1 MiB for the
 * multipart envelope, and never below the JSON API limit
 * (`API_BODY_LIMIT_BYTES`, 25 MiB by default). Anything larger is refused by
 * Bun with `413` before Hono sees it.
 *
 * Pure in `app` and `env`, so a `--watch` reload recomputes it from the new
 * config and a test can pin each case.
 */
export const resolveMaxRequestBodySize = (
  app: Readonly<Pick<App, 'buckets'>>,
  env: Readonly<Record<string, string | undefined>> = process.env
): number => {
  const globalUploadLimit =
    parsePositiveIntEnv(env['STORAGE_MAX_FILE_SIZE']) ?? DEFAULT_UPLOAD_LIMIT_BYTES
  const largestUpload = Math.max(
    globalUploadLimit,
    ...(app.buckets ?? []).map((bucket) => bucket.maxFileSize ?? 0)
  )
  const apiBodyLimit =
    parsePositiveIntEnv(env['API_BODY_LIMIT_BYTES']) ?? DEFAULT_API_BODY_LIMIT_BYTES
  return Math.max(largestUpload + MULTIPART_ENVELOPE_BYTES, apiBodyLimit)
}

/**
 * Build the `Bun.serve` options for the Hono app.
 *
 * The `websocket` handler powers the Records API real-time WebSocket
 * transport: the `/api/tables/:slug/subscribe` route handler upgrades a
 * `Upgrade: websocket` request via Hono's `upgradeWebSocket` helper (which
 * calls `server.upgrade()` under the hood) and Bun routes the upgraded
 * connection to the matched `websocket` handler imported from `hono/bun`.
 *
 * Bun passes the live `server` as the second `fetch` argument; we forward it
 * to Hono as the `env` so `upgradeWebSocket` (via `getBunServer(c)`) can
 * reach `server.upgrade()`.
 *
 * `maxRequestBodySize` is {@link resolveMaxRequestBodySize}: a body above it is
 * refused with `413` by Bun itself.
 */
const buildBunServeOptions = (
  honoApp: Readonly<Hono>,
  port: number,
  hostname: string,
  maxRequestBodySize: number
) => ({
  port,
  hostname,
  maxRequestBodySize,
  fetch: (request: Request, server: unknown): Response | Promise<Response> =>
    hasMalformedHost(request)
      ? malformedHostResponse()
      : honoApp.fetch(withBindAddressUrl(request, boundAddress(server, { hostname, port })), {
          server,
        }),
  websocket,
})

/**
 * Replace a LIVE listener's request handler, keeping the socket bound.
 *
 * `Bun.serve` is generic in the WebSocket `data` type and INFERS it from the
 * option object at the construction call, which is why `startBunServer` below
 * hands it Hono's handler without a cast. `Server.reload` cannot infer: the
 * server is already typed, and `ReturnType<typeof Bun.serve>` resolves to
 * `Server<unknown>`, so the very object that was legal to build this server
 * with is illegal to hand back to it. The assertion below restores what the
 * construction call already proved rather than claiming anything new — same
 * builder, same port, same server.
 *
 * THE ASSERTION IS ON THE SERVER, NOT ON THE METHOD, AND THAT IS LOAD-BEARING.
 * `reload` is a native Bun method that needs its receiver: lifting it into a
 * local (`const swap = server.reload as …; swap(options)`) detaches `this` and
 * every reload fails at runtime with `TypeError: Expected this to be
 * instanceof DebugHTTPServer`, while typechecking and linting perfectly. Keep
 * this a member call.
 */
type BunServeOptions = ReturnType<typeof buildBunServeOptions>
interface SwappableServer {
  readonly reload: (next: Readonly<BunServeOptions>) => unknown
}

export const reloadBunServer = (
  server: ReturnType<typeof Bun.serve>,
  honoApp: Readonly<Hono>,
  hostname: string,
  maxRequestBodySize: number
): void => {
  const swappable = server as SwappableServer
  swappable.reload(buildBunServeOptions(honoApp, server.port ?? 0, hostname, maxRequestBodySize))
}

/**
 * Start Bun HTTP server
 */
export const startBunServer = (
  honoApp: Readonly<Hono>,
  port: number,
  hostname: string,
  maxRequestBodySize: number
): Effect.Effect<ReturnType<typeof Bun.serve>, ServerCreationError, never> =>
  Effect.try({
    try: () => Bun.serve(buildBunServeOptions(honoApp, port, hostname, maxRequestBodySize)),
    catch: (error) => new ServerCreationError(error),
  }).pipe(
    // Retry on EADDRINUSE with port 0 (auto-select) as fallback
    Effect.catchIf(
      (e) => {
        const { cause } = e as ServerCreationError
        return (
          typeof cause === 'object' &&
          cause !== null &&
          'code' in cause &&
          (cause as { code: string }).code === 'EADDRINUSE'
        )
      },
      () =>
        Effect.try({
          try: () => {
            logWarning(`[server] Port ${port} in use; using an OS-assigned port (see URL below).`)
            return Bun.serve(buildBunServeOptions(honoApp, 0, hostname, maxRequestBodySize))
          },
          catch: (error) => new ServerCreationError(error),
        })
    )
  )
