/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'

/**
 * ServerOrigin — the public scheme-and-authority this instance answers on.
 *
 * The one question a background program cannot answer for itself. A request
 * handler reads its own `Host` header; a workflow step has no request, so the
 * origin has to be handed to it — and handing it the wrong one is not a visible
 * failure. It is an address that looks perfectly well-formed in an email body
 * and simply does not open, discovered by a recipient rather than by a test.
 *
 * ── Why a port rather than reading the environment ─────────────────────────
 *
 * `PORT` is not the answer. The value an operator sets is a REQUEST, not a
 * result: `Bun.serve` may bind elsewhere, and Sovrium deliberately lets it —
 * `startBunServer` retries on `EADDRINUSE` with port `0`, and the E2E harness
 * spawns every server with `PORT: '0'` so the OS picks. Deriving the origin
 * from `PORT` therefore yields `http://localhost:0` on the exact path this
 * port exists to serve. Only the bound socket knows, and only infrastructure
 * holds the bound socket.
 *
 * A port keeps that knowledge on the infrastructure side of the layer line
 * while the use-cases that need it stay pure — the same arrangement `AppRef`
 * uses for the live config, and for the same reason: a caller gets a value,
 * not a lookup strategy it would have to keep in step with the server's.
 */
export class ServerOrigin extends Context.Service<
  ServerOrigin,
  {
    /**
     * Absolute origin with no trailing slash — `https://links.example.com`,
     * `http://localhost:4711`. Always succeeds: an instance that is serving
     * requests is by definition reachable at some origin, and there is no
     * useful failure to report to a caller that only wants to build a URL.
     */
    readonly current: Effect.Effect<string>
  }
>()('ServerOrigin') {}
