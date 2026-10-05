/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { EnvVar } from './env'

/**
 * Build the lookup every `$env.NAME` reference in the configuration resolves
 * against. Only variables DECLARED in `app.env` enter it, each resolved in
 * this order:
 *
 *   1. the operator's environment (`processEnv[key]`), when set and non-empty
 *   2. the declared `default`
 *   3. `''`
 *
 * A variable the app does not declare is absent, so config can never read an
 * arbitrary operator variable (`DATABASE_URL`, `AUTH_SECRET`, …) by naming it.
 *
 * Pure: the caller hands in the environment, which keeps the domain free of
 * `process` and lets every layer — the automation runner, the HTTP routes and
 * the outgoing-webhook sender — share this one resolver.
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
 * deciding whether to redact a value (see secret-redactor). It is a shared
 * `/g` regex: build a fresh `RegExp` from its `source` before calling `test`.
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
 * Every distinct variable name a string reads through `$env.NAME`, in order of
 * first appearance.
 */
export const envReferencesIn = (input: string): readonly string[] => [
  ...new Set(Array.from(input.matchAll(ENV_REFERENCE_PATTERN), (match) => match[1] ?? '')),
]

/**
 * Resolve a credential the server compares a caller's against: `''` when any
 * `$env.NAME` it reads resolves to an empty value, whatever literal surrounds
 * it.
 *
 * `whsec_$env.SECRET` with SECRET unset would otherwise resolve to `whsec_`, a
 * string anyone reading the configuration knows, and every check that refuses
 * an empty expected credential would accept it. Treating the whole credential
 * as empty keeps the door shut until the variable holds a value.
 */
export const resolveSecretInString = (
  input: string,
  envLookup: Readonly<Record<string, string>>
): string =>
  envReferencesIn(input).some((name) => (envLookup[name] ?? '') === '')
    ? ''
    : resolveEnvInString(input, envLookup)
