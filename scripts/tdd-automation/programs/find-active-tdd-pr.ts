/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { TDD_LABELS } from '../core/config'
import { ActiveTDDPRExists } from '../core/errors'
import { type TDDPullRequest } from '../core/types'
import { ForgejoApi } from '../services/vcs-api'

export interface ActivePRResult {
  readonly hasActivePR: boolean
  readonly activePR: TDDPullRequest | null
}

export const findActiveTDDPR = Effect.gen(function* () {
  const forgejo = yield* ForgejoApi

  const prs = yield* forgejo.listTDDPRs()

  const activePRs = prs.filter(
    (pr) =>
      pr.labels.includes(TDD_LABELS.AUTOMATION) &&
      !pr.labels.includes(TDD_LABELS.MANUAL_INTERVENTION)
  )

  if (activePRs.length === 0) {
    return {
      hasActivePR: false,
      activePR: null,
    } satisfies ActivePRResult
  }

  return {
    hasActivePR: true,
    activePR: activePRs[0] ?? null,
  } satisfies ActivePRResult
})

export const requireNoActivePR = Effect.gen(function* () {
  const result = yield* findActiveTDDPR

  if (result.hasActivePR && result.activePR) {
    return yield* new ActiveTDDPRExists({
      prNumber: result.activePR.number,
      specId: result.activePR.specId,
    })
  }
})
