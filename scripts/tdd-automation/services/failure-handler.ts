/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Command, Options } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { $ } from 'bun'
import { Effect, Console, Layer, Data } from 'effect'
import { StateManager, StateManagerLive } from '../core/state-manager'
import type { SpecError } from '../types'

/**
 * Tagged error types for failure handler operations
 */
class PRCloseError extends Data.TaggedError('PRCloseError')<{
  readonly pr: number
  readonly cause: unknown
}> {}

type FailureType = 'regression' | 'spec-failure' | 'quality-failure' | 'infrastructure'

interface GitHubCheck {
  name: string
  status: string
  conclusion: string | null
}

/**
 * Smart Retry Strategy based on Failure Type
 *
 * 1. Infrastructure Errors (failure:infra) - IMMEDIATE CLEANUP:
 *    - Close PR immediately
 *    - Delete branch
 *    - Remove all TDD labels
 *    - Do NOT increment retry counters (infra failures don't count against code retries)
 *    - Re-queue spec for retry (infrastructure may be stable next time)
 *
 * 2. Spec/Regression Errors (failure:spec, failure:regression) - 3 RETRIES THEN PARK:
 *    - Increment retry counter
 *    - If retry count < 3: Keep PR open, remove in-progress label, allow requeue
 *    - If retry count >= 3: Park for manual intervention (add label, keep PR open)
 */
const FailureHandlerCommand = Command.make(
  'failure-handler',
  {
    specId: Options.text('spec-id'),
    pr: Options.integer('pr'),
    type: Options.text('type'),
    retryCount: Options.integer('retry-count'),
    branch: Options.text('branch').pipe(Options.optional),
  },
  ({ specId, pr, type, retryCount, branch: _branch }) =>
    Effect.gen(function* () {
      const failureType = type as FailureType

      yield* Console.log(`🔄 Handling ${failureType} failure for ${specId}`)

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

      const stateManager = yield* StateManager

      // SMART RETRY STRATEGY: Different behavior based on failure type
      if (failureType === 'infrastructure') {
        // ============================================================
        // INFRASTRUCTURE FAILURES: Immediate cleanup, no retry count
        // ============================================================
        yield* Console.log(`⚙️ Infrastructure failure - immediate cleanup (no retry penalty)`)

        const comment = generateInfrastructureFailureComment(errorDetails)

        // Close PR and delete branch immediately
        yield* Effect.tryPromise({
          try: async () => {
            await $`gh pr close ${pr} --comment ${comment} --delete-branch`.nothrow()
          },
          catch: (err) => new PRCloseError({ pr, cause: err }),
        })

        yield* Console.log(`❌ Closed PR #${pr} and deleted branch`)

        // Remove TDD labels (free the worker slot)
        yield* Effect.tryPromise({
          try: async () => {
            await $`gh pr edit ${pr} --remove-label "tdd-spec:in-progress,failure:infra"`.nothrow()
          },
          catch: () => undefined, // Ignore label removal errors
        })

        // Re-queue spec WITHOUT incrementing retry count
        // Infrastructure failures don't count against code retries
        yield* stateManager.requeueWithoutPenalty(specId, {
          ...error,
          // Mark as infrastructure so we can distinguish in logs
          type: 'infrastructure',
        })

        yield* Console.log(`✅ Spec re-queued for retry (retry count unchanged: ${retryCount})`)
      } else {
        // ============================================================
        // SPEC/REGRESSION FAILURES: 3 retries then park
        // ============================================================
        const nextAttempt = retryCount + 1

        const failureLabel =
          failureType === 'regression'
            ? 'Regression'
            : failureType === 'quality-failure'
              ? 'Quality'
              : 'Spec'
        yield* Console.log(`❌ ${failureLabel} failure (attempt ${nextAttempt}/3)`)

        if (nextAttempt >= 3) {
          // MAX RETRIES EXHAUSTED: Park for manual intervention
          yield* Console.log(`⚠️ Max retries exhausted - parking for manual intervention`)

          // Add comment to PR but keep it OPEN for manual review
          const comment = generateMaxRetriesComment(failureType, errorDetails)
          yield* Effect.tryPromise({
            try: async () => {
              await $`gh pr comment ${pr} --body ${comment}`.nothrow()
            },
            catch: () => undefined, // Ignore comment errors
          })

          // Add manual intervention label, remove in-progress and queued labels
          yield* Effect.tryPromise({
            try: async () => {
              await $`gh pr edit ${pr} --add-label "tdd-spec:manual-intervention" --remove-label "tdd-spec:in-progress,tdd-spec:queued"`.nothrow()
            },
            catch: () => undefined, // Ignore label errors
          })

          yield* Console.log(`📋 PR #${pr} kept open with manual-intervention label`)

          // Move spec to failed queue (removes from active)
          const manualInterventionDetails = {
            errors: [error],
            failureReason: `Failed ${nextAttempt} times due to ${failureType}`,
            requiresAction: generateActionGuide(failureType, errorDetails),
          }

          yield* stateManager.moveToManualIntervention(specId, manualInterventionDetails)

          yield* Console.log(`📋 Spec moved to failed queue - requires manual review`)
        } else {
          // RETRY AVAILABLE: Keep PR open, allow automatic retry
          yield* Console.log(`📝 Recording failure ${nextAttempt}/3, preparing for retry`)

          // Add comment to PR about the failure
          const comment = generateRetryComment(failureType, nextAttempt, errorDetails)
          yield* Effect.tryPromise({
            try: async () => {
              await $`gh pr comment ${pr} --body ${comment}`.nothrow()
            },
            catch: () => undefined, // Ignore comment errors
          })

          // Close PR to allow fresh start on retry
          // This prevents accumulating commits on a broken branch
          yield* Effect.tryPromise({
            try: async () => {
              await $`gh pr close ${pr} --delete-branch`.nothrow()
            },
            catch: (err) => new PRCloseError({ pr, cause: err }),
          })

          yield* Console.log(`❌ Closed PR #${pr} for fresh retry`)

          // Update retry label (quality failures use spec retry counter)
          const retryLabelType = failureType === 'regression' ? 'regression' : 'spec'
          const retryLabel = `retry:${retryLabelType}:${nextAttempt}`
          yield* Effect.tryPromise({
            try: async () => {
              // Remove old retry labels and add new one
              const oldLabels = [1, 2, 3]
                .map((n) => `retry:spec:${n},retry:regression:${n}`)
                .join(',')
              await $`gh pr edit ${pr} --remove-label "${oldLabels}" --add-label "${retryLabel}"`.nothrow()
            },
            catch: () => undefined, // Ignore label errors
          })

          // Record failure and re-queue (increments attempt counter)
          yield* stateManager.recordFailureAndRequeue(specId, error)

          yield* Console.log(`✅ Spec re-queued for retry attempt ${nextAttempt + 1}/3`)
        }
      }
    })
)

/**
 * Generate comment for infrastructure failures (immediate cleanup, no retry penalty)
 */
function generateInfrastructureFailureComment(errorDetails: {
  message: string
  details: string
}): string {
  return `⚙️ **INFRASTRUCTURE FAILURE** (No retry penalty)

**Error**: ${errorDetails.message}

This is an infrastructure issue, **not a code problem**. Possible causes:
- GitHub API rate limiting
- Network timeouts
- Docker container issues
- Build tool failures
- CI runner problems

**Actions taken**:
- PR closed and branch deleted
- Spec re-queued for retry (retry counter NOT incremented)
- Worker slot freed for next spec

The spec will be automatically retried when infrastructure stabilizes.`
}

/**
 * Generate comment for failures with retries remaining
 */
function generateRetryComment(
  failureType: FailureType,
  attemptNumber: number,
  errorDetails: { message: string; details: string }
): string {
  const emoji =
    failureType === 'regression' ? '📉' : failureType === 'quality-failure' ? '🔧' : '❌'
  const typeLabel =
    failureType === 'regression'
      ? 'REGRESSION'
      : failureType === 'quality-failure'
        ? 'QUALITY FAILURE'
        : 'SPEC FAILURE'

  const description =
    failureType === 'regression'
      ? 'This implementation caused other tests to fail.'
      : failureType === 'quality-failure'
        ? 'The code has formatting, linting, or type errors.'
        : 'The implemented code did not make all tests pass.'

  return `${emoji} **${typeLabel}** (Attempt ${attemptNumber}/3)

**Error**: ${errorDetails.message}

${description}

**Actions taken**:
- PR closed for fresh retry
- Error recorded for context on next attempt
- Retry counter incremented to ${attemptNumber}/3

The spec will be automatically retried with additional context about this failure.`
}

/**
 * Generate comment when max retries exhausted (parking for manual intervention)
 */
function generateMaxRetriesComment(
  failureType: FailureType,
  errorDetails: { message: string; details: string }
): string {
  const emoji =
    failureType === 'regression' ? '📉' : failureType === 'quality-failure' ? '🔧' : '❌'
  const typeLabel =
    failureType === 'regression'
      ? 'REGRESSION'
      : failureType === 'quality-failure'
        ? 'QUALITY FAILURE'
        : 'SPEC FAILURE'

  return `⚠️ **MANUAL INTERVENTION REQUIRED**

${emoji} **${typeLabel}** - Max retries exhausted (3/3 attempts failed)

**Last Error**: ${errorDetails.message}

This spec has failed 3 times and requires manual review.

**Why this PR is kept open**:
- Preserves Claude's implementation work
- Shows full history of attempted fixes
- Allows manual debugging and intervention

**What to do**:
1. Review the test expectations in the spec file
2. Check if the implementation approach needs to change
3. Look for missing dependencies or configuration
4. Once fixed, close this PR and re-queue the spec manually

**To re-queue after fixing**:
\`\`\`bash
bun run scripts/tdd-automation/requeue-spec.ts --spec-id <SPEC_ID> --reset-retries
\`\`\`

This spec has been removed from the automated queue and will not block other specs.`
}

function generateActionGuide(
  failureType: FailureType,
  errorDetails: { message: string; details: string }
): string {
  switch (failureType) {
    case 'regression': {
      return `Review the implementation to determine if:
1. The code has a bug that breaks existing functionality
2. The affected tests need updating to match new behavior
3. A database migration or schema change is missing

Failed checks: ${errorDetails.message}`
    }
    case 'quality-failure': {
      return `After 3 attempts, the code still has quality issues. Possible reasons:
1. Formatting: Run \`bun run format\` to fix Prettier issues
2. Linting: Run \`bun run lint:fix\` to fix ESLint issues
3. Type errors: Check TypeScript compilation with \`bun run typecheck\`

Review the error output and fix the quality issues manually before re-queuing.`
    }
    case 'spec-failure': {
      return `After 3 attempts, the tests still don't pass. Possible reasons:
1. Test expectations may be incorrect or too strict
2. Implementation requires architectural changes
3. Missing dependencies or configuration

Review the test file and determine if tests need adjustment or if a different implementation approach is needed.`
    }
    case 'infrastructure': {
      return `Infrastructure failure occurred 3 times. This is NOT a code issue. Possible causes:
1. GitHub API rate limiting
2. Network timeouts
3. Build or quality check issues

Wait for infrastructure to stabilize, then manually re-queue this spec.`
    }
  }
}

const cli = Command.run(FailureHandlerCommand, {
  name: 'failure-handler',
  version: '1.0.0',
})

const AppLayer = Layer.mergeAll(BunContext.layer, StateManagerLive)

cli(process.argv).pipe(Effect.provide(AppLayer), BunRuntime.runMain)
