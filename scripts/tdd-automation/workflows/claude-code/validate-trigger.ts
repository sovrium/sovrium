/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validate Trigger CLI Entry Point
 *
 * CLI script called by claude-code.yml workflow to validate
 * that the trigger is from a valid TDD PR and has credits available.
 *
 * Usage:
 *   PR_NUMBER=123 bun run scripts/tdd-automation/workflows/claude-code/validate-trigger.ts
 *
 * Output (JSON):
 *   { "valid": true, "specId": "APP-001", "attempt": 2 }
 *   { "valid": false, "reason": "Not a TDD PR" }
 */

import { Effect, Console } from 'effect'
import { TDD_LABELS } from '../../core/config'
import { parseTDDPRTitle } from '../../core/parse-pr-title'
import { LiveLayer } from '../../layers/live'
import { checkCreditLimits } from '../../programs/check-credit-limits'
import { GitHubApi } from '../../services/github-api'

const main = Effect.gen(function* () {
  const github = yield* GitHubApi

  const prNumberStr = process.env['PR_NUMBER']
  if (!prNumberStr) {
    yield* Console.log(
      // effect-disable-next-line preferSchemaOverJson
      JSON.stringify({
        valid: false,
        reason: 'PR_NUMBER not set',
      })
    )
    return
  }

  const prNumber = parseInt(prNumberStr, 10)

  // Get PR details
  const pr = yield* github.getPR(prNumber)

  // Check if it has TDD label
  if (!pr.labels?.includes(TDD_LABELS.AUTOMATION)) {
    yield* Console.log(
      // effect-disable-next-line preferSchemaOverJson
      JSON.stringify({
        valid: false,
        reason: 'Not a TDD PR (missing label)',
      })
    )
    return
  }

  // Check for manual intervention label
  if (pr.labels?.includes(TDD_LABELS.MANUAL_INTERVENTION)) {
    yield* Console.log(
      // effect-disable-next-line preferSchemaOverJson
      JSON.stringify({
        valid: false,
        reason: 'PR marked for manual intervention',
      })
    )
    return
  }

  // Parse title
  const parsed = parseTDDPRTitle(pr.title)
  if (!parsed) {
    yield* Console.log(
      // effect-disable-next-line preferSchemaOverJson
      JSON.stringify({
        valid: false,
        reason: 'Invalid TDD PR title format',
      })
    )
    return
  }

  // Check credit limits
  const creditResult = yield* checkCreditLimits

  if (!creditResult.canProceed) {
    yield* Console.log(
      // effect-disable-next-line preferSchemaOverJson
      JSON.stringify({
        valid: false,
        reason: 'Credit limit exceeded',
        dailySpend: creditResult.dailySpend,
        weeklySpend: creditResult.weeklySpend,
      })
    )
    return
  }

  // Log warnings if any
  for (const warning of creditResult.warnings) {
    yield* Console.warn(`::warning::${warning}`)
  }

  yield* Console.log(
    // effect-disable-next-line preferSchemaOverJson
    JSON.stringify({
      valid: true,
      prNumber,
      specId: parsed.specId,
      attempt: parsed.attempt,
      maxAttempts: parsed.maxAttempts,
      branch: pr.branch,
    })
  )
}).pipe(
  Effect.catchTag('CreditLimitExceeded', (error) =>
    Effect.gen(function* () {
      yield* Console.warn(`::warning::Credit limit exceeded: ${error.limit}`)
      yield* Console.log(
        // effect-disable-next-line preferSchemaOverJson
        JSON.stringify({
          valid: false,
          reason: `Credit limit exceeded (${error.limit})`,
          dailySpend: error.dailySpend,
          weeklySpend: error.weeklySpend,
        })
      )
    })
  ),
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      yield* Console.log(
        // effect-disable-next-line preferSchemaOverJson
        JSON.stringify({
          valid: false,
          reason: `GitHub API error: ${error.operation}`,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
