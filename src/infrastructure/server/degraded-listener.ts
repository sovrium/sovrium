/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The listener a boot holds while its database is unreachable.
 *
 * A `sovrium start` whose PostgreSQL is stopped, restarting or in crash
 * recovery exited 1 before this listener existed. Under a supervisor that restarts on failure, that
 * turned a degraded instance into a dead one: the fresh process never bound
 * its port, the proxy answered 502 for everything, and no probe could tell
 * "database down" from "process gone" — which is how a routine package upgrade
 * took the Sovrium Cloud control plane from serving-with-errors to gone.
 *
 * This listener binds the address the real server will take, answers 503 on
 * every route, and is released the moment the migrator's `SELECT 1` succeeds.
 * It serves no app: the probe body is the only thing it builds from the
 * config, and the reason the database is unreachable stays in the log — a
 * driver message is operator information, not a thing to print to every
 * caller (standing rule S4).
 */

import { Effect } from 'effect'
import { Hono } from 'hono'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import { healthProbeResponseSchema } from '@/domain/models/api/health/health'
import {
  isStrictPortBoot,
  resolveBindHost,
  resolveListenUnix,
} from '@/domain/models/process-env/server-lifecycle'
import { logInfo } from '@/infrastructure/logging/logger'
import {
  parsePort,
  resolveMaxRequestBodySize,
  startBunServer,
} from '@/infrastructure/server/bun-listener'
import { isPortFree } from '@/infrastructure/server/port-availability'
import { removeSocketFile, startUnixServer } from '@/infrastructure/server/unix-listener'
import type { HeldListener, HoldListenerConfig } from '@/application/ports/services/server-factory'
import type { App } from '@/domain/models/app'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'

/** What every 503 tells its caller to do. Seconds, as the header takes them. */
const RETRY_AFTER_SECONDS = '5'

/** How long `release` waits for the OS to hand the port back after `stop`. */
const PORT_RELEASE_BUDGET_MS = 2000
const PORT_RELEASE_POLL_MS = 25

const DEGRADED_MESSAGE =
  'The database is unreachable; the server is waiting for it and answers 503 until it is.'

const DEGRADED_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="${RETRY_AFTER_SECONDS}">
<title>Temporarily unavailable</title>
</head>
<body>
<main>
<h1>Temporarily unavailable</h1>
<p>${DEGRADED_MESSAGE} This page tries again on its own.</p>
</main>
</body>
</html>
`

/**
 * The Hono app the held listener answers with: the health routes in their
 * documented `degraded` shape, the API error envelope on `/api/*`, and a short
 * page everywhere else. Every answer carries `Retry-After`.
 */
const buildHoldingApp = (app: App): Hono => {
  const probeBody = decodeOrThrow(healthProbeResponseSchema)({
    status: 'degraded',
    ...(app.version === undefined ? {} : { version: app.version }),
    checks: { db: 'error' },
  })
  const headers = { 'Retry-After': RETRY_AFTER_SECONDS }
  return new Hono()
    .get('/api/health', (c) => c.json(probeBody, 503, headers))
    .all('/api', (c) =>
      c.json(
        { success: false, message: DEGRADED_MESSAGE, code: 'SERVICE_UNAVAILABLE' },
        503,
        headers
      )
    )
    .all('/api/*', (c) =>
      c.json(
        { success: false, message: DEGRADED_MESSAGE, code: 'SERVICE_UNAVAILABLE' },
        503,
        headers
      )
    )
    .all('*', (c) => c.html(DEGRADED_PAGE, 503, headers))
}

/**
 * Poll until nothing holds `port` any more, within the budget. `stop(true)`
 * closes the socket, but the OS can take a moment to release the address, and
 * the real bind that follows must not fall back to an OS-assigned port — or
 * refuse, under a strict boot — because this listener was still letting go.
 */
const waitForPortRelease = async (hostname: string, port: number): Promise<void> => {
  const deadline = Date.now() + PORT_RELEASE_BUDGET_MS
  while (Date.now() < deadline && !isPortFree(hostname, port)) {
    await Bun.sleep(PORT_RELEASE_POLL_MS)
  }
}

/** Stop the held listener and run what has to happen before the address can be rebound. */
const releaseEffect = (
  server: ReturnType<typeof Bun.serve>,
  afterStop: () => Promise<void> | void
): Effect.Effect<void, never> =>
  // effect-promise: total -- `stop(true)` settles once the socket is closed, and `afterStop` only polls the port or unlinks a socket file; neither rejects.
  Effect.promise(async () => {
    await server.stop(true)
    await afterStop()
  })

/**
 * Bind the holding listener where the real server will bind — the Unix socket
 * `SOVRIUM_LISTEN_UNIX` names, else the requested TCP port, strict or not
 * exactly as `createServer` resolves it — and announce it on the same
 * `listening on` line a real boot prints, suffixed so an operator reading the
 * journal knows what state the process is in.
 */
export const holdDegradedListener = (
  config: HoldListenerConfig
): Effect.Effect<HeldListener, ServerCreationError> =>
  Effect.gen(function* () {
    const honoApp = buildHoldingApp(config.app)
    const maxRequestBodySize = resolveMaxRequestBodySize(config.app)
    const socketPath = resolveListenUnix(process.env)
    if (socketPath !== undefined) {
      const server = yield* startUnixServer(honoApp, socketPath, maxRequestBodySize)
      logInfo(`[server] listening on unix:${socketPath} (degraded: database unreachable)`)
      return {
        port: undefined,
        release: releaseEffect(server, () => removeSocketFile(socketPath)),
      }
    }
    const hostname = config.hostname ?? resolveBindHost(process.env).host
    const port = config.port ?? parsePort(Bun.env.PORT) ?? 3000
    const strict = isStrictPortBoot(process.env)
    const server = yield* startBunServer(honoApp, { port, hostname, strict }, maxRequestBodySize)
    const boundPort = server.port
    logInfo(
      `[server] listening on http://${hostname}:${boundPort} (degraded: database unreachable)`
    )
    return {
      port: boundPort,
      release: releaseEffect(server, () =>
        boundPort === undefined ? undefined : waitForPortRelease(hostname, boundPort)
      ),
    }
  })
