/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { boundedHttpClientLayer } from '@/infrastructure/egress/bounded-http-client'

/** Deadline for one OTLP export request, in ms. */
const OTLP_EXPORT_TIMEOUT_MS = 10_000

/**
 * The HTTP client every OTLP exporter posts through: the bounded egress client
 * (a per-request deadline, manual redirects), so a collector that accepts the
 * connection and never answers cannot hold an export — or the final flush at
 * shutdown — open. No retry: the exporters run on a schedule and the next batch
 * is the retry.
 */
export const otlpHttpClient = boundedHttpClientLayer({
  requestTimeoutMs: OTLP_EXPORT_TIMEOUT_MS,
  retry: false,
})
