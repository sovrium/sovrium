#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Quality check script - runs linting, type checking, unit tests, and E2E regression tests
 *
 * Usage:
 *   bun run quality                   # Run all checks on entire codebase (ESLint, TypeScript, unit tests, E2E regression)
 *   bun run quality <file>            # Run checks on specific file (ESLint, TypeScript, unit tests only)
 *   bun run quality src/index.ts      # Example: check specific file
 *
 * Performance optimizations:
 * - Uses fail-fast strategy: runs checks sequentially, stops immediately on first failure (saves time)
 * - Uses ESLint cache for faster subsequent runs
 * - Uses TypeScript incremental mode for faster type checking
 * - Skips checks for comment-only changes (file mode)
 * - For file mode: runs ESLint, TypeScript, and unit tests in parallel
 * - Provides clear success/failure feedback
 */

import { basename, dirname, extname, join } from 'node:path'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  FileSystemService,
  FileSystemServiceLive,
  CommandService,
  CommandServiceLive,
  LoggerServicePretty,
  progress,
  success,
  logError,
  skip,
  section,
} from './lib/effect'

/**
 * Check result with timing information
 */
interface CheckResult {
  readonly name: string
  readonly success: boolean
  readonly duration: number
  readonly error?: string
}

/**
 * Quality check failed error
 */
class QualityCheckFailedError extends Data.TaggedError('QualityCheckFailedError')<{
  readonly checks: readonly CheckResult[]
}> {}

/**
 * Check if file is a TypeScript file
 */
const isTypeScriptFile = (filePath: string): boolean => {
  const ext = extname(filePath)
  return ext === '.ts' || ext === '.tsx'
}

/**
 * Remove all comments from TypeScript code
 */
const stripComments = (code: string): string => {
  // Remove single-line comments
  let stripped = code.replace(/\/\/.*$/gm, '')

  // Remove multi-line comments
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '')

  // Remove JSDoc comments
  stripped = stripped.replace(/\/\*\*[\s\S]*?\*\//g, '')

  return stripped
}

/**
 * Check if only comments changed in a file using git diff
 */
const isCommentOnlyChange = (filePath: string) =>
  Effect.gen(function* () {
    const cmd = yield* CommandService
    const fs = yield* FileSystemService

    // Check if file is tracked by git
    const tracked = yield* cmd
      .exec(`git ls-files --error-unmatch "${filePath}"`, { throwOnError: false })
      .pipe(
        Effect.map((output) => output.trim().length > 0),
        Effect.catchAll(() => Effect.succeed(false))
      )

    if (!tracked) {
      // New file, not tracked - run checks
      return false
    }

    // Get the current version
    const currentContent = yield* fs
      .readFile(filePath)
      .pipe(Effect.catchAll(() => Effect.succeed('')))

    // Get the HEAD version
    const headContent = yield* cmd
      .exec(`git show HEAD:"${filePath}"`, { throwOnError: false })
      .pipe(
        Effect.map((output) => output.trim()),
        Effect.catchAll(() => Effect.succeed(''))
      )

    if (headContent.length === 0) {
      // File doesn't exist in HEAD (newly added) - run checks
      return false
    }

    // Strip comments from both versions
    const currentStripped = stripComments(currentContent).trim()
    const headStripped = stripComments(headContent).trim()

    // If stripped versions are identical, only comments changed
    return currentStripped === headStripped
  }).pipe(
    // On any error, assume it's not a comment-only change (safer to run checks)
    Effect.catchAll(() => Effect.succeed(false))
  )

/**
 * Find test file for a given source file
 */
const findTestFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const dir = dirname(filePath)
    const base = basename(filePath).replace(/\.(ts|tsx)$/, '')

    const testPatterns = [
      filePath.replace(/\.(ts|tsx)$/, '.test.ts'),
      filePath.replace(/\.(ts|tsx)$/, '.test.tsx'),
      join(dir, `${base}.test.ts`),
      join(dir, `${base}.test.tsx`),
    ]

    for (const pattern of testPatterns) {
      const exists = yield* fs.exists(pattern)
      if (exists) {
        return pattern
      }
    }

    return null
  })

/**
 * Run a single quality check command
 */
const runCheck = (name: string, command: readonly string[], timeoutMs: number = 60_000) =>
  Effect.gen(function* () {
    const cmd = yield* CommandService
    const startTime = Date.now()

    yield* progress(`${name}...`)

    const result = yield* cmd.spawn(command, { timeout: timeoutMs, throwOnError: false }).pipe(
      Effect.catchTag('CommandTimeoutError', (_) =>
        Effect.fail({
          exitCode: 1,
          stdout: '',
          stderr: `${name} timed out after ${timeoutMs}ms`,
          duration: Date.now() - startTime,
        })
      ),
      Effect.catchTag('CommandSpawnError', (e) =>
        Effect.fail({
          exitCode: 1,
          stdout: '',
          stderr: e.cause ? String(e.cause) : `Failed to spawn command`,
          duration: Date.now() - startTime,
        })
      ),
      Effect.catchTag('CommandFailedError', (e) =>
        Effect.fail({
          exitCode: e.exitCode,
          stdout: e.stdout,
          stderr: e.stderr,
          duration: Date.now() - startTime,
        })
      )
    )

    const duration = Date.now() - startTime
    const isSuccess = result.exitCode === 0

    const checkResult: CheckResult = {
      name,
      success: isSuccess,
      duration,
      error: isSuccess ? undefined : result.stderr,
    }

    if (isSuccess) {
      yield* success(`${name} passed (${duration}ms)`)
    } else {
      yield* logError(`${name} failed (${duration}ms)`)
      if (result.stderr.length > 0) {
        console.error(result.stderr)
      }
    }

    return checkResult
  })

/**
 * Run quality checks for a specific file
 */
const runFileChecks = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    // Validate file exists and is TypeScript
    const exists = yield* fs.exists(filePath)
    if (!exists) {
      yield* logError(`File not found: ${filePath}`)
      return yield* Effect.fail(new QualityCheckFailedError({ checks: [] }))
    }

    if (!isTypeScriptFile(filePath)) {
      yield* skip(`Skipping checks for ${basename(filePath)} (not a TypeScript file)`)
      return []
    }

    // Check if only comments changed
    const commentOnly = yield* isCommentOnlyChange(filePath)
    if (commentOnly) {
      yield* skip(`Skipping checks for ${basename(filePath)} (comment-only change)`)
      return []
    }

    const fileName = basename(filePath)
    yield* section(`Running quality checks on ${fileName}`)

    // Run checks in parallel for specific file
    // Note: TypeScript always checks entire project (incremental makes it fast)
    const checks = [
      runCheck(
        'ESLint',
        [
          'bunx',
          'eslint',
          filePath,
          '--max-warnings',
          '0',
          '--cache',
          '--cache-location',
          'node_modules/.cache/eslint',
          '--cache-strategy',
          'content',
        ],
        120_000
      ),
      runCheck('TypeScript', ['bunx', 'tsc', '--noEmit', '--incremental'], 60_000),
    ]

    // Add test file check if it exists
    const testFile = yield* findTestFile(filePath)
    if (testFile) {
      const testFileName = basename(testFile)
      checks.push(
        runCheck(
          `Unit Test (${testFileName})`,
          ['bun', 'test', testFile, '--bail', '--concurrent'],
          30_000
        )
      )
    }

    const results = yield* Effect.all(checks, { concurrency: 'unbounded' })

    return results
  })

/**
 * Run quality checks for entire codebase with fail-fast
 * Runs checks sequentially and stops immediately on first failure
 */
const runFullChecks = Effect.gen(function* () {
  yield* section('Running quality checks on entire codebase (fail-fast)')

  const results: CheckResult[] = []

  // Run checks sequentially - stop immediately on first failure
  const checks = [
    {
      name: 'ESLint',
      effect: runCheck(
        'ESLint',
        [
          'bunx',
          'eslint',
          '.',
          '--max-warnings',
          '0',
          '--cache',
          '--cache-location',
          'node_modules/.cache/eslint',
          '--cache-strategy',
          'content',
        ],
        120_000
      ),
    },
    {
      name: 'TypeScript',
      effect: runCheck('TypeScript', ['bunx', 'tsc', '--noEmit', '--incremental'], 60_000),
    },
    {
      name: 'Unit Tests',
      effect: runCheck(
        'Unit Tests',
        ['bun', 'test', '--concurrent', '.test.ts', '.test.tsx'],
        60_000
      ),
    },
    {
      name: 'E2E Regression Tests',
      effect: runCheck(
        'E2E Regression Tests',
        ['bunx', 'playwright', 'test', '--grep=@regression'],
        300_000 // 5 minutes (increased from 3 min for slower CI runners)
      ),
    },
  ]

  // Run sequentially, fail immediately on first failure
  for (const check of checks) {
    const result = yield* check.effect
    results.push(result)

    if (!result.success) {
      // First failure - stop immediately
      yield* logError(`\n⚠️  Stopping checks due to ${check.name} failure (fail-fast mode)`)
      return results
    }
  }

  return results
})

/**
 * Print summary of check results
 */
const printSummary = (results: readonly CheckResult[], overallDuration: number) =>
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
      if (results[0] && !results[0].success) yield* Effect.log('  bun run lint')
      if (results[1] && !results[1].success) yield* Effect.log('  bun run typecheck')
      if (results[2] && !results[2].success) yield* Effect.log('  bun test:unit')
      if (results[3] && !results[3].success) yield* Effect.log('  bun test:e2e:regression')

      return yield* Effect.fail(new QualityCheckFailedError({ checks: results }))
    }
  })

/**
 * Main quality check program
 */
const main = Effect.gen(function* () {
  // Parse command line arguments
  const args = process.argv.slice(2)
  const filePath = args[0]

  const overallStart = Date.now()

  let results: readonly CheckResult[]

  if (filePath) {
    // Single file mode
    results = yield* runFileChecks(filePath)
  } else {
    // Full codebase mode
    results = yield* runFullChecks
  }

  const overallDuration = Date.now() - overallStart

  // Skip summary if no checks were run (comment-only change)
  if (results.length === 0) {
    return
  }

  yield* printSummary(results, overallDuration)
})

// Main layer combining all services
const MainLayer = Layer.mergeAll(FileSystemServiceLive, CommandServiceLive, LoggerServicePretty())

// Run the script
const program = main.pipe(
  Effect.provide(MainLayer),
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      console.error('❌ Failed to run quality checks:', error)
      return yield* Effect.fail(error)
    })
  )
)

Effect.runPromise(program)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
