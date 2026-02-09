/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { success, error as logError } from './LoggerService'

/**
 * Check result with timing information
 */
export interface CheckResult {
  readonly name: string
  readonly success: boolean
  readonly duration: number
  readonly error?: string
}

/**
 * Quality check failed error
 */
export class QualityCheckFailedError extends Data.TaggedError('QualityCheckFailedError')<{
  readonly checks: readonly CheckResult[]
}> {}

/**
 * Print a summary of quality check results and fail if any check failed.
 */
export const printSummary = (results: readonly CheckResult[], overallDuration: number) =>
  Effect.gen(function* () {
    const sep = '─'.repeat(50)
    yield* Effect.log('')
    yield* Effect.log(sep)
    yield* Effect.log('📊 Quality Check Summary')
    yield* Effect.log(sep)

    for (const result of results) {
      const status = result.success ? '✅' : '❌'
      yield* Effect.log(`${status} ${result.name.padEnd(20)} ${result.duration}ms`)
    }

    yield* Effect.log(sep)
    yield* Effect.log(`Total time: ${overallDuration}ms`)
    yield* Effect.log(sep)

    const allPassed = results.every((r) => r.success)

    if (allPassed) {
      yield* success('All quality checks passed!')
    } else {
      const failedChecks = results
        .filter((r) => !r.success)
        .map((r) => r.name)
        .join(', ')
      yield* logError(`Quality checks failed: ${failedChecks}`)
      yield* Effect.log('')
      yield* Effect.log('Run individual commands to see detailed errors:')

      const failedNames = new Set(results.filter((r) => !r.success).map((r) => r.name))
      if (failedNames.has('Prettier')) yield* Effect.log('  bun format')
      if (failedNames.has('ESLint')) yield* Effect.log('  bun run lint')
      if (failedNames.has('TypeScript')) yield* Effect.log('  bun run typecheck')
      if (failedNames.has('Effect Diagnostics')) {
        yield* Effect.log(
          '  bun node_modules/@effect/language-service/cli.js diagnostics --project tsconfig.json'
        )
        yield* Effect.log('  Add --include-effect flag to run this check')
      }
      if (failedNames.has('Unit Tests')) yield* Effect.log('  bun test:unit')
      if (failedNames.has('Knip')) {
        yield* Effect.log('  bun run clean')
        yield* Effect.log('  Or use: bun run quality --skip-knip')
      }
      if (failedNames.has('Workflow Lint')) {
        yield* Effect.log('  bun run lint:workflows')
        yield* Effect.log('  Or use: bun run quality --skip-workflows')
      }
      if (failedNames.has('Spec Counts')) {
        yield* Effect.log('  bun run validate:spec-counts --fix')
      }
      if (failedNames.has('Spec Quality')) {
        yield* Effect.log('  bun run progress')
        yield* Effect.log('  Or use: bun run quality --skip-specs')
      }
      if (failedNames.has('Coverage Check')) {
        yield* Effect.log('  Add missing .test.ts files for source files')
        yield* Effect.log('  Or use: bun run quality --skip-coverage')
      }
      if (failedNames.has('E2E Regression Tests')) yield* Effect.log('  bun test:e2e:regression')

      return yield* new QualityCheckFailedError({ checks: results })
    }
  })
