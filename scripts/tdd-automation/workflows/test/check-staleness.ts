/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Staleness CLI Entry Point
 *
 * CLI script called by test.yml workflow to determine if Claude Code
 * should be triggered based on staleness protection rules.
 *
 * Prevents phantom runs from blocking TDD automation by ignoring runs
 * not updated in 30+ minutes.
 *
 * Usage:
 *   CURRENT_RUN_ID=12345 \
 *   CURRENT_RUN_STARTED_AT=2025-01-31T10:00:00Z \
 *   BRANCH=tdd/implement-API-001 \
 *   GITHUB_REPOSITORY=owner/repo \
 *   bun run scripts/tdd-automation/workflows/test/check-staleness.ts
 *
 * Output (JSON):
 *   { "shouldTrigger": true, "pendingTests": 0, "activeClaude": 0, "newerClaudeRuns": 0 }
 *   { "shouldTrigger": false, "skipReason": "pending_tests", "pendingTests": 2, ... }
 */

import { Effect, Console } from 'effect'
import { checkStalenessWithRecovery } from '../../programs/staleness-check'

const main = Effect.gen(function* () {
  // Read environment variables
  const currentRunId = process.env['CURRENT_RUN_ID']
  const currentRunStartedAt = process.env['CURRENT_RUN_STARTED_AT']
  const branch = process.env['BRANCH']
  const repository = process.env['GITHUB_REPOSITORY']

  // Validate required inputs
  if (!currentRunId) {
    yield* Console.error('::error::CURRENT_RUN_ID environment variable not set')
    yield* Console.log(JSON.stringify({ shouldTrigger: true, error: 'CURRENT_RUN_ID not set' }))
    return
  }

  if (!currentRunStartedAt) {
    yield* Console.error('::error::CURRENT_RUN_STARTED_AT environment variable not set')
    yield* Console.log(
      JSON.stringify({ shouldTrigger: true, error: 'CURRENT_RUN_STARTED_AT not set' })
    )
    return
  }

  if (!branch) {
    yield* Console.error('::error::BRANCH environment variable not set')
    yield* Console.log(JSON.stringify({ shouldTrigger: true, error: 'BRANCH not set' }))
    return
  }

  if (!repository) {
    yield* Console.error('::error::GITHUB_REPOSITORY environment variable not set')
    yield* Console.log(JSON.stringify({ shouldTrigger: true, error: 'GITHUB_REPOSITORY not set' }))
    return
  }

  yield* Console.error('🔍 Checking if there are other test.yml runs after this one...')

  // Run staleness check
  const result = yield* checkStalenessWithRecovery({
    currentRunId,
    branch,
    currentRunStartedAt: new Date(currentRunStartedAt),
    repository,
  })

  // Log status for debugging
  yield* Console.error('📊 Status:')
  yield* Console.error(
    `   Other test.yml runs (queued/running, updated <30min): ${result.pendingTests}`
  )
  yield* Console.error(
    `   Total Claude Code runs (queued/running, updated <30min): ${result.activeClaude}`
  )
  yield* Console.error(`   Claude Code runs started after this test: ${result.newerClaudeRuns}`)

  // Log decision
  if (!result.shouldTrigger) {
    if (result.skipReason === 'pending_tests') {
      yield* Console.error(
        `⏭️ Skipping @claude comment: ${result.pendingTests} test run(s) pending after this one`
      )
      yield* Console.error(
        '   The last test.yml run will trigger Claude Code with the most recent failure'
      )
    } else if (result.skipReason === 'active_claude_run') {
      yield* Console.error(
        `⏭️ Skipping @claude comment: ${result.activeClaude} Claude Code run(s) already active on this branch`
      )
      yield* Console.error('   Waiting for active run to complete before triggering another')
    }
  } else {
    yield* Console.error(
      '✅ This is the last test run and no newer Claude Code runs - will trigger execution'
    )
  }

  // Output JSON for workflow parsing
  yield* Console.log(JSON.stringify(result))
})

Effect.runPromise(main)
