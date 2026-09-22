/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presentation-facing entry point for the REQUEST-EDGE seams — the two things a
 * route handler needs from `infrastructure/server` in order to run an Effect:
 * the observability wrapper and the
 * server's domain services.
 *
 * `runRequestEffect` runs a request's Effect on the observability runtime under
 * a root `http.server <method> <route>` span and emits the in-span request log
 * (giving log↔trace correlation) — a cross-cutting observability concern. It
 * lives in `infrastructure/server` (co-located with the page route that batch-1
 * migrated), but presentation route/util files (`presentation-api-route`,
 * `presentation-api-util`) are not permitted to import `infrastructure-server`.
 *
 * This module surfaces the wrapper through the `infrastructure/logging` facade —
 * the same sanctioned cross-cutting seam through which presentation already
 * consumes the unified logger (`logError` / `logDebug`, which internally reach
 * into `infrastructure/telemetry`). Re-exporting the request-edge wrapper here
 * keeps the layer boundary honest (each hop is individually permitted) without
 * widening what presentation may import from `infrastructure-server`.
 *
 * `provideDomain`, `runDomainPromise` and `requireDomainContext` ride the same
 * facade for the same reason and with the same cost — none. The last of the
 * three is what a handler reaches for when it must hand the services to a
 * plain-async helper rather than run a program itself (the agent-approval
 * mirror, whose other caller is the cron scheduler and has no request at all). It discharges a program's service requirements from the context
 * the server's `ManagedRuntime` resolved at boot, and it is a pure function of
 * the Hono context, so re-exporting it here neither widens what presentation may
 * reach nor moves any code. The alternative was widening the
 * `presentation-api-route` → `infrastructure-server` rule in
 * `[internal ref]`, which would open the WHOLE of the server tree —
 * `createHonoApp`, the Bun listener, the route-setup chain — to every handler,
 * to publish two functions.
 */

export {
  provideDomain,
  requireDomainContext,
  runDomainPromise,
  // The no-request spelling. Re-exported alongside its siblings in W5b: the MCP
  // handlers hold a resolved `DomainContext` threaded down from route setup
  // rather than a Hono `Context` — a JSON-RPC dispatch is not a request
  // boundary — so `runDomainPromise` is the wrong shape for them and reaching
  // `server/domain-runtime` directly is the edge this facade exists to avoid.
  runOnDomain,
} from '@/infrastructure/server/domain-runtime'
export type { DomainContext } from '@/infrastructure/server/domain-runtime'
export { runRequestEffect } from '@/infrastructure/server/run-request-effect'
