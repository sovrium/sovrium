/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { EnvVar } from '@/domain/models/app/env'

/**
 * Validate that every env var declared with `required: true` is either:
 * - present in the OS environment (`process.env[key]`), OR
 * - has a `default` value defined in the app schema.
 *
 * Returns an Effect that fails with {@link MissingRequiredEnvVarError} listing
 * every missing required key. Otherwise it succeeds with `void`.
 *
 * Pure function: takes the env-var declarations and a snapshot of `process.env`
 * (so it stays trivially testable without touching the global).
 *
 * Resolution order at runtime:
 * 1. `process.env[key]` (set by deployment platform)
 * 2. `default` value from schema (fallback)
 * 3. `undefined` — fails fast at startup if `required: true`
 */
export const validateRequiredEnvVars = (
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, MissingRequiredEnvVarError> => {
  if (!envVars || envVars.length === 0) {
    return Effect.void
  }

  const missing = envVars
    .filter((v) => v.required === true)
    .filter((v) => v.default === undefined)
    .filter((v) => {
      const value = processEnv[v.key]
      return value === undefined || value === ''
    })
    .map((v) => v.key)

  if (missing.length === 0) {
    return Effect.void
  }

  const message =
    missing.length === 1
      ? `Required environment variable is not set: ${missing[0]}`
      : `Required environment variables are not set: ${missing.join(', ')}`

  return Effect.fail(new MissingRequiredEnvVarError(message))
}
