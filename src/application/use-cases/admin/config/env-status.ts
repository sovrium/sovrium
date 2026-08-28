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
 * ─── NO VALUE, BY CONSTRUCTION ──────────────────────────────────────────────
 *
 * Nothing here reads a resolved value into the output. `masked` is the fixed
 * `ENV_VALUE_MASK` constant — fixed-width so it cannot become a length oracle —
 * and the declared `default` is reported as a boolean, never echoed:
 * `EnvVarSchema` has no `secret` marker, so `default: '3000'` is
 * indistinguishable from `default: 'sk_live_…'`.
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
import type { EnvValueSource, EnvVarStatus } from '@/domain/models/api/admin/env'
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
    // Presence only — the VALUE of a default is indistinguishable from a
    // fallback credential, so it is never echoed.
    hasDefault: envVar.default !== undefined,
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
