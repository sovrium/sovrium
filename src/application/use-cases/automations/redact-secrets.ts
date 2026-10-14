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
 * Replace every occurrence of each value of `envLookup` with `***`, whatever
 * its length — the write-only masking reads it (`run/write-only-values.ts`),
 * where a four-digit code is still a value nobody may read. The env and
 * connection redactors below skip short values (see {@link MIN_MASKED_LENGTH}).
 *
 * Pure: takes the resolved lookup directly so it can be tested without
 * touching `process.env`.
 */
export const redactSecretsInValue = (
  value: unknown,
  envLookup: Readonly<Record<string, string>>
): unknown => walkAndRedact(value, collectSecrets(envLookup), 1)

/**
 * The shortest value the redactor masks. A shorter one (`3`, `on`, `4821`) is
 * part of too many ordinary words, numbers and identifiers: masking it turns
 * `browser step 3` into `browser step ***` and a run id into noise, sending a
 * reader after something that does not exist. The line is the one the
 * screenshot painter already draws (`run-admin-only-output.ts`).
 */
const MIN_MASKED_LENGTH = 6

/** Build the list of secret strings to scrub: every value of the lookup. */
const collectSecrets = (envLookup: Readonly<Record<string, string>>): readonly string[] =>
  Object.values(envLookup)

/**
 * Mask every secret in every string of `value`. A string that IS a secret
 * reads `***` whatever its length; inside other text, values shorter than
 * `minLength` are left alone (the empty string always, which would replace
 * everything), and the longest is replaced first, so a secret is masked WHOLE
 * even when a shorter one is part of it — replaced first, the shorter one
 * would leave the rest of the longer one readable.
 */
const walkAndRedact = (
  value: unknown,
  secrets: readonly string[],
  minLength: number = MIN_MASKED_LENGTH
): unknown => {
  const exact = new Set(secrets.filter((secret) => secret.length > 0))
  if (exact.size === 0) return value
  const masked = [...exact]
    .filter((secret) => secret.length >= Math.max(minLength, 1))
    .toSorted((a, b) => b.length - a.length)
  return mapStringsDeep(value, (s) => (exact.has(s) ? '***' : redactString(s, masked)))
}

const redactString = (input: string, secrets: readonly string[]): string =>
  secrets.reduce((acc, secret) => acc.split(secret).join('***'), input)

/**
 * The values an author declared are NOT credentials, and which therefore must
 * survive the value-matching pass verbatim.
 *
 * Two conditions, both required:
 *
 *  1. the variable carries an explicit `secret: false` — anything else
 *     (including a mistyped non-boolean) keeps redacting, and a config written
 *     before the marker existed is unaffected;
 *  2. by default, that the DEFAULT is the value actually IN FORCE: when the
 *     operator supplied an OS value, what is resolved is theirs and not the
 *     one the author inspected, so the admin config view and the boot ledger
 *     keep it hidden. Run history (`whateverSource`) shows the value of a
 *     `secret: false` variable wherever it comes from: the author declared the
 *     variable public, and a run reads it like any other value it prints.
 *
 * A value another, secret-bearing variable also resolves to is excluded: a
 * collision must fail closed, because unredacting the shared string would
 * expose the OTHER variable's credential.
 */
const collectDeclaredVisibleValues = (
  envVars: ReadonlyArray<EnvVar>,
  processEnv: Readonly<Record<string, string | undefined>>,
  whateverSource: boolean
): ReadonlySet<string> => {
  const inForceDefault = (v: EnvVar): string | undefined => {
    const fromOs = processEnv[v.key]
    if (fromOs === undefined || fromOs === '') return v.default
    return whateverSource ? fromOs : undefined
  }
  const declaredVisible = envVars
    .filter((v) => v.secret === false)
    .map(inForceDefault)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
  if (declaredVisible.length === 0) return new Set()

  const lookup = buildEnvLookup(
    envVars.filter((v) => v.secret !== false),
    processEnv
  )
  const stillSecret = new Set(Object.values(lookup).filter((v) => v.length > 0))
  return new Set(declaredVisible.filter((v) => !stillSecret.has(v)))
}

/**
 * Convenience overload that accepts `EnvVar[]` and a `processEnv` snapshot,
 * mirroring the shape we use elsewhere in the runtime.
 *
 * Resolution rules (OS env beats schema default beats empty string) live in
 * `buildEnvLookup`; redaction reuses that single source of truth so the two
 * helpers cannot drift out of sync.
 *
 * A variable declared `secret: false` is dropped from the scrub list rather
 * than added to it — see {@link collectDeclaredVisibleValues}. Without that,
 * marking a base URL visible changes nothing: the path pass leaves the literal
 * in place and this pass puts `***` straight back over it.
 *
 * So is a DECLARED DEFAULT that is still an `$env.X` reference — but not an
 * OS-supplied value that happens to look like one. See
 * {@link withoutUnresolvedReferences}.
 */
export const redactSecretsForEnv = (
  value: unknown,
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): unknown => walkAndRedact(value, envSecrets(envVars, processEnv, false))

/** The env values {@link redactSecretsForEnv} masks; `whateverSource` see {@link collectDeclaredVisibleValues}. */
const envSecrets = (
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>,
  whateverSource: boolean
): readonly string[] => {
  if (!envVars || envVars.length === 0) return []
  const lookup = withoutUnresolvedReferences(buildEnvLookup(envVars, processEnv), processEnv)
  const visible = collectDeclaredVisibleValues(envVars, processEnv, whateverSource)
  return collectSecrets(lookup).filter((v) => !visible.has(v))
}

/**
 * Drop lookup entries whose value is a `$env.X` reference the AUTHOR declared as
 * a default.
 *
 * `buildEnvLookup` reads `default` verbatim and resolves nothing, so a variable
 * declared `default: $env.DISPATCH_TOKEN` contributes the literal token
 * `'$env.DISPATCH_TOKEN'` as if it were a credential — and the substring pass then
 * paints `***` over every occurrence of the variable NAME.
 *
 * That contradicts the rule this file already applies one function down:
 * {@link secretsFromConnection} filters `$env.X` out of the connection secrets
 * for exactly this reason, and `redact-app-config.ts` states it as its first
 * rule — *"a `$env.X` token SURVIVES. A variable NAME is not a credential, and
 * it is what tells the operator which variable feeds the field."* The env half
 * simply never applied it.
 *
 * ## Why the DEFAULT half only, and why that distinction is the whole rule
 *
 * The argument above is about a declaration: a `$env.X` written in the config is a
 * POINTER, visible to anyone who can read the config, and masking the name it
 * points at helps nobody. It says nothing about a value the OPERATOR supplied. An
 * OS-supplied value is a credential by provenance whatever it happens to look
 * like, and a filter that reads only the string cannot tell the two apart — so
 * `DISPATCH_TOKEN='$env.LOOKS_LIKE_A_REFERENCE'` in the environment would
 * silently opt that secret out of redaction for the rest of the run, which is the
 * one direction this function must never fail in.
 *
 * Provenance is decided the same way `buildEnvLookup` decides the value itself and
 * the same way {@link collectDeclaredVisibleValues} decides which default is in
 * force: a non-empty OS value wins. So an entry is dropped only when the value in
 * force IS the declared default.
 *
 * Nothing real is unmasked either way. A resolved secret never contains `$env.`,
 * and the variable a default POINTS at contributes its own entry when it is
 * declared — so the credential is still scrubbed, under its own name.
 */
const withoutUnresolvedReferences = (
  lookup: Readonly<Record<string, string>>,
  processEnv: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(lookup).filter(([key, value]) => {
      if (!containsEnvReference(value)) return true
      const fromOs = processEnv[key]
      // The operator supplied this, so it is theirs and it keeps redacting —
      // however much it looks like a declaration.
      return fromOs !== undefined && fromOs !== ''
    })
  )

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
 * sees the per-user token rows. [internal ref] flags this for a future pass.
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
const secretsFromConnection = (conn: RedactableConnection): readonly string[] => {
  const keys = SECRET_PROP_KEYS_BY_TYPE[conn.type]
  if (!keys) return []
  const { props } = conn
  if (props === undefined) return []
  return keys
    .map((key) => props[key])
    .filter((val): val is string => typeof val === 'string' && val.length > 0)
    .filter((val) => !containsEnvReference(val))
}

/**
 * The part of a declared connection the redactor reads: its auth `type` and
 * its `props`. Every member of the decoded `app.connections` union satisfies
 * it, so callers pass `app.connections` as decoded.
 */
export type RedactableConnection = {
  readonly type: string
  readonly props?: Readonly<Record<string, unknown>>
}

export const collectConnectionSecrets = (
  connections: ReadonlyArray<RedactableConnection> | undefined
): readonly string[] => {
  if (!connections || connections.length === 0) return []
  return connections.flatMap((conn) => secretsFromConnection(conn))
}

/**
 * Top-level convenience: redact env values AND literal connection secrets
 * from a free-form value tree. Use this for any text that may surface to
 * a user (trigger HTTP responses, the admin config view, the boot ledger).
 *
 * One pass over both lists, longest value first, so a connection literal and
 * an env value are each masked whole whichever is part of the other.
 */
export const redactSecretsForApp = (
  value: unknown,
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>,
  connections: ReadonlyArray<RedactableConnection> | undefined
): unknown =>
  walkAndRedact(value, [
    ...collectConnectionSecrets(connections),
    ...envSecrets(envVars, processEnv, false),
  ])

/**
 * {@link redactSecretsForApp} for a run's history — step input, output and
 * error, reads, loop frames: a variable declared `secret: false` is shown
 * whether its value comes from its default or from the environment, unless a
 * secret variable holds the same value.
 */
export const redactSecretsForRunHistory = (
  value: unknown,
  envVars: ReadonlyArray<EnvVar> | undefined,
  processEnv: Readonly<Record<string, string | undefined>>,
  connections: ReadonlyArray<RedactableConnection> | undefined
): unknown =>
  walkAndRedact(value, [
    ...collectConnectionSecrets(connections),
    ...envSecrets(envVars, processEnv, true),
  ])
