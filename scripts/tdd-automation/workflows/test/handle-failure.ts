/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Handle Failure CLI Entry Point
 *
 * CLI script called by test.yml workflow when tests fail for a TDD PR.
 * Increments attempt counter and triggers Claude Code workflow.
 *
 * Usage:
 *   PR_NUMBER=123 bun run scripts/tdd-automation/workflows/test/handle-failure.ts
 *
 * Output (JSON):
 *   { "handled": true, "newAttempt": 2, "triggeredClaudeCode": true }
 *   { "handled": false, "reachedMax": true, "needsManualIntervention": true }
 */

import { Effect, Console } from 'effect'
import { LiveLayer } from '../../layers/live'
import { incrementAttempt } from '../../programs/increment-attempt'
import { GitHubApi } from '../../services/github-api'

const main = Effect.gen(function* () {
  const github = yield* GitHubApi

  const prNumberStr = process.env['PR_NUMBER']
  if (!prNumberStr) {
    yield* Console.error('::error::PR_NUMBER environment variable not set')
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(
      JSON.stringify({
        handled: false,
        error: 'PR_NUMBER not set',
      })
    )
    return
  }

  const prNumber = parseInt(prNumberStr, 10)
  const result = yield* incrementAttempt(prNumber)

  // Post comment about the retry
  yield* github.postComment(
    prNumber,
    `## Test Failure - Attempt ${result.newAttempt}/${result.maxAttempts}

The previous attempt failed. Starting retry attempt ${result.newAttempt}.

---

*This comment was posted by the TDD automation pipeline.*`
  )

  // effect-disable-next-line preferSchemaOverJson
  yield* Console.log(
    JSON.stringify({
      handled: true,
      previousAttempt: result.previousAttempt,
      newAttempt: result.newAttempt,
      maxAttempts: result.maxAttempts,
      triggeredClaudeCode: true,
    })
  )
}).pipe(
  Effect.catchTag('MaxAttemptsReached', (error) =>
    Effect.gen(function* () {
      yield* Console.warn(
        `::warning::Max attempts reached for PR #${error.prNumber} (${error.specId})`
      )
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          handled: false,
          reachedMax: true,
          prNumber: error.prNumber,
          specId: error.specId,
          attempts: error.attempts,
          needsManualIntervention: true,
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
          handled: false,
          error: `GitHub API error: ${error.operation}`,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
