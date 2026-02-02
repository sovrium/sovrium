#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate Credit Comment CLI Entry Point
 *
 * CLI script called by claude-code.yml workflow to generate credit usage markdown comment.
 * Reads metrics from environment variables and outputs markdown to stdout.
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/claude-code/generate-credit-comment.ts
 *
 * Environment Variables:
 *   credits-ok, limit-type, daily-runs, weekly-runs, actual-daily, actual-weekly,
 *   daily-limit, weekly-limit, daily-remaining, weekly-remaining, daily-percent,
 *   weekly-percent, hours-until-daily-reset, days-until-weekly-reset
 *
 * Output (Markdown):
 *   Complete credit usage comment markdown written to stdout
 */

import { Effect, Console } from 'effect'
import { generateCreditComment, parseCreditMetrics } from '../../services/credit-comment-generator'

const main = Effect.gen(function* () {
  // Parse metrics from environment variables (GitHub Actions outputs)
  const metrics = yield* parseCreditMetrics(process.env as Record<string, string>)

  // Generate markdown comment
  const comment = yield* generateCreditComment(metrics)

  // Output markdown to stdout (will be written to file by YAML)
  yield* Console.log(comment)
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::Failed to generate credit comment: ${error}`)
      return yield* error
    })
  )
)

await Effect.runPromise(main)
