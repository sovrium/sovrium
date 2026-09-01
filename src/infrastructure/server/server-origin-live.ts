/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolving the origin this instance is actually reachable at.
 *
 * ── The policy, and why it is this one ─────────────────────────────────────
 *
 *   1. `BASE_URL`, when the operator declared one. Behind a proxy or a custom
 *      domain the operator is the only party who knows the public address —
 *      the process sees `0.0.0.0:8080` and nothing about the name in front of
 *      it.
 *   2. Otherwise, the origin the server ACTUALLY BOUND, published here by
 *      `createServer` the moment `Bun.serve` returns.
 *   3. Otherwise `http://localhost:${PORT}` — reachable only before the bind
 *      has happened, which is why it is last.
 *
 * Rule 1 is deliberately identical to how `createAuthInstance` resolves Better
 * Auth's `baseURL`, and to the operator contract `sovrium --help` publishes
 * ("BASE_URL — Public base URL (default: http://localhost:PORT)"). Two
 * surfaces of one binary disagreeing about where that binary lives is a
 * defect on its own; a workflow-minted short link and a password-reset link
 * are the same promise made to the same recipient.
 *
 * Rule 2 is where this module earns its existence. `PORT` is a request, not a
 * result: `startBunServer` retries on `EADDRINUSE` with port `0`, and the E2E
 * harness spawns every server with `PORT: '0'` deliberately. Deriving the
 * origin from `PORT` alone yields `http://localhost:0` — an address that
 * matches every well-formedness check anyone would write and opens nowhere.
 *
 * ── Why there is no hard failure when `BASE_URL` is unset ──────────────────
 *
 * It was considered and declined. The product already answers this exact
 * question with a documented default in two places (the CLI help text and
 * Better Auth's `baseURL`), and a third policy that refused to boot where
 * authentication silently defaults would be an inconsistency an operator
 * cannot reason about. A single-host `sovrium start` must keep working with no
 * environment at all — that is the zero-config property — and on that
 * deployment the bound origin is exactly right.
 */

import { Effect, Layer } from 'effect'
import { ServerOrigin } from '@/application/ports/services/server-origin'

/** Strip any trailing slashes so callers can concatenate a path directly. */
const normalise = (origin: string): string => origin.replace(/\/+$/, '')

// eslint-disable-next-line functional/no-let -- the bound origin is not knowable until `Bun.serve` returns, so it is published once at bind and re-published by each boot the E2E harness performs inside one process
let boundOrigin: string | undefined

/**
 * Record the origin the server just bound to.
 *
 * Called from `createServer` immediately after `Bun.serve` returns, with the
 * same string the startup banner prints — so what an operator reads in the
 * `listening on` line is exactly what a minted link will carry.
 *
 * Re-publishing is normal, not exceptional: `--watch` and the E2E harness both
 * restart the server inside one process, and a stale origin from the previous
 * boot would send a later spec's link to a port nothing is listening on.
 */
export const publishBoundOrigin = (origin: string): void => {
  // eslint-disable-next-line functional/no-expression-statements -- publishing the bound origin is the point
  boundOrigin = normalise(origin)
}

/**
 * The origin to build absolute URLs from, per the policy above.
 *
 * Exported for the Layer below and for direct use by infrastructure that has
 * no Effect context to reach the port through.
 */
export const resolveServerOrigin = (): string => {
  const declared = process.env['BASE_URL']
  if (declared) return normalise(declared)
  if (boundOrigin !== undefined) return boundOrigin
  return `http://localhost:${process.env['PORT'] || 3000}`
}

/**
 * Live `ServerOrigin`.
 *
 * Resolved per read rather than captured at Layer construction: the Layer is
 * built while the module graph loads, which is before anything has bound.
 */
export const ServerOriginLive: Layer.Layer<ServerOrigin> = Layer.succeed(
  ServerOrigin,
  ServerOrigin.of({ current: Effect.sync(resolveServerOrigin) })
)
