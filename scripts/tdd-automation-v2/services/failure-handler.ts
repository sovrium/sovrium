/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Command, Options } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { $ } from 'bun'
import { Effect, Console, Layer } from 'effect'
import { StateManager, StateManagerLive } from '../core/state-manager'
import type { SpecError } from '../types'

type FailureType = 'regression' | 'spec-failure' | 'infrastructure'

interface GitHubCheck {
  name: string
  status: string
  conclusion: string | null
}

const FailureHandlerCommand = Command.make(
  'failure-handler',
  {
    file: Options.text('file'),
    pr: Options.integer('pr'),
    type: Options.text('type'),
    retryCount: Options.integer('retry-count'),
  },
  ({ file, pr, type, retryCount }) =>
    Effect.gen(function* () {
      const failureType = type as FailureType
      const nextAttempt = retryCount + 1

      yield* Console.log(
        `🔄 Handling ${failureType} failure for ${file} (attempt ${nextAttempt}/3)`
      )

      // Get error details from PR
      const errorDetails = yield* Effect.tryPromise({
        try: async () => {
          const proc = await $`gh pr view ${pr} --json statusCheckRollup`.nothrow().quiet()
          const data = JSON.parse(proc.stdout.toString())
          const checks = (data.statusCheckRollup || []) as GitHubCheck[]
          const failedChecks = checks.filter(
            (check: GitHubCheck) =>
              check.conclusion === 'FAILURE' || check.conclusion === 'CANCELLED'
          )

          return {
            message: failedChecks
              .map((check: GitHubCheck) => `${check.name}: ${check.conclusion}`)
              .join(', '),
            details: JSON.stringify(failedChecks, null, 2),
          }
        },
        catch: () => ({
          message: 'Failed to retrieve error details',
          details: '',
        }),
      })

      // Create error object
      const error: SpecError = {
        timestamp: new Date().toISOString(),
        type: failureType,
        message: errorDetails.message,
        details: errorDetails.details,
      }

      // Close PR with failure comment
      const comment = generateFailureComment(failureType, nextAttempt, errorDetails)

      yield* Effect.tryPromise({
        try: async () => {
          await $`gh pr close ${pr} --comment ${comment}`.nothrow()
        },
        catch: (err) => new Error(`Failed to close PR: ${err}`),
      })

      yield* Console.log(`❌ Closed PR #${pr} with failure comment`)

      // Update state
      const stateManager = yield* StateManager

      if (nextAttempt >= 3) {
        // 3rd failure → manual intervention
        yield* Console.log(`⚠️  Moving ${file} to manual intervention (3 failures)`)

        const manualInterventionDetails = {
          errors: [error],
          failureReason: `Failed 3 times due to ${failureType}`,
          requiresAction: generateActionGuide(failureType, errorDetails),
        }

        yield* stateManager.moveToManualIntervention(file, manualInterventionDetails)

        yield* Console.log(`📋 Spec moved to failed queue, requires manual review`)
      } else {
        // Record failure and re-queue
        yield* Console.log(`📝 Recording failure ${nextAttempt}/3, re-queuing for retry`)
        yield* stateManager.recordFailureAndRequeue(file, error)

        yield* Console.log(`✅ Spec will be retried after cooldown period`)
      }
    })
)

function generateFailureComment(
  failureType: FailureType,
  attemptNumber: number,
  errorDetails: { message: string; details: string }
): string {
  const emoji = {
    regression: '📉',
    'spec-failure': '❌',
    infrastructure: '⚙️',
  }[failureType]

  let comment = `${emoji} **${failureType.toUpperCase()} FAILURE** (Attempt ${attemptNumber}/3)

**Error**: ${errorDetails.message}

`

  switch (failureType) {
    case 'regression': {
      comment += `This implementation caused other tests to fail. The changes will be reverted and the spec will be retried with additional context about the regression.`

      break
    }
    case 'spec-failure': {
      comment += `The implemented code did not make all tests pass. The spec will be retried with additional context about what failed.`

      break
    }
    case 'infrastructure': {
      comment += `Infrastructure or build checks failed. This is not a code issue. The spec will be retried once infrastructure is stable.`

      break
    }
    // No default
  }

  if (attemptNumber >= 3) {
    comment += `

⚠️  **MANUAL INTERVENTION REQUIRED**

This spec has failed 3 times and has been moved to manual review. A GitHub issue will be created with details.`
  }

  return comment
}

function generateActionGuide(
  failureType: FailureType,
  errorDetails: { message: string; details: string }
): string {
  if (failureType === 'regression') {
    return `Review the implementation to determine if:
1. The code has a bug that breaks existing functionality
2. The affected tests need updating to match new behavior
3. A database migration or schema change is missing

Failed checks: ${errorDetails.message}`
  } else if (failureType === 'spec-failure') {
    return `After 3 attempts, the tests still don't pass. Possible reasons:
1. Test expectations may be incorrect or too strict
2. Implementation requires architectural changes
3. Missing dependencies or configuration

Review the test file and determine if tests need adjustment or if a different implementation approach is needed.`
  } else {
    return `Infrastructure failure occurred 3 times. This is NOT a code issue. Possible causes:
1. GitHub API rate limiting
2. Network timeouts
3. Build or quality check issues

Wait for infrastructure to stabilize, then manually re-queue this spec.`
  }
}

const cli = Command.run(FailureHandlerCommand, {
  name: 'failure-handler',
  version: '1.0.0',
})

const AppLayer = Layer.mergeAll(BunContext.layer, StateManagerLive)

cli(process.argv).pipe(Effect.provide(AppLayer), BunRuntime.runMain)
