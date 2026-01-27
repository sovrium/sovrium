/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Increment Attempt Program
 *
 * Effect program that increments the attempt counter in a TDD PR title.
 * Used when a test run fails to track retry attempts.
 */

import { Effect } from 'effect'
import { TDD_LABELS, formatTDDPRTitle } from '../core/config'
import { MaxAttemptsReached, GitHubApiError } from '../core/errors'
import { parseTDDPRTitle } from '../core/parse-pr-title'
import { GitHubApi } from '../services/github-api'

/**
 * Result of incrementing attempt
 */
export interface IncrementAttemptResult {
  readonly prNumber: number
  readonly previousAttempt: number
  readonly newAttempt: number
  readonly maxAttempts: number
  readonly reachedMax: boolean
  readonly newTitle: string
}

/**
 * Increment the attempt counter for a TDD PR
 *
 * Steps:
 * 1. Parse current PR title to get attempt number
 * 2. Check if max attempts reached
 * 3. If max reached, add manual-intervention label
 * 4. Otherwise, increment attempt in title
 *
 * @param prNumber PR number to update
 * @returns IncrementAttemptResult with new attempt details
 * @throws MaxAttemptsReached if already at max attempts
 */
export const incrementAttempt = (prNumber: number) =>
  Effect.gen(function* () {
    const github = yield* GitHubApi

    // Get current PR
    const pr = yield* github.getPR(prNumber)

    // Parse title
    const parsed = parseTDDPRTitle(pr.title)
    if (!parsed) {
      return yield* new GitHubApiError({
        operation: 'incrementAttempt',
        cause: new Error(`Invalid TDD PR title format: ${pr.title}`),
      })
    }

    const previousAttempt = parsed.attempt
    const newAttempt = previousAttempt + 1
    const { maxAttempts } = parsed

    // Check if we've reached max attempts
    if (newAttempt > maxAttempts) {
      // Add manual intervention label
      yield* github.addLabel(prNumber, TDD_LABELS.MANUAL_INTERVENTION)

      // Post comment explaining the situation
      yield* github.postComment(
        prNumber,
        `## Manual Intervention Required

This PR has reached the maximum of ${maxAttempts} automated attempts.

**Spec ID**: \`${parsed.specId}\`

### What to do next:

1. Review the failed test runs to understand the issue
2. Either fix the implementation manually, or
3. Update the spec if it's incorrect
4. Remove the \`${TDD_LABELS.MANUAL_INTERVENTION}\` label to re-enable automation

---

*This message was posted by the TDD automation pipeline.*`
      )

      return yield* new MaxAttemptsReached({
        prNumber,
        specId: parsed.specId,
        attempts: previousAttempt,
      })
    }

    // Update title with incremented attempt
    const newTitle = formatTDDPRTitle(parsed.specId, newAttempt, maxAttempts)
    yield* github.updatePRTitle(prNumber, newTitle)

    return {
      prNumber,
      previousAttempt,
      newAttempt,
      maxAttempts,
      reachedMax: false,
      newTitle,
    } satisfies IncrementAttemptResult
  })

/**
 * Check if a PR has remaining attempts
 *
 * @param prNumber PR number to check
 * @returns true if attempts remain, false if at max
 */
export const hasRemainingAttempts = (prNumber: number) =>
  Effect.gen(function* () {
    const github = yield* GitHubApi
    const pr = yield* github.getPR(prNumber)
    const parsed = parseTDDPRTitle(pr.title)

    if (!parsed) {
      return false
    }

    return parsed.attempt < parsed.maxAttempts
  })
