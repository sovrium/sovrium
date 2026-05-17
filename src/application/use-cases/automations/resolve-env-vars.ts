/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from './value-walker'
import type { EnvVar } from '@/domain/models/app/env'

/**
 * Build an env-var lookup table that prefers the OS environment over the
 * schema-declared `default`. This is the resolution order required by
 * APP-AUTOMATION-ENVIRONMENT-005 and -006:
 *
 *   1. `process.env[key]` (set by deployment platform / fixture)
 *   2. `default` value from schema
 *   3. `undefined` (caller decides whether that is fatal)
 */
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

/**
 * Pattern that matches `$env.VAR_NAME` references.
 * VAR_NAME is uppercase snake_case (matches EnvVarSchema's key pattern).
 *
 * Exported so callers can detect the presence of secret references when
 * deciding whether to redact a value (see secret-redactor).
 */
export const ENV_REFERENCE_PATTERN = /\$env\.([A-Z][A-Z0-9_]*)/g

/**
 * Resolve `$env.VAR_NAME` placeholders in a string against a precomputed
 * lookup. Unknown references are replaced with empty strings (callers can
 * choose to be stricter).
 */
export const resolveEnvInString = (
  input: string,
  envLookup: Readonly<Record<string, string>>
): string => input.replace(ENV_REFERENCE_PATTERN, (_match, key: string) => envLookup[key] ?? '')

/**
 * Recursively walk a value and resolve `$env.VAR_NAME` placeholders inside
 * any string leaves. Arrays and plain objects are traversed structurally;
 * other values (numbers, booleans, null, undefined) pass through unchanged.
 *
 * Pure: takes a precomputed env lookup so the function stays trivially
 * testable. The structural traversal is owned by `mapStringsDeep`.
 */
export const resolveEnvInValue = (
  value: unknown,
  envLookup: Readonly<Record<string, string>>
): unknown => mapStringsDeep(value, (s) => resolveEnvInString(s, envLookup))
