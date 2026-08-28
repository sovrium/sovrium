/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_FORM_ANALYTICS` env var — operator-controlled recording of
 * form-submission analytics events (see
 * `[internal ref]`).
 *
 * Recording is ON by default; operators opt OUT with `off` for an
 * ultra-frugal posture.
 *
 * This module exists because the lever previously had NO parser of its own: it
 * was read inline in `infrastructure/utils/env.ts`, which left it invisible to
 * anything enumerating the eco parsers — precisely the omission the footprint
 * `levers` panel must not reproduce. `isFormAnalyticsEnabled()` now delegates
 * here, so the variable has exactly one reader.
 *
 * This module originally kept the inline read's EXACT comparison — no trimming,
 * no case folding — on the reasoning that widening the accepted spellings of
 * `off` would be a behaviour change dressed up as a refactor. [internal ref] has since
 * superseded that reasoning: a SET-but-unrecognised `ECO_*` value now throws
 * rather than silently resolving to the default. The old behaviour meant
 * `ECO_FORM_ANALYTICS=OFF` kept recording, and an operator who had plainly
 * expressed an intent never learned it was discarded — the same failure [internal ref]
 * exists to end. The parser is therefore folded onto the shared helper, which
 * also makes it enumerable by the boot-time validator in
 * `infrastructure/server/validate-eco-env.ts`.
 */
import { parseEcoEnum } from './eco-env-parsing'

export type EcoFormAnalyticsMode = 'on' | 'off'

const ECO_FORM_ANALYTICS_MODES: readonly EcoFormAnalyticsMode[] = ['on', 'off']

/** Default when `ECO_FORM_ANALYTICS` is unset — recording is opt-OUT. */
export const DEFAULT_ECO_FORM_ANALYTICS: EcoFormAnalyticsMode = 'on'

/**
 * Resolve `ECO_FORM_ANALYTICS` from a snapshot of env vars. Unset or empty
 * resolves to the default (`on`); `off` (case-insensitive, surrounding
 * whitespace ignored) disables recording.
 *
 * @throws Error when set to anything other than `on` or `off`.
 */
export const parseEcoFormAnalytics = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoFormAnalyticsMode =>
  parseEcoEnum('ECO_FORM_ANALYTICS', processEnv['ECO_FORM_ANALYTICS'], {
    allowed: ECO_FORM_ANALYTICS_MODES,
    fallback: DEFAULT_ECO_FORM_ANALYTICS,
  })
