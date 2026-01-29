/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Credits CLI Entry Point
 *
 * CLI script called by pr-creator.yml workflow to check credit limits.
 * Outputs JSON for GitHub Actions to parse.
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/pr-creator/check-credits.ts
 *
 * Output (JSON):
 *   { "canProceed": true, "dailySpend": 50, "weeklySpend": 150, "warnings": [] }
 */

import { Effect, Console } from 'effect'
import { LiveLayer } from '../../layers/live'
import { checkCreditLimits } from '../../programs/check-credit-limits'

const main = Effect.gen(function* () {
  const result = yield* checkCreditLimits

  // Log warnings to GitHub Actions
  for (const warning of result.warnings) {
    yield* Console.warn(`::warning::${warning}`)
  }

  // Output JSON for YAML to parse
  // @effect-diagnostics effect/preferSchemaOverJson:off
  yield* Console.log(JSON.stringify(result))
}).pipe(
  Effect.catchTag('CreditsExhausted', (error) =>
    Effect.gen(function* () {
      yield* Console.error('::error::Claude Code API credits exhausted')
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          canProceed: false,
          exhausted: true,
          dailySpend: error.dailySpend,
          weeklySpend: error.weeklySpend,
          warnings: [
            'Claude Code API credits exhausted',
            `Probe result: ${error.probeResult.errorMessage ?? 'No error message'}`,
          ],
        })
      )
    })
  ),
  Effect.catchTag('CreditLimitExceeded', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::Credit limit exceeded: ${error.limit}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          canProceed: false,
          exhausted: false,
          dailySpend: error.dailySpend,
          weeklySpend: error.weeklySpend,
          warnings: [],
        })
      )
    })
  ),
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          canProceed: false,
          dailySpend: 0,
          weeklySpend: 0,
          warnings: [`GitHub API error: ${error.operation}`],
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
