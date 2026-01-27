/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Sync Status CLI Entry Point
 *
 * CLI script called by test.yml workflow to check if a TDD branch
 * is in sync with main.
 *
 * Usage:
 *   BRANCH_NAME=tdd/app-001 bun run scripts/tdd-automation/workflows/test/check-sync-status.ts
 *
 * Output (JSON):
 *   { "inSync": true, "commitsBehind": 0 }
 *   { "inSync": false, "commitsBehind": 5, "needsRebase": true }
 */

import { Effect, Console } from 'effect'
import { LiveLayer } from '../../layers/live'
import { GitOperations } from '../../services/git-operations'

const main = Effect.gen(function* () {
  const git = yield* GitOperations

  const branchName = process.env['BRANCH_NAME']
  if (!branchName) {
    yield* Console.error('::error::BRANCH_NAME environment variable not set')
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(
      JSON.stringify({
        inSync: false,
        error: 'BRANCH_NAME not set',
      })
    )
    return
  }

  // Fetch and check status
  yield* git.fetch()
  const status = yield* git.getBranchStatus(branchName)

  // effect-disable-next-line preferSchemaOverJson
  yield* Console.log(
    JSON.stringify({
      inSync: !status.isBehindMain,
      commitsBehind: status.commitsBehind,
      commitsAhead: status.commitsAhead,
      needsRebase: status.isBehindMain,
    })
  )
}).pipe(
  Effect.catchTag('GitOperationError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::Git error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          inSync: false,
          error: `Git error: ${error.operation}`,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
