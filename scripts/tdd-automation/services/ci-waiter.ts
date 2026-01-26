/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Command, Options } from '@effect/cli'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { $ } from 'bun'
import { Effect, Console, Data } from 'effect'

/**
 * Tagged error types for CI waiter operations
 */
class PRStatusError extends Data.TaggedError('PRStatusError')<{
  readonly pr: number
  readonly cause: unknown
}> {}

type CheckStatus = 'success' | 'failure' | 'pending'

interface GitHubCheck {
  name: string
  status: string
  conclusion: string | null
}

const CIWaiterCommand = Command.make(
  'ci-waiter',
  {
    pr: Options.integer('pr'),
    timeout: Options.integer('timeout').pipe(Options.withDefault(600)), // 10 minutes default
  },
  ({ pr, timeout }) =>
    Effect.gen(function* () {
      yield* Console.log(`⏳ Waiting for CI checks on PR #${pr} (timeout: ${timeout}s)`)

      const startTime = Date.now()
      const timeoutMs = timeout * 1000
      let lastStatus: CheckStatus = 'pending'

      while (Date.now() - startTime < timeoutMs) {
        // Get PR status from GitHub CLI
        const result = yield* Effect.tryPromise({
          try: async () => {
            const proc = await $`gh pr view ${pr} --json statusCheckRollup`.nothrow().quiet()
            return {
              exitCode: proc.exitCode,
              stdout: proc.stdout.toString(),
            }
          },
          catch: (error) => new PRStatusError({ pr, cause: error }),
        })

        if (result.exitCode !== 0) {
          yield* Console.error(`Failed to get PR status`)
          return yield* new PRStatusError({
            pr,
            cause: new Error('gh command returned non-zero exit code'),
          })
        }

        // Parse JSON response
        // NOTE: JSON.parse appropriate for parsing trusted gh CLI output (Effect Schema not needed)
        const data = JSON.parse(result.stdout)
        const checks = data.statusCheckRollup || []

        // Determine overall status
        const hasFailure = checks.some(
          (check: GitHubCheck) => check.conclusion === 'FAILURE' || check.conclusion === 'CANCELLED'
        )
        const hasPending = checks.some(
          (check: GitHubCheck) =>
            check.status === 'IN_PROGRESS' ||
            check.status === 'QUEUED' ||
            check.status === 'PENDING'
        )
        const allSuccess =
          checks.length > 0 && checks.every((check: GitHubCheck) => check.conclusion === 'SUCCESS')

        if (hasFailure) {
          yield* Console.log(`❌ CI checks failed`)
          yield* Console.log('failure') // Output for GitHub Actions
          return 'failure'
        }

        if (allSuccess) {
          yield* Console.log(`✅ All CI checks passed`)
          yield* Console.log('success') // Output for GitHub Actions
          return 'success'
        }

        if (hasPending) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000)
          if (lastStatus !== 'pending') {
            yield* Console.log(`⏳ CI checks still running (${elapsed}s elapsed)`)
            lastStatus = 'pending'
          }

          // Wait 10 seconds before checking again
          yield* Effect.sleep('10 seconds')
          continue
        }

        // No checks found yet
        if (checks.length === 0) {
          yield* Console.log(`⏳ Waiting for CI checks to start...`)
          yield* Effect.sleep('5 seconds')
          continue
        }
      }

      // Timeout reached
      yield* Console.log(`⏱️  Timeout reached after ${timeout}s`)
      yield* Console.log('failure') // Output for GitHub Actions
      return 'failure'
    })
)

const cli = Command.run(CIWaiterCommand, {
  name: 'ci-waiter',
  version: '1.0.0',
})

cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
