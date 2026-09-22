/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolution status of every variable declared in `app.env[]`.
 *
 * Backs `GET /api/admin/env` and the `/_admin/env` viewer — the second surface
 * authorised by [internal ref] amendment A1. Answers the operator's mid-incident
 * question ("is `STRIPE_KEY` actually set on this box, or is it silently
 * falling back to a default?") without ever carrying the value that would
 * answer it by inspection.
 *
 * ─── SCOPE: DECLARED VARIABLES, NOT `process.env` ───────────────────────────
 *
 * This enumerates what the app DECLARES it uses. A `process.env` dump would
 * carry the database URL, the auth secret, the storage credentials and the
 * hosting platform's own injected variables — an inventory both larger than the
 * app and none of the console's business.
 *
 * ─── WHY THE STATUS IS NOT DERIVED FROM `buildEnvLookup` ────────────────────
 *
 * `buildEnvLookup` is LOSSY for is-set: it collapses "unset" and "set to the
 * empty string" to the same `''`. Deriving the status from it reports a blanked
 * variable as SET — the single most misleading answer this page could give an
 * operator mid-incident. The rungs below are therefore computed from
 * `processEnv[key]` directly, mirroring `buildEnvLookup`'s documented ORDER
 * (OS env when non-empty, then the declared default, then nothing) without
 * inheriting its collapse.
 *
 * ─── NO RESOLVED VALUE, BY CONSTRUCTION ─────────────────────────────────────
 *
 * Nothing here reads a RESOLVED value into the output. `masked` is the fixed
 * `ENV_VALUE_MASK` constant — fixed-width so it cannot become a length oracle.
 *
 * The declared `default` is the one literal that can be released, and only
 * because its author said so. `EnvVarSchema` carries a `secret` marker whose
 * polarity does the safety work: it defaults to TRUE, so a config that predates
 * it — or one whose author simply did not think about it — keeps every default
 * withheld. `default: '3000'` on a port and `default: 'sk_live_…'` on an API key
 * are the same field and only the author can tell them apart, so an unmarked
 * default is treated as a credential.
 *
 * `hasDefault` stays unconditional and independent of that gate. It answers "is
 * there a fallback at all?" for every variable, including the withheld
 * majority, and pairs with `source: 'default'` to say whether that fallback is
 * currently in force. Because it is always present, a missing `defaultValue` is
 * never ambiguous: it means withheld, never absent.
 *
 * Keys and descriptions are config-declared IDENTIFIERS authored by the
 * operator and are emitted verbatim — running a substring scrub over them would
 * rewrite `PROD_API_BASE` to `***_API_BASE` on any instance with `TIER=PROD`,
 * making the page unreadable in exactly the incident where it must be read.
 *
 * @see [internal ref] (A1)
 * @see src/application/use-cases/automations/resolve-env-vars.ts — `buildEnvLookup`
 */

import { ENV_VALUE_MASK } from '@/domain/models/api/admin/env'
import type { EnvDefaultState, EnvValueSource, EnvVarStatus } from '@/domain/models/api/admin/env'
import type { App } from '@/domain/models/app'
import type { EnvVar } from '@/domain/models/app/env'

/**
 * Which rung supplied this variable, computed from the OS environment directly.
 *
 * An OS value must be non-empty to win — `BLANK_ON_PURPOSE=''` is a variable the
 * deployment explicitly blanked, and reporting it as configured would be a lie.
 * A declared default must likewise be non-empty: `default: ''` resolves to the
 * same nothing as no default at all.
 */
function resolveSource(
  envVar: EnvVar,
  processEnv: Readonly<Record<string, string | undefined>>
): EnvValueSource {
  const fromOs = processEnv[envVar.key]
  if (fromOs !== undefined && fromOs !== '') return 'environment'
  if (envVar.default !== undefined && envVar.default !== '') return 'default'
  return 'unset'
}

/**
 * Whether this variable's declared default may be echoed back to the operator.
 *
 * Gated on an EXPLICIT `secret: false` rather than on falsiness: `undefined`
 * must behave exactly as `true`, so that upgrading an app authored before the
 * marker existed discloses nothing that was hidden the day before. A
 * `!envVar.secret` test would invert precisely that case.
 */
function disclosesDefault(envVar: EnvVar): boolean {
  return envVar.secret === false && envVar.default !== undefined
}

/**
 * The declared default's state, collapsing `hasDefault` x disclosure into the
 * one three-way fact a declarative reader can gate on.
 *
 * Derived from the same two predicates the neighbouring fields use, so the
 * three can never disagree: `disclosed` is emitted if and only if
 * `defaultValue` is, and `none` if and only if `hasDefault` is false.
 */
function defaultStateOf(envVar: EnvVar): EnvDefaultState {
  if (envVar.default === undefined) return 'none'
  return disclosesDefault(envVar) ? 'disclosed' : 'withheld'
}

/** Project one declared variable to its status row. */
function statusOf(
  envVar: EnvVar,
  processEnv: Readonly<Record<string, string | undefined>>
): Readonly<EnvVarStatus> {
  const source = resolveSource(envVar, processEnv)
  const isSet = source !== 'unset'
  return {
    key: envVar.key,
    // Verbatim: an operator-authored description is an identifier, not a value.
    ...(envVar.description === undefined ? {} : { description: envVar.description }),
    // `required` defaults to true per `EnvVarSchema`, resolved here so consumers
    // never branch on undefined.
    required: envVar.required ?? true,
    // Presence, unconditionally — the diagnostic that must keep working for the
    // withheld majority.
    hasDefault: envVar.default !== undefined,
    // The same two predicates as one gate-able fact, for a reader that cannot
    // compute `hasDefault && defaultValue === undefined` for itself.
    defaultState: defaultStateOf(envVar),
    // The literal, only where the author took responsibility for it. Absent —
    // not empty-string — otherwise, so "withheld" never becomes
    // indistinguishable from "declared with a blank default".
    ...(disclosesDefault(envVar) ? { defaultValue: envVar.default } : {}),
    isSet,
    source,
    // eslint-disable-next-line unicorn/no-null -- the contract types `masked` as nullable, and `null` is the JSON-visible "no value resolved"
    masked: isSet ? ENV_VALUE_MASK : null,
  }
}

/**
 * Build the status row for every variable declared in `app.env[]`, in
 * DECLARATION order — the operator's grouping in `app.ts` is itself information
 * and an alphabetical re-sort would destroy it for no gain.
 *
 * An app declaring no `env` block yields `[]`, never `null`: "this app declares
 * no variables" is an answer, and a different one from "this endpoint could not
 * tell you".
 *
 * @public
 */
export function buildEnvVarStatuses(
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): ReadonlyArray<Readonly<EnvVarStatus>> {
  return (app.env ?? []).map((envVar) => statusOf(envVar, processEnv))
}
