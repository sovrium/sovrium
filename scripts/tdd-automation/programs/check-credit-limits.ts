/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { CreditsExhausted } from '../core/errors'

export interface CreditCheckResult {
  readonly canProceed: boolean
  readonly warnings: readonly string[]
}

export const checkCreditLimits = Effect.gen(function* () {
  const probeExhausted = process.env['PROBE_EXHAUSTED'] === 'true'

  if (probeExhausted) {
    return yield* new CreditsExhausted({
      probeResult: {
        rawJson: 'Credits exhausted (detected by workflow probe)',
        errorMessage: 'Credits exhausted (is_error=true AND total_cost_usd=0)',
      },
    })
  }

  return {
    canProceed: true,
    warnings: [],
  } satisfies CreditCheckResult
})
