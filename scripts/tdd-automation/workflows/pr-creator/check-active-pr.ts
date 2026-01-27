/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Active PR CLI Entry Point
 *
 * CLI script called by pr-creator.yml workflow to check for active TDD PRs.
 * Enforces serial processing (one spec at a time).
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/pr-creator/check-active-pr.ts
 *
 * Output (JSON):
 *   { "hasActivePR": false, "activePR": null }
 *   { "hasActivePR": true, "activePR": { "number": 123, "specId": "APP-001", ... } }
 */

import { Effect, Console } from 'effect'
import { LiveLayer } from '../../layers/live'
import { findActiveTDDPR } from '../../programs/find-active-tdd-pr'

const main = Effect.gen(function* () {
  const result = yield* findActiveTDDPR

  if (result.hasActivePR && result.activePR) {
    yield* Console.warn(
      `::warning::Active TDD PR exists: #${result.activePR.number} (${result.activePR.specId})`
    )
  }

  // Output JSON for YAML to parse
  yield* Console.log(JSON.stringify(result))
}).pipe(
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      yield* Console.log(
        JSON.stringify({
          hasActivePR: false,
          activePR: null,
          error: `GitHub API error: ${error.operation}`,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
