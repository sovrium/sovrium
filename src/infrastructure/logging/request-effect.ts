/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presentation-facing entry point for the request-edge observability wrapper
 *.
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
 */

export {
  runRequestEffect,
  type RunRequestOptions,
} from '@/infrastructure/server/run-request-effect'
