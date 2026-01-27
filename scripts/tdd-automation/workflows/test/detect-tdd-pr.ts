/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Detect TDD PR CLI Entry Point
 *
 * CLI script called by test.yml workflow to determine if a test run
 * is for a TDD automation PR.
 *
 * Usage:
 *   PR_NUMBER=123 bun run scripts/tdd-automation/workflows/test/detect-tdd-pr.ts
 *   # or
 *   BRANCH_NAME=tdd/app-001 bun run scripts/tdd-automation/workflows/test/detect-tdd-pr.ts
 *
 * Output (JSON):
 *   { "isTDDPR": true, "prNumber": 123, "specId": "APP-001", "attempt": 1 }
 *   { "isTDDPR": false }
 */

import { Effect, Console } from 'effect'
import { TDD_LABELS } from '../../core/config'
import { parseTDDPRTitle, extractSpecIdFromBranch } from '../../core/parse-pr-title'
import { LiveLayer } from '../../layers/live'
import { GitHubApi } from '../../services/github-api'

const main = Effect.gen(function* () {
  const github = yield* GitHubApi

  const prNumber = process.env['PR_NUMBER']
  const branchName = process.env['BRANCH_NAME']

  // If no PR number, check if branch matches TDD pattern
  if (!prNumber && branchName) {
    const specId = extractSpecIdFromBranch(branchName)
    if (specId) {
      // Try to find PR by branch
      const prs = yield* github.listTDDPRs()
      const matchingPR = prs.find((pr) => pr.branch === branchName)

      if (matchingPR) {
        // @effect-diagnostics effect/preferSchemaOverJson:off
        yield* Console.log(
          JSON.stringify({
            isTDDPR: true,
            prNumber: matchingPR.number,
            specId: matchingPR.specId,
            attempt: matchingPR.attempt,
          })
        )
        return
      }
    }

    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(JSON.stringify({ isTDDPR: false }))
    return
  }

  if (!prNumber) {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(JSON.stringify({ isTDDPR: false }))
    return
  }

  // Get PR details
  const pr = yield* github.getPR(parseInt(prNumber, 10))

  // Check if it has TDD label
  if (!pr.labels?.includes(TDD_LABELS.AUTOMATION)) {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(JSON.stringify({ isTDDPR: false }))
    return
  }

  // Parse title
  const parsed = parseTDDPRTitle(pr.title)
  if (!parsed) {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(JSON.stringify({ isTDDPR: false }))
    return
  }

  // effect-disable-next-line preferSchemaOverJson
  yield* Console.log(
    JSON.stringify({
      isTDDPR: true,
      prNumber: parseInt(prNumber, 10),
      specId: parsed.specId,
      attempt: parsed.attempt,
      maxAttempts: parsed.maxAttempts,
    })
  )
}).pipe(
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(JSON.stringify({ isTDDPR: false, error: error.message }))
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
