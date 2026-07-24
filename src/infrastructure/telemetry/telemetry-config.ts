/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { parseTelemetryConfig, type TelemetryConfig } from '@/domain/models/env/telemetry/telemetry'

const OFF: TelemetryConfig = {}

const cache = new Map<'config', TelemetryConfig>()

export const getTelemetryConfig = (): TelemetryConfig => {
  const cached = cache.get('config')
  if (cached !== undefined) return cached
  const resolved = safeParse()
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

export const resetTelemetryConfigCache = (): void => {
  cache.clear()
}
