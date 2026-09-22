/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/env`.
 *
 * Enumerates the environment variables the running app DECLARES in
 * `app.env[]` — the key, its description, whether it is required, whether a
 * default is declared — plus, for each, whether the instance actually resolved
 * a value and from where. Values themselves are never returned.
 *
 * Source story: [internal ref]
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * The second of the two surfaces authorised by [internal ref] **amendment A1**
 * (2026-08-14). Same invariant, same bound: reading is observability, mutating
 * is authoring; **no edit affordance, no write endpoint, no draft, no version
 * ledger, no history, no diff, no preview.** There is no request schema in
 * this module because there is nothing to write to.
 *
 * The operator question this answers is the one that otherwise costs a shell
 * session: *"my automation is failing — is `STRIPE_KEY` actually set on this
 * box, or is it silently falling back to a default?"* Answering it does not
 * require showing the value, and so this endpoint does not show it.
 *
 * ─── WHY `redactSecretsForEnv` HERE, AND `redactSecretsForApp` NEXT DOOR ─────
 *
 * The sibling endpoint `GET /api/admin/config/schema` reflects the `App`
 * object, in which `$env.X` references are still UNRESOLVED literal tokens —
 * so its only real exposure is a hardcoded connection literal, and its
 * redactor must be `redactSecretsForApp`. This endpoint is the mirror case: it
 * is built FROM the resolved env lookup, so resolved values are exactly what
 * it must never emit, and `redactSecretsForEnv` is the matching helper.
 *
 * Neither helper substitutes for the other. Wiring `redactSecretsForEnv` into
 * the schema endpoint ships a measured leak; wiring `redactSecretsForApp`
 * here would scrub connection literals that this payload never carries.
 *
 * ─── SUBSTRING SCRUBBING IS A BLUNT INSTRUMENT — SCOPE IT ────────────────────
 *
 * `redactSecretsForEnv` works by `split(secret).join('***')` over EVERY string
 * leaf it is handed. Applied blindly to this whole payload it corrupts the
 * operator's own vocabulary: an instance with `TIER=PROD` set would have the
 * declared key `PROD_API_BASE` rewritten to `***_API_BASE`, and any
 * description mentioning `PROD` mangled with it — turning a diagnostic page
 * into an unreadable one, in exactly the incident where the operator needs to
 * read it.
 *
 * The contract below sidesteps this structurally rather than by tuning the
 * scrubber: `key`, `description` and `required` are config-declared
 * IDENTIFIERS and are emitted verbatim; no field in this response carries a
 * resolved value at all, so there is nothing left for a blanket scrub to
 * catch. `redactSecretsForEnv` remains the defence-in-depth final pass over
 * the value-bearing surface, not the primary mechanism.
 *
 * @see [internal ref] (A1)
 * @see src/domain/models/app/env — the `EnvVarSchema` this reflects
 * @see src/application/use-cases/automations/resolve-env-vars.ts — `buildEnvLookup`
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The constant every set value is reported as.
 *
 * Deliberately fixed-width and independent of the underlying value's length.
 * A mask that echoed the real length (`'*'.repeat(value.length)`) would be a
 * length oracle — enough, across a handful of keys, to fingerprint which
 * credential format a provider issued. It matches the literal
 * `redactSecretsForEnv` substitutes, so the two masking paths agree.
 */
export const ENV_VALUE_MASK = '***'

/**
 * Which resolution rung supplied this variable's value.
 *
 * Mirrors `buildEnvLookup`'s documented order exactly — OS environment (when
 * non-empty) beats the schema-declared `default`, which beats nothing:
 *
 *   - `environment` — `process.env[key]` held a non-empty value
 *   - `default`     — OS env was absent or empty; the declared `default` won
 *   - `unset`       — neither; the variable resolves to the empty string
 *
 * This is the field that earns the endpoint. `isSet` alone cannot distinguish
 * "configured on this box" from "silently coasting on a default", and that
 * distinction is the whole diagnostic.
 */
export const envValueSourceSchema = Schema.Literals(['environment', 'default', 'unset']).annotate({
  description: 'Which rung of the resolution order supplied this variable value',
})

/** @public */
export type EnvValueSource = typeof envValueSourceSchema.Type

/**
 * What this variable's DECLARED default is, as a single three-state fact.
 *
 *   - `none`      — `app.env[].default` is not declared at all
 *   - `withheld`  — a default is declared, and the author did not release it
 *   - `disclosed` — a default is declared and marked `secret: false`, so
 *                   `defaultValue` carries the literal
 *
 * ─── WHY A THIRD FIELD RATHER THAN A DERIVATION AT THE READER ──────────────
 *
 * `hasDefault` and `defaultValue` already carry this between them, and every
 * JavaScript reader can compute it in one expression. A DECLARATIVE reader
 * cannot: the console's `/env` page is an authored row template whose per-row
 * gate (`visibility.record`) evaluates ONE field against one operator, with no
 * conjunction and no presence test. "A default exists AND its literal is
 * absent" is exactly the cross-field predicate that vocabulary cannot express,
 * so the page could either drop the `has a default` hint for the withheld
 * majority — the diagnostic the endpoint exists to serve — or print a bare
 * `Default` with nothing after it.
 *
 * It is a derived FACT and deliberately not a label: no English, no formatting,
 * nothing a second locale would have to re-translate. The presentation copy
 * stays in the page, where it belongs.
 *
 * It is also additive and non-authoritative: `hasDefault` and `defaultValue`
 * keep their exact meanings, and a consumer that ignores this field is
 * unaffected. `disclosed` is emitted if and only if `defaultValue` is present,
 * which is the invariant `[internal ref]` pins.
 */
export const envDefaultStateSchema = Schema.Literals(['none', 'withheld', 'disclosed']).annotate({
  description: 'Whether a default is declared, and whether its literal is released to the reader',
})

/** @public */
export type EnvDefaultState = typeof envDefaultStateSchema.Type

/**
 * One declared environment variable and its resolution status.
 *
 * ### Why `hasDefault` ALWAYS and `defaultValue` only when marked non-secret
 *
 * A declared default is a plaintext literal a config author may reach for as a
 * fallback credential, and by `buildEnvLookup` it is a RESOLVED value whenever
 * it wins — the precise case an echo would expose. A1 rules that a
 * config-reflection endpoint which leaks a secret "is not a defective
 * implementation of an authorised surface, it is an unauthorised surface", so
 * the value cannot be echoed on the hope that no operator ever puts a
 * credential there.
 *
 * Until [internal ref] nothing distinguished `default: '3000'` from
 * `default: 'sk_live_…'`, so this endpoint reported presence only. `EnvVarSchema`
 * now carries the `secret` marker that earlier revisions of this comment named
 * as the blocker, and `defaultValue` is emitted for exactly the variables an
 * author marked `secret: false`.
 *
 * The two fields are not redundant. `hasDefault` answers "is there a fallback
 * at all?" for EVERY variable and pairs with `source: 'default'` to say whether
 * that fallback is currently in force — a diagnostic that must keep working for
 * the credentials, which are the majority. `defaultValue` only adds the literal
 * where the author has taken responsibility for it. Because `hasDefault` is
 * unconditional, a missing `defaultValue` is never ambiguous: it means
 * "withheld", never "absent".
 *
 * The marker's polarity carries the safety: it defaults to `true`, so a config
 * that never heard of it keeps every default withheld.
 */
export const envVarStatusSchema = Schema.Struct({
  key: Schema.String.annotate({
    description:
      'The declared variable key, verbatim from app.env[].key (uppercase snake_case). Never masked — a key name is an identifier the operator authored, not a credential.',
  }).pipe(Schema.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/))),
  description: optionalField(
    Schema.String.annotate({
      description:
        'Operator-authored description from app.env[].description, verbatim when declared',
    })
  ),
  required: Schema.Boolean.annotate({
    description:
      'Whether this variable must be set. Reflects app.env[].required, resolved to its documented default of true when the config omits it, so consumers never branch on undefined.',
  }),
  hasDefault: Schema.Boolean.annotate({
    description:
      'Whether app.env[].default is declared. Answers "is there a fallback at all?" for every variable, including those whose default value is withheld.',
  }),
  defaultState: envDefaultStateSchema,
  defaultValue: optionalField(
    Schema.String.annotate({
      description:
        'The declared app.env[].default, verbatim — present ONLY when the author marked the variable `secret: false`. Absent when the marker is omitted or true, which is the safe default: an unmarked default is treated as a credential. Absence is never ambiguous, because hasDefault already reports whether a default exists at all.',
    })
  ),
  isSet: Schema.Boolean.annotate({
    description:
      'Whether this instance resolved a non-empty value for the key, from any rung. Equivalent to source !== "unset"; kept as its own field because it is the flag the UI renders.',
  }),
  source: envValueSourceSchema,
  masked: Schema.NullOr(
    Schema.Literal(ENV_VALUE_MASK).annotate({
      description:
        'The constant "***" when a value resolved, null when it did not. Fixed-width by design: a length-revealing mask would fingerprint the credential format.',
    })
  ),
}).annotate({ identifier: 'EnvVarStatus' })

/** @public */
export type EnvVarStatus = typeof envVarStatusSchema.Type

/**
 * Response shape of `GET /api/admin/env`.
 *
 * `variables` reflects `app.env[]` **in declaration order** — the operator's
 * own ordering in `app.ts` is itself information (related keys are grouped),
 * and re-sorting alphabetically would destroy it for no gain. An app that
 * declares no `env` block yields an empty array, never `null`: "this app
 * declares no variables" is an answer, and it is a different answer from
 * "this endpoint could not tell you".
 */
export const envConfigResponseSchema = Schema.Struct({
  variables: Schema.Array(envVarStatusSchema).annotate({
    description:
      'Every variable declared in app.env[], in declaration order. Empty array when the app declares no env block.',
  }),
  generatedAt: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp of when the resolution status was read. Per-request: unlike the config surface, is-set status can change between reads without a restart.',
  }),
}).annotate({ identifier: 'EnvConfigResponse' })

/** @public */
export type EnvConfigResponse = typeof envConfigResponseSchema.Type
