/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The complete set of `ECO_*` levers an operator can pull, each resolved to
 * the value ACTUALLY in force plus the input that decided it.
 *
 * ## The list is written out by hand, on purpose
 *
 * Six of the eight levers have a parser module in this directory. The other
 * two do not, and each is invisible to a different shortcut:
 *
 * - `ECO_AI_PROVIDER_PRECEDENCE` parses one directory over, in
 *   `env/ai/ai-eco-routing.ts` — it is an AI-routing concern that happens to
 *   be eco-controlled.
 * - `ECO_FORM_ANALYTICS` had no parser at all until
 *   `./eco-form-analytics.ts` was extracted for this panel; it was read inline
 *   in `infrastructure/process/env.ts`, a layer this module cannot even import.
 *
 * Building this list by enumerating the directory therefore yields SIX rows
 * that all look entirely correct — plausible names, plausible values,
 * plausible provenance — while silently dropping two real levers. Nothing
 * about the resulting payload looks wrong, which is exactly why it must not be
 * generated. Adding a lever means adding a line here.
 *
 * @see [internal ref] — the operator-facing table
 * @see [internal ref] — D2 (env vars, not schema)
 */

import { parseAiProviderPrecedence } from '@/domain/models/process-env/ai/ai-eco-routing'
import { parseEcoDesignLayer } from '@/domain/models/process-env/eco/eco-design-layer'
import { parseEcoFormAnalytics } from '@/domain/models/process-env/eco/eco-form-analytics'
import { parseEcoIndexHeader } from '@/domain/models/process-env/eco/eco-index-header'
import { resolveEffectiveLowDataDefault } from '@/domain/models/process-env/eco/eco-low-data-default'
import { parseEcoMode } from '@/domain/models/process-env/eco/eco-mode'
import { parseEcoPageCache } from '@/domain/models/process-env/eco/eco-page-cache'
import { parseEcoPageCacheMaxMb } from '@/domain/models/process-env/eco/eco-page-cache-max-mb'

/**
 * Which input decided a lever's effective value.
 *
 * The same three-way discriminator `lowDataMode` already uses, so the two
 * panels read alike: `explicit` is the operator's own recognised value,
 * `eco-mode` is the `ECO_MODE` master posture deciding on their behalf, and
 * `default` is the platform fallback.
 */
export type EcoLeverSource = 'explicit' | 'eco-mode' | 'default'

/** One row of the footprint dashboard's `levers` panel. */
export interface EcoLever {
  /** Env var name, verbatim. */
  readonly name: string
  /** The value actually in force for this process right now. */
  readonly effective: string | number
  /** Which input decided {@link effective}. */
  readonly source: EcoLeverSource
}

/** Normalisation used by the parsers that trim and case-fold. */
const trimLower = (raw: string | undefined): string | undefined => raw?.trim().toLowerCase()

/** Normalisation used by the parsers that trim but preserve case. */
const trimOnly = (raw: string | undefined): string | undefined => raw?.trim()

/**
 * Build a lever row, deriving provenance from whether the operator's raw value
 * ROUND-TRIPS through its parser unchanged.
 *
 * This is the drift-proof way to say "recognised". Re-declaring each parser's
 * accepted tokens here would let the panel keep reporting `default` for a
 * value the parser learned to accept — the panel would be wrong in exactly the
 * quiet, plausible-looking way this whole surface exists to retire. Comparing
 * against the parser's own output cannot go stale: if the parser accepts it,
 * the raw value survives the round trip and the row says `explicit`; if the
 * parser rejects it and falls back, it does not.
 *
 * The one deliberate rough edge: a value the parser NORMALISES rather than
 * rejects (`ECO_PAGE_CACHE_MAX_MB=064` → `64`) reports `default`. Reporting
 * the platform fallback for an input the platform rewrote is the conservative
 * of the two possible errors.
 */
const lever = (name: string, effective: string | number, raw: string | undefined): EcoLever => ({
  name,
  effective,
  source: raw !== undefined && raw === String(effective) ? 'explicit' : 'default',
})

/**
 * Resolve every eco lever from a snapshot of env vars.
 *
 * Order matches the operator-facing table in the ecoconception pattern doc.
 * `ECO_LOW_DATA_DEFAULT` is the one row that does not go through
 * {@link lever}: it is the only lever `ECO_MODE` can decide on the operator's
 * behalf, so its provenance comes from the same resolver the low-data
 * middleware reads at request time — the dashboard must never have its own
 * opinion about a posture something else enforces.
 */
export const resolveEcoLevers = (
  processEnv: Readonly<Record<string, string | undefined>>
): readonly EcoLever[] => {
  const lowData = resolveEffectiveLowDataDefault(processEnv)
  return [
    lever('ECO_MODE', parseEcoMode(processEnv), trimLower(processEnv['ECO_MODE'])),
    { name: 'ECO_LOW_DATA_DEFAULT', effective: lowData.effective, source: lowData.source },
    lever(
      'ECO_INDEX_HEADER',
      parseEcoIndexHeader(processEnv),
      trimLower(processEnv['ECO_INDEX_HEADER'])
    ),
    lever(
      'ECO_DESIGN_LAYER',
      parseEcoDesignLayer(processEnv),
      trimLower(processEnv['ECO_DESIGN_LAYER'])
    ),
    lever('ECO_PAGE_CACHE', parseEcoPageCache(processEnv), trimLower(processEnv['ECO_PAGE_CACHE'])),
    lever(
      'ECO_PAGE_CACHE_MAX_MB',
      parseEcoPageCacheMaxMb(processEnv),
      trimOnly(processEnv['ECO_PAGE_CACHE_MAX_MB'])
    ),
    // Parser lives in `env/ai/`, not this directory — outlier #1.
    lever(
      'ECO_AI_PROVIDER_PRECEDENCE',
      parseAiProviderPrecedence(processEnv),
      trimOnly(processEnv['ECO_AI_PROVIDER_PRECEDENCE'])
    ),
    // Had no parser module at all until this panel needed one — outlier #2.
    lever(
      'ECO_FORM_ANALYTICS',
      parseEcoFormAnalytics(processEnv),
      processEnv['ECO_FORM_ANALYTICS']
    ),
  ]
}
