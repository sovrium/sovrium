/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { EnvVar } from '@/domain/models/app/env'

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
