/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { HttpApp } from '@/application/ports/contracts/http-app'
import type { ServerReloadError } from '@/domain/errors/server-reload-error'
import type { ServerStopError } from '@/domain/errors/server-stop-error'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/**
 * Running server instance with stop and in-place reload capability
 *
 * This represents a domain concept of a running web server
 * that can be controlled (stopped, reloaded) through Effect operations.
 *
 * The actual server implementation (Bun.serve) is hidden
 * behind this interface to maintain layer separation.
 *
 * The built app is exposed for static site generation (SSG) purposes.
 */
export interface ServerInstance {
  /**
   * The listener, narrowed to what its readers use: the port it bound, or
   * `undefined` on a Unix socket. The Bun server object itself stays in
   * infrastructure, where `stop` and `reload` drive it.
   */
  readonly server: { readonly port: number | undefined }
  readonly url: string
  /**
   * Stop the listener, release the layer scope, and flush telemetry.
   *
   * The failure is DECLARED. `installShutdownHandlers` has always exited 1 when
   * a stop did not complete — it is in the exit-code table in
   * `[internal ref]` — but the type said `never`, so the
   * handler was reacting to something the contract denied could happen.
   */
  readonly stop: Effect.Effect<void, ServerStopError>
  readonly app: HttpApp
  /**
   * Replace the request handler of the LIVE listener with one built from
   * `app`, without closing the socket. The counterpart to {@link stop} for the
   * `--watch` saves that do not need a full teardown — see
   * `infrastructure/server/server-reload.ts` for what it does and does not
   * re-run, and `application/use-cases/config/classify-config-change.ts` for
   * which saves are allowed to take this path.
   *
   * `configHash` is the hash of the config file the new `app` was read from;
   * it keeps `X-Sovrium-Config` and the lock file honest across the swap.
   * Failure leaves the previous handler serving on the same port.
   */
  readonly reload: (app: App, configHash?: string) => Effect.Effect<void, ServerReloadError>
  /**
   * How many of this server's runs are still working, read through the database
   * this server owns. Rejects when the database cannot answer, and always does
   * once the server has stopped.
   */
  readonly countRunningAutomations: () => Promise<number>
}
