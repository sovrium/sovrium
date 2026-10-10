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
 * Whether a declared environment variable must be set.
 *
 * `required` defaults to `true`: an entry that omits it is required, and only
 * an explicit `required: false` declares an optional variable. This is the one
 * reading of the flag — the boot check below and the operator console
 * (`env-status.ts`) both call it, so they cannot disagree about what an omitted
 * flag means.
 */
export const isEnvVarRequired = (envVar: Pick<EnvVar, 'required'>): boolean =>
  envVar.required !== false

/**
 * Validate that every required env var — `required` defaults to `true`
 * ({@link isEnvVarRequired}), so an entry that omits it is required too — is
 * either:
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
 * 3. `undefined` — fails fast at startup unless declared `required: false`
 */
export const validateRequiredEnvVars = (
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, MissingRequiredEnvVarError> => {
  if (!envVars || envVars.length === 0) {
    return Effect.void
  }

  const missing = envVars
    .filter(isEnvVarRequired)
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

  // Only the REFUSAL opens a span: the satisfied case did no work, the refusal
  // is a boot that stopped.
  return Effect.fail(new MissingRequiredEnvVarError(message)).pipe(
    Effect.withSpan('env.validate-required-env-vars')
  )
}

/** One `env` entry of a config document, as a host needs it: its name, and whether it must be set. */
export interface DeclaredEnvVar {
  readonly key: string
  /** Required and with no `default`: a host that does not set it cannot boot the app. */
  readonly mustBeSet: boolean
}

/**
 * The `env` entries of a config DOCUMENT (the validated config as written, not
 * decoded), in declaration order. An entry that is not an object with a string
 * `key` is skipped: the document was validated before it reaches here.
 */
export const declaredEnvOf = (
  document: Readonly<Record<string, unknown>>
): readonly DeclaredEnvVar[] => {
  const entries = document['env']
  if (!Array.isArray(entries)) return []
  return entries.flatMap((entry: unknown) => {
    if (entry === null || typeof entry !== 'object') return []
    const { key, required, default: fallback } = entry as Readonly<Record<string, unknown>>
    if (typeof key !== 'string') return []
    const flag = required === false ? { required: false } : {}
    return [{ key, mustBeSet: isEnvVarRequired(flag) && fallback === undefined }]
  })
}

/**
 * The NAMES of the variables a config needs to boot — every `env` entry with
 * no `default` whose `required` is not `false` — in declaration order. Never a
 * value: a bundle carries this list so a host can refuse what it could not start.
 */
export const requiredEnvNamesOf = (
  document: Readonly<Record<string, unknown>>
): readonly string[] =>
  declaredEnvOf(document)
    .filter((entry) => entry.mustBeSet)
    .map((entry) => entry.key)
