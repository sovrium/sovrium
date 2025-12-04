#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Quality check script - runs linting, type checking, Effect diagnostics, unit tests, coverage check, and smart E2E regression tests
 *
 * Usage:
 *   bun run quality                   # Run all checks with smart E2E detection
 *   bun run quality <file>            # Run checks on specific file (ESLint, TypeScript, unit tests only)
 *   bun run quality --skip-e2e        # Skip E2E tests entirely
 *   bun run quality --skip-coverage   # Skip coverage check (gradual adoption)
 *   bun run quality --skip-effect     # Skip Effect diagnostics (Effect Language Service checks)
 *   bun run quality src/index.ts      # Example: check specific file
 *
 * Effect Diagnostics:
 * - Uses Effect Language Service to check for Effect-specific issues
 * - Detects unnecessaryPipeChain, catchUnfailableEffect, returnEffectInGen, tryCatchInEffectGen
 * - Run with --skip-effect to bypass these checks
 *
 * Smart E2E Detection:
 * - Detects changed files (local: uncommitted changes, CI: diff from main branch)
 * - Maps source file changes to related E2E specs
 * - Runs @regression E2E tests only for affected specs (fast feedback)
 * - Skips E2E if no specs or related source files changed
 *
 * Coverage Check:
 * - Enforces unit test coverage for domain layer (93%+ covered)
 * - Fails if source files are missing corresponding .test.ts files
 * - Use --skip-coverage for gradual adoption
 *
 * Performance optimizations:
 * - Uses fail-fast strategy: runs checks sequentially, stops immediately on first failure (saves time)
 * - Uses ESLint cache for faster subsequent runs
 * - Uses TypeScript incremental mode for faster type checking
 * - Skips checks for comment-only changes (file mode)
 * - For file mode: runs ESLint, TypeScript, and unit tests in parallel
 * - Smart E2E detection prevents running all E2E tests on every change
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
  // New services for smart testing
  GitService,
  GitServiceLive,
  SpecMappingService,
  SpecMappingServiceLive,
  CoverageService,
  CoverageServiceLive,
  DEFAULT_LAYERS,
} from './lib/effect'
import type { LayerConfig } from './lib/effect'

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
 * E2E decision result
 */
interface E2EDecision {
  readonly run: boolean
  readonly specs: readonly string[]
  readonly reason: string
}

/**
 * CLI options for quality checks
 */
interface QualityOptions {
  readonly file?: string
  readonly skipE2E: boolean
  readonly skipCoverage: boolean
  readonly skipEffect: boolean
}

/**
 * Parse command line arguments
 */
const parseArgs = (): QualityOptions => {
  const args = process.argv.slice(2)
  return {
    file: args.find((a) => !a.startsWith('--')),
    skipE2E: args.includes('--skip-e2e'),
    skipCoverage: args.includes('--skip-coverage'),
    skipEffect: args.includes('--skip-effect'),
  }
}

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
  })

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
 * Determine which E2E specs should run based on changed files
 */
const determineE2ESpecs = Effect.gen(function* () {
  const git = yield* GitService
  const mapping = yield* SpecMappingService

  const mode = yield* git.getMode()
  const changedFiles = yield* git.getChangedFiles(mode)

  yield* Effect.log(`  Detected ${changedFiles.length} changed files (mode: ${mode})`)

  if (changedFiles.length === 0) {
    return {
      run: false,
      specs: [],
      reason: 'no changed files detected',
    } as E2EDecision
  }

  // Get specs that should run based on changed files
  const specs = yield* mapping.getSpecsToRun(changedFiles)

  if (specs.length > 0) {
    // Filter to only @regression tagged specs
    const regressionSpecs = specs.filter(
      (s) => s.includes('/app/') || s.includes('/api/') || s.includes('/static/')
    )

    if (regressionSpecs.length > 0) {
      return {
        run: true,
        specs: regressionSpecs,
        reason: `${regressionSpecs.length} spec(s) related to changed files`,
      } as E2EDecision
    }
  }

  return {
    run: false,
    specs: [],
    reason: 'no modified specs or related source files',
  } as E2EDecision
})

/**
 * Run coverage check for enabled layers
 */
const runCoverageCheck = (layers: readonly LayerConfig[]) =>
  Effect.gen(function* () {
    const coverage = yield* CoverageService
    const startTime = Date.now()

    yield* progress('Coverage Check...')

    const results = yield* coverage.checkAll(layers)
    const enabledResults = results.filter((r) => {
      const layer = layers.find((l) => l.name === r.layer)
      return layer?.enabled
    })

    // Check for failures
    const failures = enabledResults.filter((r) => r.missingTests.length > 0)
    const duration = Date.now() - startTime

    if (failures.length > 0) {
      yield* logError(`Coverage Check failed (${duration}ms)`)
      for (const failure of failures) {
        yield* Effect.log(`\n  Missing unit tests in ${failure.layer}/:`)
        for (const file of failure.missingTests.slice(0, 5)) {
          yield* Effect.log(`    - ${file}`)
        }
        if (failure.missingTests.length > 5) {
          yield* Effect.log(`    ... and ${failure.missingTests.length - 5} more`)
        }
      }
      return {
        name: 'Coverage Check',
        success: false,
        duration,
        error: `Missing tests in: ${failures.map((f) => f.layer).join(', ')}`,
      } as CheckResult
    }

    yield* success(`Coverage Check passed (${duration}ms)`)
    return {
      name: 'Coverage Check',
      success: true,
      duration,
    } as CheckResult
  })

/**
 * Run Effect Language Service diagnostics
 * Checks for Effect-specific issues like:
 * - unnecessaryPipeChain: Chained pipe calls that can be simplified
 * - catchUnfailableEffect: Catching on effects that never fail
 * - returnEffectInGen: Returning Effect inside generator (should use yield*)
 * - tryCatchInEffectGen: Using try/catch in generators instead of Effect error handling
 */
const runEffectDiagnostics = Effect.gen(function* () {
  const cmd = yield* CommandService
  const startTime = Date.now()

  yield* progress('Effect Diagnostics...')

  // Run Effect Language Service diagnostics CLI
  const result = yield* cmd
    .spawn(
      [
        'bun',
        'node_modules/@effect/language-service/cli.js',
        'diagnostics',
        '--project',
        'tsconfig.json',
      ],
      { timeout: 120_000, throwOnError: false }
    )
    .pipe(
      Effect.catchTag('CommandTimeoutError', () =>
        Effect.succeed({ exitCode: 1, stdout: '', stderr: 'Effect diagnostics timed out' })
      ),
      Effect.catchTag('CommandSpawnError', () =>
        Effect.succeed({ exitCode: 1, stdout: '', stderr: 'Failed to run Effect diagnostics' })
      ),
      Effect.catchTag('CommandFailedError', (e) =>
        Effect.succeed({ exitCode: e.exitCode, stdout: e.stdout, stderr: e.stderr })
      )
    )

  const duration = Date.now() - startTime
  const output = result.stdout || result.stderr || ''

  // Count Effect diagnostics warnings (lines containing "effect(" pattern)
  const diagnosticLines = output.split('\n').filter((line) => line.includes('effect('))
  const warningCount = diagnosticLines.length

  if (warningCount > 0) {
    yield* logError(`Effect Diagnostics failed (${duration}ms) - ${warningCount} warning(s)`)
    // Print the diagnostic output
    console.error(output)
    return {
      name: 'Effect Diagnostics',
      success: false,
      duration,
      error: `${warningCount} Effect warning(s) found`,
    } as CheckResult
  }

  yield* success(`Effect Diagnostics passed (${duration}ms)`)
  return {
    name: 'Effect Diagnostics',
    success: true,
    duration,
  } as CheckResult
})

/**
 * Run quality checks for entire codebase with fail-fast
 * Runs checks sequentially and stops immediately on first failure
 * Includes smart E2E detection and optional coverage checking
 */
const runFullChecks = (options: QualityOptions) =>
  Effect.gen(function* () {
    yield* section('Running quality checks on entire codebase (fail-fast)')

    const results: CheckResult[] = []

    // 1. ESLint check
    const eslintResult = yield* runCheck(
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
    )
    results.push(eslintResult)
    if (!eslintResult.success) {
      yield* logError('\n⚠️  Stopping checks due to ESLint failure (fail-fast mode)')
      return results
    }

    // 2. TypeScript check
    const tscResult = yield* runCheck(
      'TypeScript',
      ['bunx', 'tsc', '--noEmit', '--incremental'],
      60_000
    )
    results.push(tscResult)
    if (!tscResult.success) {
      yield* logError('\n⚠️  Stopping checks due to TypeScript failure (fail-fast mode)')
      return results
    }

    // 3. Effect diagnostics (optional)
    if (!options.skipEffect) {
      const effectResult = yield* runEffectDiagnostics
      results.push(effectResult)
      if (!effectResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Effect Diagnostics failure (fail-fast mode)')
        return results
      }
    } else {
      yield* skip('Effect Diagnostics skipped (--skip-effect flag)')
      results.push({
        name: 'Effect Diagnostics',
        success: true,
        duration: 0,
      })
    }

    // 4. Unit tests
    const unitResult = yield* runCheck(
      'Unit Tests',
      ['bun', 'test', '--concurrent', '.test.ts', '.test.tsx'],
      60_000
    )
    results.push(unitResult)
    if (!unitResult.success) {
      yield* logError('\n⚠️  Stopping checks due to Unit Tests failure (fail-fast mode)')
      return results
    }

    // 5. Coverage check (optional)
    if (!options.skipCoverage) {
      const coverageResult = yield* runCoverageCheck(DEFAULT_LAYERS)
      results.push(coverageResult)
      if (!coverageResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Coverage Check failure (fail-fast mode)')
        return results
      }
    } else {
      yield* skip('Coverage Check skipped (--skip-coverage flag)')
      results.push({
        name: 'Coverage Check',
        success: true,
        duration: 0,
      })
    }

    // 6. Smart E2E detection
    if (options.skipE2E) {
      yield* skip('E2E tests skipped (--skip-e2e flag)')
      results.push({
        name: 'E2E Regression Tests',
        success: true,
        duration: 0,
      })
      return results
    }

    yield* progress('Analyzing changed files for E2E detection...')
    const e2eDecision = yield* determineE2ESpecs

    if (!e2eDecision.run) {
      yield* skip(`Skipping E2E: ${e2eDecision.reason}`)
      results.push({
        name: 'E2E Regression Tests',
        success: true,
        duration: 0,
      })
      return results
    }

    yield* Effect.log(`  E2E will run: ${e2eDecision.reason}`)
    for (const spec of e2eDecision.specs.slice(0, 5)) {
      yield* Effect.log(`    - ${spec}`)
    }
    if (e2eDecision.specs.length > 5) {
      yield* Effect.log(`    ... and ${e2eDecision.specs.length - 5} more`)
    }

    // Run E2E tests for specific specs (@regression only for speed)
    const e2eResult = yield* runCheck(
      'E2E Regression Tests',
      ['bunx', 'playwright', 'test', '--grep', '@regression', ...e2eDecision.specs],
      300_000 // 5 minutes
    )
    results.push(e2eResult)

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

      const failedNames = new Set(results.filter((r) => !r.success).map((r) => r.name))
      if (failedNames.has('ESLint')) yield* Effect.log('  bun run lint')
      if (failedNames.has('TypeScript')) yield* Effect.log('  bun run typecheck')
      if (failedNames.has('Effect Diagnostics')) {
        yield* Effect.log(
          '  bun node_modules/@effect/language-service/cli.js diagnostics --project tsconfig.json'
        )
        yield* Effect.log('  Or use: bun run quality --skip-effect')
      }
      if (failedNames.has('Unit Tests')) yield* Effect.log('  bun test:unit')
      if (failedNames.has('Coverage Check')) {
        yield* Effect.log('  Add missing .test.ts files for source files')
        yield* Effect.log('  Or use: bun run quality --skip-coverage')
      }
      if (failedNames.has('E2E Regression Tests')) yield* Effect.log('  bun test:e2e:regression')

      return yield* Effect.fail(new QualityCheckFailedError({ checks: results }))
    }
  })

/**
 * Main quality check program
 */
const main = Effect.gen(function* () {
  // Parse command line arguments
  const options = parseArgs()

  const overallStart = Date.now()

  let results: readonly CheckResult[]

  if (options.file && !options.file.startsWith('--')) {
    // Single file mode
    results = yield* runFileChecks(options.file)
  } else {
    // Full codebase mode with smart E2E detection
    results = yield* runFullChecks(options)
  }

  const overallDuration = Date.now() - overallStart

  // Skip summary if no checks were run (comment-only change)
  if (results.length === 0) {
    return
  }

  yield* printSummary(results, overallDuration)
})

// Base services (no dependencies)
const BaseLayer = Layer.mergeAll(FileSystemServiceLive, CommandServiceLive, LoggerServicePretty())

// Services that depend on base services
const GitLayer = GitServiceLive.pipe(Layer.provide(CommandServiceLive))
const SpecMappingLayer = SpecMappingServiceLive.pipe(Layer.provide(FileSystemServiceLive))
const CoverageLayer = CoverageServiceLive.pipe(Layer.provide(FileSystemServiceLive))

// Main layer combining all services
const MainLayer = Layer.mergeAll(BaseLayer, GitLayer, SpecMappingLayer, CoverageLayer)

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
