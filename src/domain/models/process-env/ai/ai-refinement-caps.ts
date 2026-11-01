/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parsePositiveIntEnv } from '../positive-int-env'
import { isMeteredAiProvider } from './ai-chat-caps'

/**
 * How fast an app's AI fields are refined, whatever wrote the rows.
 *
 * One write can create a thousand rows, and each row with an AI field asks the
 * provider once. Two bounds keep that from becoming a burst of spend:
 *  - at most {@link REFINEMENT_MAX_CONCURRENT} provider calls are open at once,
 *    on every provider, a local model included;
 *  - on a metered provider, at most {@link METERED_REFINEMENT_BUDGET}
 *    refinements start per window (`AI_CHAT_RATE_WINDOW`, 60 seconds unset).
 *
 * A refinement over either bound waits its turn: it is queued, never dropped,
 * and the baseline value stays in the column meanwhile. `AI_CHAT_RATE_LIMIT=0`,
 * which lifts the chat's limit, lifts the window budget too.
 */

/** Provider calls one app's AI-field refinements may hold open at once. */
export const REFINEMENT_MAX_CONCURRENT = 4

/** Refinements one app may start per window on a metered provider. */
export const METERED_REFINEMENT_BUDGET = 600

const DEFAULT_WINDOW_SECONDS = 60

type EnvSnapshot = Readonly<Record<string, string | undefined>>

export interface RefinementBudget {
  /** Refinements allowed to start per window; `undefined` → no window budget. */
  readonly limit: number | undefined
  readonly windowSeconds: number
}

const isExplicitZero = (raw: string | undefined): boolean =>
  raw !== undefined && /^\s*0+\s*$/.test(raw)

/** The window budget AI-field refinements are paced to. */
export const resolveRefinementBudget = (env: EnvSnapshot): RefinementBudget => ({
  limit:
    isExplicitZero(env['AI_CHAT_RATE_LIMIT']) || !isMeteredAiProvider(env)
      ? undefined
      : METERED_REFINEMENT_BUDGET,
  windowSeconds: parsePositiveIntEnv(env['AI_CHAT_RATE_WINDOW']) ?? DEFAULT_WINDOW_SECONDS,
})
