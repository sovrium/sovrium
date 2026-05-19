/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from './value-walker'
import type { EnvVar } from '@/domain/models/app/env'

export const buildEnvLookup = (
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string>> => {
  if (!envVars || envVars.length === 0) return {}

  return envVars.reduce<Record<string, string>>((acc, v) => {
    const fromOs = processEnv[v.key]
    const value =
      fromOs !== undefined && fromOs !== '' ? fromOs : v.default !== undefined ? v.default : ''
    return { ...acc, [v.key]: value }
  }, {})
}

export const ENV_REFERENCE_PATTERN = /\$env\.([A-Z][A-Z0-9_]*)/g

export const resolveEnvInString = (
  input: string,
  envLookup: Readonly<Record<string, string>>
): string => input.replace(ENV_REFERENCE_PATTERN, (_match, key: string) => envLookup[key] ?? '')

export const resolveEnvInValue = (
  value: unknown,
  envLookup: Readonly<Record<string, string>>
): unknown => mapStringsDeep(value, (s) => resolveEnvInString(s, envLookup))
