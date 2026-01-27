/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find Active TDD PR Program
 *
 * Effect program that checks for any active TDD automation PRs.
 * Used to enforce serial processing (one spec at a time).
 */

import { Effect } from 'effect'
import { ActiveTDDPRExists } from '../core/errors'
import { TDD_LABELS, type TDDPullRequest } from '../core/types'
import { GitHubApi } from '../services/github-api'

/**
 * Result of finding an active TDD PR
 */
export interface ActivePRResult {
  readonly hasActivePR: boolean
  readonly activePR: TDDPullRequest | null
}

/**
 * Find any active TDD PR
 *
 * Returns the active PR if one exists, or null if none.
 * Does NOT fail if an active PR exists - use `requireNoActivePR` for that.
 *
 * @returns ActivePRResult with optional active PR
 */
export const findActiveTDDPR = Effect.gen(function* () {
  const github = yield* GitHubApi

  const prs = yield* github.listTDDPRs()

  // Filter to open PRs without manual intervention label
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

/**
 * Require no active TDD PR exists
 *
 * Fails with ActiveTDDPRExists if a TDD PR is currently active.
 * Used before creating a new TDD PR to enforce serial processing.
 *
 * @returns void on success
 * @throws ActiveTDDPRExists if an active TDD PR exists
 */
export const requireNoActivePR = Effect.gen(function* () {
  const result = yield* findActiveTDDPR

  if (result.hasActivePR && result.activePR) {
    return yield* new ActiveTDDPRExists({
      prNumber: result.activePR.number,
      specId: result.activePR.specId,
    })
  }
})
