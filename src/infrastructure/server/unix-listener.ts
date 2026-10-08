/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_LISTEN_UNIX`: serve HTTP on a Unix domain socket instead of a TCP
 * port, for a socket-activation proxy that owns the public socket and forwards
 * to this one.
 *
 * The request handler is the TCP listener's own (`buildBunServeOptions`), so a
 * request reaches the app exactly as it would over a port. Only three things
 * differ: the socket file is created with mode `0660` — the app's user and
 * group, nobody else — a socket file left behind by a crashed instance is
 * removed before the bind, and a clean stop removes the file again.
 */

import { chmodSync, lstatSync, rmSync } from 'node:fs'
import { Effect } from 'effect'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import { logError } from '@/infrastructure/logging/logger'
import { buildBunServeOptions } from '@/infrastructure/server/bun-listener'
import type { Hono } from 'hono'

/** The socket's permissions: read and write for the owner and the group. */
const SOCKET_MODE = 0o660

/** The host a socket request without a `Host` header is rebuilt on. */
const SOCKET_HOST = 'localhost'

/** Whether `path` names an existing socket file (and not a regular file to refuse to delete). */
const isSocketFile = (path: string): boolean => {
  try {
    return lstatSync(path).isSocket()
  } catch {
    return false
  }
}

/**
 * Remove the socket file at `path`, if one is there. Called on a clean stop;
 * a failure is logged and absorbed, since the process is exiting either way
 * and the next boot removes a stale socket itself.
 */
export const removeSocketFile = (path: string): void => {
  if (!isSocketFile(path)) return
  try {
    rmSync(path, { force: true })
  } catch (cause) {
    logError('[server] could not remove the socket file; the next start removes it', cause)
  }
}

/**
 * Bind `honoApp` on the Unix socket at `socketPath`.
 *
 * A socket file already at the path is a leftover — `sovrium start` has
 * already refused when the lock file names a live instance — so it is removed
 * first. A regular file there is not touched: the bind then fails and says so.
 */
export const startUnixServer = (
  honoApp: Readonly<Hono>,
  socketPath: string,
  maxRequestBodySize: number
): Effect.Effect<ReturnType<typeof Bun.serve>, ServerCreationError, never> =>
  Effect.try({
    try: () => {
      removeSocketFile(socketPath)
      const {
        port: _port,
        hostname: _hostname,
        ...options
      } = buildBunServeOptions(honoApp, 0, SOCKET_HOST, maxRequestBodySize)
      const server = Bun.serve({ ...options, unix: socketPath })
      chmodSync(socketPath, SOCKET_MODE)
      return server
    },
    catch: (error) => new ServerCreationError(error),
  })
