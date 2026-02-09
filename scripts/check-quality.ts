#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Code Quality Check (Tier 1) - runs formatting, linting, workflow linting, type checking,
 * Effect diagnostics, unit tests, Knip (unused code), coverage check, and smart E2E regression tests
 *
 * This is Tier 1 of the two-tier quality pipeline:
 *   Tier 1: bun run quality     → Code quality (format, lint, types, tests, knip, coverage, e2e)
 *   Tier 2: bun run progress    → Content quality + reporting (specs, user stories, SPEC-PROGRESS.md)
 *   Both:   bun run check:all   → quality && progress --strict
 *
 * Usage:
 *   bun run quality                   # Run all checks (Effect diagnostics skipped by default)
 *   bun run quality <file>            # Run checks on specific file (ESLint, TypeScript, unit tests only)
 *   bun run quality --skip-format     # Skip Prettier formatting check
 *   bun run quality --skip-e2e        # Skip E2E tests entirely
 *   bun run quality --skip-coverage   # Skip coverage check (gradual adoption)
 *   bun run quality --skip-workflows  # Skip GitHub Actions workflow linting (actionlint)
 *   bun run quality --include-effect  # Include Effect diagnostics (slow, ~60-120s)
 *   bun run quality --skip-knip       # Skip Knip unused code detection
 *   bun run quality --no-cache        # Disable all caching (ESLint, Prettier, TypeScript incremental)
 *   bun run quality src/index.ts      # Example: check specific file
 *
 * Effect Diagnostics:
 * - Uses Effect Language Service to check for Effect-specific issues
 * - Detects unnecessaryPipeChain, catchUnfailableEffect, returnEffectInGen, tryCatchInEffectGen
 * - SKIPPED by default for faster feedback (CI does not run it)
 * - Use --include-effect for thorough checks (recommended before codebase audits)
 *
 * Smart E2E Detection:
 * - Detects changed files (local: uncommitted changes, CI: diff from main branch)
 * - Maps source file changes to related E2E specs
 * - Runs @regression E2E tests only for affected specs (fast feedback)
 * - Skips E2E if no specs or related source files changed
 *
 * Knip (Unused Code Detection):
 * - Detects unused files, dependencies, and exports
 * - Uses knip.json configuration for project entry points
 * - Use --skip-knip to bypass this check
 *
 * Coverage Check:
 * - Enforces unit test coverage for domain layer (93%+ covered)
 * - Fails if source files are missing corresponding .test.ts files
 * - Use --skip-coverage for gradual adoption
 *
 * Performance optimizations:
 * - Uses fail-fast strategy: runs checks sequentially, stops immediately on first failure (saves time)
 * - Uses ESLint cache for faster subsequent runs (disable with --no-cache)
 * - Uses Prettier cache for faster formatting checks (disable with --no-cache)
 * - Uses TypeScript incremental mode for faster type checking (disable with --no-cache)
 * - Skips checks for comment-only changes (file mode)
 * - For file mode: runs ESLint, TypeScript, and unit tests in parallel
 * - Smart E2E detection prevents running all E2E tests on every change
 * - Provides clear success/failure feedback
 */

import { basename, dirname, extname, join } from 'node:path'
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
  GitService,
  GitServiceLive,
  SpecMappingService,
  SpecMappingServiceLive,
  CoverageService,
  CoverageServiceLive,
  DEFAULT_LAYERS,
  QualityCheckFailedError,
  printSummary,
} from './lib/effect'
import type { CheckResult, LayerConfig } from './lib/effect'

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
  readonly skipWorkflows: boolean
  readonly includeEffect: boolean
  readonly skipKnip: boolean
  readonly skipFormat: boolean
  readonly noCache: boolean
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
    skipWorkflows: args.includes('--skip-workflows'),
    includeEffect: args.includes('--include-effect'),
    skipKnip: args.includes('--skip-knip'),
    skipFormat: args.includes('--skip-format'),
    noCache: args.includes('--no-cache'),
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
 *
 * @param acceptExitCodes - Additional exit codes to treat as success (e.g., [2] for TypeScript warnings)
 */
const runCheck = (
  name: string,
  command: readonly string[],
  timeoutMs: number = 60_000,
  acceptExitCodes: readonly number[] = []
) =>
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
    // Exit code 0 is always success; accept additional codes (e.g., 2 for TypeScript warnings)
    const isSuccess = result.exitCode === 0 || acceptExitCodes.includes(result.exitCode)

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
const runFileChecks = (filePath: string, options: QualityOptions) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    // Validate file exists and is TypeScript
    const exists = yield* fs.exists(filePath)
    if (!exists) {
      yield* logError(`File not found: ${filePath}`)
      return yield* new QualityCheckFailedError({ checks: [] })
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
    const fileEslintCmd = options.noCache
      ? ['bunx', 'eslint', filePath, '--max-warnings', '0']
      : [
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
        ]
    const fileTscCmd = options.noCache
      ? ['bunx', 'tsc', '--noEmit']
      : ['bunx', 'tsc', '--noEmit', '--incremental']
    const checks = [
      runCheck('ESLint', fileEslintCmd, 120_000),
      runCheck('TypeScript', fileTscCmd, 60_000),
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
  // Include errors, warnings, and messages (informational best practice suggestions)
  const result = yield* cmd
    .spawn(
      [
        'bun',
        'node_modules/@effect/language-service/cli.js',
        'diagnostics',
        '--project',
        'tsconfig.json',
        '--severity',
        'error,warning,message',
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

  // Separate Effect diagnostics by severity level
  // Exclude: runEffectInsideEffect (intentional patterns in signal handlers and Drizzle transactions)
  // Note: Output contains ANSI color codes
  const allDiagnosticLines = output.split('\n').filter((line) => {
    if (!line.includes('effect(')) return false
    // Exclude intentional runEffectInsideEffect patterns
    if (line.includes('runEffectInsideEffect')) return false
    return true
  })

  // ERROR-level diagnostics (blocking - must be fixed)
  const errorLines = allDiagnosticLines.filter((line) => line.match(/error.*effect\(/))

  // MESSAGE-level diagnostics (informational - warnings only)
  const messageLines = allDiagnosticLines.filter((line) => line.match(/message.*effect\(/))

  const errorCount = errorLines.length
  const messageCount = messageLines.length

  // Display MESSAGE-level warnings (non-blocking)
  if (messageCount > 0) {
    yield* Effect.log('')
    yield* Effect.log(`⚠️  Effect Diagnostics: ${messageCount} informational warning(s)`)
    yield* Effect.log('   (These are suggestions and do not block the build)')
    yield* Effect.log('')
    for (const line of messageLines) {
      console.log(line)
    }
    yield* Effect.log('')
  }

  // Fail only on ERROR-level diagnostics
  if (errorCount > 0) {
    yield* logError(`Effect Diagnostics failed (${duration}ms) - ${errorCount} error(s)`)
    yield* Effect.log('')
    for (const line of errorLines) {
      console.error(line)
    }
    return {
      name: 'Effect Diagnostics',
      success: false,
      duration,
      error: `${errorCount} Effect error(s) found`,
    } as CheckResult
  }

  // Success message includes warning count for visibility
  const warningNote = messageCount > 0 ? ` (${messageCount} informational warnings)` : ''
  yield* success(`Effect Diagnostics passed (${duration}ms)${warningNote}`)
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

    // 1. Prettier format check (fail-fast)
    // Note: Timeout increased to 120s for CI environments where cache may be cold
    if (!options.skipFormat) {
      const prettierCmd = options.noCache
        ? ['bunx', 'prettier', '--check', '.']
        : ['bunx', 'prettier', '--check', '.', '--cache', '--cache-location', '.prettiercache']
      const formatResult = yield* runCheck('Prettier', prettierCmd, 120_000)
      results.push(formatResult)
      if (!formatResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Prettier failure (fail-fast mode)')
        yield* Effect.log('  Run `bun format` to auto-fix formatting issues')
        return results
      }
    } else {
      yield* skip('Prettier skipped (--skip-format flag)')
      results.push({
        name: 'Prettier',
        success: true,
        duration: 0,
      })
    }

    // 2. ESLint check
    const eslintCmd = options.noCache
      ? ['bunx', 'eslint', '.', '--max-warnings', '0']
      : [
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
        ]
    const eslintResult = yield* runCheck('ESLint', eslintCmd, 120_000)
    results.push(eslintResult)
    if (!eslintResult.success) {
      yield* logError('\n⚠️  Stopping checks due to ESLint failure (fail-fast mode)')
      return results
    }

    // 3. GitHub Actions workflow linting (actionlint)
    if (!options.skipWorkflows) {
      const workflowResult = yield* runCheck('Workflow Lint', ['actionlint'], 30_000)
      results.push(workflowResult)
      if (!workflowResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Workflow Lint failure (fail-fast mode)')
        yield* Effect.log('  Run `bun run lint:workflows` to see detailed workflow issues')
        return results
      }
    } else {
      yield* skip('Workflow Lint skipped (--skip-workflows flag)')
      results.push({
        name: 'Workflow Lint',
        success: true,
        duration: 0,
      })
    }

    // 4. TypeScript check
    const tscCmd = options.noCache
      ? ['bunx', 'tsc', '--noEmit']
      : ['bunx', 'tsc', '--noEmit', '--incremental']
    const tscResult = yield* runCheck('TypeScript', tscCmd, 60_000)
    results.push(tscResult)
    if (!tscResult.success) {
      yield* logError('\n⚠️  Stopping checks due to TypeScript failure (fail-fast mode)')
      return results
    }

    // 5. Effect diagnostics (optional)
    if (options.includeEffect) {
      const effectResult = yield* runEffectDiagnostics
      results.push(effectResult)
      if (!effectResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Effect Diagnostics failure (fail-fast mode)')
        return results
      }
    } else {
      yield* skip('Effect Diagnostics skipped (use --include-effect to include)')
      results.push({
        name: 'Effect Diagnostics',
        success: true,
        duration: 0,
      })
    }

    // 6. Unit tests
    const unitResult = yield* runCheck(
      'Unit Tests',
      ['bun', 'test', '.test.ts', '.test.tsx'],
      60_000
    )
    results.push(unitResult)
    if (!unitResult.success) {
      yield* logError('\n⚠️  Stopping checks due to Unit Tests failure (fail-fast mode)')
      return results
    }

    // 7. Knip (unused code detection)
    if (!options.skipKnip) {
      const knipResult = yield* runCheck('Knip', ['bunx', 'knip'], 30_000)
      results.push(knipResult)
      if (!knipResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Knip failure (fail-fast mode)')
        yield* Effect.log('  Run `bun run clean` to see detailed unused code report')
        return results
      }
    } else {
      yield* skip('Knip skipped (--skip-knip flag)')
      results.push({
        name: 'Knip',
        success: true,
        duration: 0,
      })
    }

    // 8. Coverage check (optional)
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

    // 9. Smart E2E detection
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
    results = yield* runFileChecks(options.file, options)
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
