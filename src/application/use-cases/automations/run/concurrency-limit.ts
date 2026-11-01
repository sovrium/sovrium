/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How many runs of one automation the scheduler admits at once
 * (`AutomationScheduler.admit`), in order:
 *
 *   1. `automation.concurrency.limit` from the schema (1-50).
 *   2. `process.env.AUTOMATION_CONCURRENCY_DEFAULT` (operator override).
 *   3. The hard-coded {@link DEFAULT_CONCURRENCY_LIMIT}.
 */

import type { App } from '@/domain/models/app'

/** Global default concurrency, locked at 5. */
const DEFAULT_CONCURRENCY_LIMIT = 5

/** The automation's concurrency limit: its own beats the operator's, which beats the default. */
export const resolveConcurrencyLimit = (
  automation: NonNullable<App['automations']>[number],
  env: Readonly<Record<string, string | undefined>>
): number => {
  const fromSchema = automation.concurrency?.limit
  if (typeof fromSchema === 'number' && Number.isFinite(fromSchema) && fromSchema > 0) {
    return Math.floor(fromSchema)
  }
  const fromEnv = env['AUTOMATION_CONCURRENCY_DEFAULT']
  if (fromEnv !== undefined) {
    const parsed = Number(fromEnv)
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  }
  return DEFAULT_CONCURRENCY_LIMIT
}
