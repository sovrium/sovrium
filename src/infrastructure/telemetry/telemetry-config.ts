/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Parse-once accessor for the resolved telemetry configuration
 * ([internal ref]-*).
 *
 * The domain parser (`parseTelemetryConfig`) is called a single time per process
 * and the result memoized, so the reporter, the OTLP runtime, the performance
 * middleware, and the startup banner all read one consistent view.
 *
 * By the time infra reads this, boot validation (`validateTelemetryConfiguration`)
 * has already run — a malformed value would have aborted the boot. This accessor
 * is therefore defensive: if parsing somehow throws here, it degrades to
 * "telemetry off" rather than crashing a running server.
 */

import { parseTelemetryConfig, type TelemetryConfig } from '@/domain/models/env/telemetry/telemetry'

/** The empty config — every signal off. */
const OFF: TelemetryConfig = {}

/** Memoized config; `undefined` until first read. */
const cache = new Map<'config', TelemetryConfig>()

/**
 * Resolve (and memoize) the telemetry configuration from the environment.
 * Never throws — a parse failure degrades to "off".
 */
export const getTelemetryConfig = (): TelemetryConfig => {
  const cached = cache.get('config')
  if (cached !== undefined) return cached
  const resolved = safeParse()
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- memoize parse-once config
  cache.set('config', resolved)
  return resolved
}

const safeParse = (): TelemetryConfig => {
  try {
    return parseTelemetryConfig()
  } catch {
    return OFF
  }
}
