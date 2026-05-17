/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildEnvLookup, ENV_REFERENCE_PATTERN } from './resolve-env-vars'
import { mapStringsDeep } from './value-walker'
import type { EnvVar } from '@/domain/models/app/env'

/**
 * Replace any occurrence of an env-var value with `***` so secrets cannot
 * leak into automation run history / logs (APP-AUTOMATION-ENVIRONMENT-004).
 *
 * Strategy:
 *   - Build the list of "secret strings" from the resolved env lookup.
 *   - For every string in the input tree, replace every secret occurrence
 *     with the placeholder `***`.
 *
 * Pure: takes the resolved env lookup directly so it can be tested without
 * touching `process.env`.
 */
export const redactSecretsInValue = (
  value: unknown,
  envLookup: Readonly<Record<string, string>>
): unknown => {
  const secrets = collectSecrets(envLookup)
  if (secrets.length === 0) return value
  return walkAndRedact(value, secrets)
}

/**
 * Build the list of secret strings to scrub. Empty strings are excluded
 * (would replace everything with `***`).
 */
const collectSecrets = (envLookup: Readonly<Record<string, string>>): readonly string[] =>
  Object.values(envLookup).filter((v) => v.length > 0)

const walkAndRedact = (value: unknown, secrets: readonly string[]): unknown =>
  mapStringsDeep(value, (s) => redactString(s, secrets))

const redactString = (input: string, secrets: readonly string[]): string =>
  secrets.reduce((acc, secret) => acc.split(secret).join('***'), input)

/**
 * Convenience overload that accepts `EnvVar[]` and a `processEnv` snapshot,
 * mirroring the shape we use elsewhere in the runtime.
 *
 * Resolution rules (OS env beats schema default beats empty string) live in
 * `buildEnvLookup`; redaction reuses that single source of truth so the two
 * helpers cannot drift out of sync.
 */
export const redactSecretsForEnv = (
  value: unknown,
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): unknown => {
  if (!envVars || envVars.length === 0) return value
  return redactSecretsInValue(value, buildEnvLookup(envVars, processEnv))
}

/**
 * Connection prop fields that hold secrets and should be redacted from
 * automation run logs / error messages when their value is supplied as a
 * literal (rather than `$env.X`, which is already covered by the env
 * lookup).
 *
 * Per connection variant:
 *   - oauth2 → `clientSecret` (clientId is not a secret)
 *   - apiKey → `key`
 *   - basic  → `password` (username is not a secret)
 *   - bearer → `token`
 *
 * Stored OAuth2 access/refresh tokens persisted in
 * `system.connection_tokens` are OUT OF SCOPE here — they live in the DB,
 * not in `app.connections[]`, and require a different redactor pass that
 * sees the per-user token rows. REC-C3-6 flags this for a future pass.
 */
const SECRET_PROP_KEYS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  oauth2: ['clientSecret'],
  apiKey: ['key'],
  basic: ['password'],
  bearer: ['token'],
}

/**
 * Walk `app.connections[]` and extract every literal secret string. Values
 * that look like `$env.VAR_NAME` references are skipped — they will be
 * picked up by `buildEnvLookup` and scrubbed via the env-redaction path.
 *
 * Returns plain strings (no key/name metadata) — the redactor only needs
 * the values to do `split/join` substring replacement.
 *
 * Pure / total: returns `[]` for `undefined` input.
 *
 * @internal — exported for unit tests; production callers go through
 * `redactSecretsForApp` which composes env + connection redaction in
 * a single pass.
 */
/**
 * Detect whether a string contains a `$env.VAR_NAME` reference. Built
 * fresh per call so we don't rely on / mutate the shared regex's
 * `.lastIndex` (the pattern is a `/g` regex shared across the codebase
 * via `resolve-env-vars.ts`).
 */
const containsEnvReference = (value: string): boolean =>
  new RegExp(ENV_REFERENCE_PATTERN.source).test(value)

/**
 * Extract the literal secret values (skipping `$env.X` refs) from a
 * single connection's props, given the keys to inspect for that
 * connection's type.
 */
const secretsFromConnection = (conn: Readonly<Record<string, unknown>>): readonly string[] => {
  const type = String(conn['type'] ?? '')
  const keys = SECRET_PROP_KEYS_BY_TYPE[type]
  if (!keys) return []
  const props = conn['props'] as Record<string, unknown> | undefined
  if (props === undefined) return []
  return keys
    .map((key) => props[key])
    .filter((val): val is string => typeof val === 'string' && val.length > 0)
    .filter((val) => !containsEnvReference(val))
}

export const collectConnectionSecrets = (
  connections: ReadonlyArray<Readonly<Record<string, unknown>>> | undefined
): readonly string[] => {
  if (!connections || connections.length === 0) return []
  return connections.flatMap((conn) => secretsFromConnection(conn))
}

/**
 * Top-level convenience: redact env values AND literal connection secrets
 * from a free-form value tree. Use this for any text that may surface to
 * a user (run-history rows, trigger HTTP responses, log lines).
 *
 * Order: connection secrets first (typically longer/rarer strings), then
 * env secrets. Both passes are idempotent — running them in either order
 * yields the same `***`-replaced output, but secrets-first means a
 * connection literal is masked even if it happened to coincide with an
 * env value substring.
 */
export const redactSecretsForApp = (
  value: unknown,
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>,
  connections: ReadonlyArray<Readonly<Record<string, unknown>>> | undefined
): unknown => {
  const connectionSecrets = collectConnectionSecrets(connections)
  const afterConnections =
    connectionSecrets.length === 0 ? value : walkAndRedact(value, connectionSecrets)
  return redactSecretsForEnv(afterConnections, envVars, processEnv)
}
