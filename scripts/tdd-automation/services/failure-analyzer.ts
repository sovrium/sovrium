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
 * Tagged error types for failure analyzer operations
 */
class PRDetailsError extends Data.TaggedError('PRDetailsError')<{
  readonly pr: number
  readonly cause: unknown
}> {}

// FailureType is used as return value from program
type FailureType = 'regression' | 'spec-failure' | 'infrastructure'
void (0 as unknown as FailureType) // Type documentation - return value type

interface GitHubCheck {
  name: string
  status: string
  conclusion: string | null
}

const FailureAnalyzerCommand = Command.make(
  'failure-analyzer',
  {
    pr: Options.integer('pr'),
  },
  ({ pr }) =>
    Effect.gen(function* () {
      yield* Console.log(`🔍 Analyzing failure type for PR #${pr}`)

      // Get CI check details
      const result = yield* Effect.tryPromise({
        try: async () => {
          const proc = await $`gh pr view ${pr} --json statusCheckRollup,commits`.nothrow().quiet()
          return {
            exitCode: proc.exitCode,
            stdout: proc.stdout.toString(),
          }
        },
        catch: (error) => new PRDetailsError({ pr, cause: error }),
      })

      if (result.exitCode !== 0) {
        yield* Console.error(`Failed to get PR details, assuming infrastructure failure`)
        yield* Console.log('infrastructure')
        return 'infrastructure'
      }

      // @ts-expect-error effect(preferSchemaOverJson) - JSON.parse appropriate for parsing trusted gh CLI output
      const data = JSON.parse(result.stdout)
      const checks = data.statusCheckRollup || []

      // Analyze failed checks
      const failedChecks = checks.filter(
        (check: GitHubCheck) => check.conclusion === 'FAILURE' || check.conclusion === 'CANCELLED'
      )

      if (failedChecks.length === 0) {
        yield* Console.log(`No failed checks found, assuming infrastructure issue`)
        yield* Console.log('infrastructure')
        return 'infrastructure'
      }

      // Check for regression (E2E tests failed)
      const hasRegressionTests = failedChecks.some(
        (check: GitHubCheck) =>
          check.name.toLowerCase().includes('e2e') ||
          check.name.toLowerCase().includes('regression') ||
          check.name.toLowerCase().includes('integration')
      )

      if (hasRegressionTests) {
        yield* Console.log(`📉 Detected regression: E2E/integration tests failed`)
        yield* Console.log('regression')
        return 'regression'
      }

      // Check for spec failure (unit tests failed)
      const hasUnitTests = failedChecks.some(
        (check: GitHubCheck) =>
          check.name.toLowerCase().includes('test') ||
          check.name.toLowerCase().includes('unit') ||
          check.name.toLowerCase().includes('spec')
      )

      if (hasUnitTests) {
        yield* Console.log(`❌ Detected spec failure: Unit/spec tests failed`)
        yield* Console.log('spec-failure')
        return 'spec-failure'
      }

      // Check for infrastructure issues (build, lint, typecheck failures)
      const hasInfrastructure = failedChecks.some(
        (check: GitHubCheck) =>
          check.name.toLowerCase().includes('build') ||
          check.name.toLowerCase().includes('lint') ||
          check.name.toLowerCase().includes('typecheck') ||
          check.name.toLowerCase().includes('quality')
      )

      if (hasInfrastructure) {
        yield* Console.log(`⚙️  Detected infrastructure failure: Build/quality checks failed`)
        yield* Console.log('infrastructure')
        return 'infrastructure'
      }

      // Default to spec-failure if we can't determine
      yield* Console.log(`Unable to determine failure type, assuming spec-failure`)
      yield* Console.log('spec-failure')
      return 'spec-failure'
    })
)

const cli = Command.run(FailureAnalyzerCommand, {
  name: 'failure-analyzer',
  version: '1.0.0',
})

cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain)
