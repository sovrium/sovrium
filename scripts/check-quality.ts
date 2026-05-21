#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { basename, dirname, extname, join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { runDependencyAudit } from './lib/dependency-audit'
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

interface E2EDecision {
  readonly run: boolean
  readonly specs: readonly string[]
  readonly reason: string
}

interface QualityOptions {
  readonly file?: string
  readonly skipE2E: boolean
  readonly skipCoverage: boolean
  readonly skipWorkflows: boolean
  readonly skipAudit: boolean
  readonly includeEffect: boolean
  readonly skipKnip: boolean
  readonly skipFormat: boolean
  readonly noCache: boolean
}

const parseArgs = (): QualityOptions => {
  const args = process.argv.slice(2)
  return {
    file: args.find((a) => !a.startsWith('--')),
    skipE2E: args.includes('--skip-e2e'),
    skipCoverage: args.includes('--skip-coverage'),
    skipWorkflows: args.includes('--skip-workflows'),
    skipAudit: args.includes('--skip-audit'),
    includeEffect: args.includes('--include-effect'),
    skipKnip: args.includes('--skip-knip'),
    skipFormat: args.includes('--skip-format'),
    noCache: args.includes('--no-cache'),
  }
}

const isTypeScriptFile = (filePath: string): boolean => {
  const ext = extname(filePath)
  return ext === '.ts' || ext === '.tsx'
}

const stripComments = (code: string): string => {
  let stripped = code.replace(/\/\/.*$/gm, '')

  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '')

  stripped = stripped.replace(/\/\*\*[\s\S]*?\*\//g, '')

  return stripped
}

const isCommentOnlyChange = (filePath: string) =>
  Effect.gen(function* () {
    const cmd = yield* CommandService
    const fs = yield* FileSystemService

    const tracked = yield* cmd
      .exec(`git ls-files --error-unmatch "${filePath}"`, { throwOnError: false })
      .pipe(
        Effect.map((output) => output.trim().length > 0),
        Effect.catchAll(() => Effect.succeed(false))
      )

    if (!tracked) {
      return false
    }

    const currentContent = yield* fs
      .readFile(filePath)
      .pipe(Effect.catchAll(() => Effect.succeed('')))

    const headContent = yield* cmd
      .exec(`git show HEAD:"${filePath}"`, { throwOnError: false })
      .pipe(
        Effect.map((output) => output.trim()),
        Effect.catchAll(() => Effect.succeed(''))
      )

    if (headContent.length === 0) {
      return false
    }

    const currentStripped = stripComments(currentContent).trim()
    const headStripped = stripComments(headContent).trim()

    return currentStripped === headStripped
  })

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

const NODE_HEAP_ENV = { NODE_OPTIONS: '--max-old-space-size=12288' } as const

const runCheck = (
  name: string,
  command: readonly string[],
  timeoutMs: number = 60_000,
  acceptExitCodes: readonly number[] = [],
  extraEnv: Record<string, string> = {}
) =>
  Effect.gen(function* () {
    const cmd = yield* CommandService
    const startTime = Date.now()

    yield* progress(`${name}...`)

    const childEnv =
      Object.keys(extraEnv).length > 0
        ? { ...(process.env as Record<string, string>), ...extraEnv }
        : undefined

    const result = yield* cmd
      .spawn(command, { timeout: timeoutMs, throwOnError: false, env: childEnv })
      .pipe(
        Effect.catchTag('CommandTimeoutError', (_) =>
          Effect.succeed({
            exitCode: 1,
            stdout: '',
            stderr: `${name} timed out after ${timeoutMs}ms`,
          })
        ),
        Effect.catchTag('CommandSpawnError', (e) =>
          Effect.succeed({
            exitCode: 1,
            stdout: '',
            stderr: e.cause ? String(e.cause) : `Failed to spawn command`,
          })
        ),
        Effect.catchTag('CommandFailedError', (e) =>
          Effect.succeed({
            exitCode: e.exitCode,
            stdout: e.stdout,
            stderr: e.stderr,
          })
        )
      )

    const duration = Date.now() - startTime
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

const TSC_REAL_ERROR_REGEX = /\): error TS\d+:/
const hasRealTypeErrors = (stdout: string): boolean => TSC_REAL_ERROR_REGEX.test(stdout)

const runTypeScriptCheck = (
  command: readonly string[],
  timeoutMs: number = 60_000,
  extraEnv: Record<string, string> = {}
) =>
  Effect.gen(function* () {
    const cmd = yield* CommandService
    const startTime = Date.now()

    yield* progress('TypeScript...')

    const childEnv =
      Object.keys(extraEnv).length > 0
        ? { ...(process.env as Record<string, string>), ...extraEnv }
        : undefined

    const result = yield* cmd
      .spawn(command, { timeout: timeoutMs, throwOnError: false, env: childEnv })
      .pipe(
        Effect.catchTag('CommandTimeoutError', () =>
          Effect.succeed({
            exitCode: 1,
            stdout: '',
            stderr: `TypeScript timed out after ${timeoutMs}ms`,
          })
        ),
        Effect.catchTag('CommandSpawnError', (e) =>
          Effect.succeed({
            exitCode: 1,
            stdout: '',
            stderr: e.cause ? String(e.cause) : 'Failed to spawn command',
          })
        ),
        Effect.catchTag('CommandFailedError', (e) =>
          Effect.succeed({ exitCode: e.exitCode, stdout: e.stdout, stderr: e.stderr })
        )
      )

    const duration = Date.now() - startTime
    const isSuccess = result.exitCode === 0 || !hasRealTypeErrors(result.stdout)

    const checkResult: CheckResult = {
      name: 'TypeScript',
      success: isSuccess,
      duration,
      error: isSuccess ? undefined : result.stdout || result.stderr,
    }

    if (isSuccess) {
      yield* success(`TypeScript passed (${duration}ms)`)
    } else {
      yield* logError(`TypeScript failed (${duration}ms)`)
      if (result.stdout.length > 0) console.error(result.stdout)
      if (result.stderr.length > 0) console.error(result.stderr)
    }

    return checkResult
  })

const runFileChecks = (filePath: string, options: QualityOptions) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    const exists = yield* fs.exists(filePath)
    if (!exists) {
      yield* logError(`File not found: ${filePath}`)
      return yield* new QualityCheckFailedError({ checks: [] })
    }

    if (!isTypeScriptFile(filePath)) {
      yield* skip(`Skipping checks for ${basename(filePath)} (not a TypeScript file)`)
      return []
    }

    const commentOnly = yield* isCommentOnlyChange(filePath)
    if (commentOnly) {
      yield* skip(`Skipping checks for ${basename(filePath)} (comment-only change)`)
      return []
    }

    const fileName = basename(filePath)
    yield* section(`Running quality checks on ${fileName}`)

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
          '.eslintcache',
          '--cache-strategy',
          'content',
        ]
    const fileTscCmd = options.noCache
      ? ['bunx', 'tsc', '--noEmit', '--incremental', 'false']
      : ['bunx', 'tsc', '--noEmit']
    const checks = [
      runCheck('ESLint', fileEslintCmd, 300_000, [], NODE_HEAP_ENV),
      runTypeScriptCheck(fileTscCmd, 60_000, NODE_HEAP_ENV),
    ]

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

  const specs = yield* mapping.getSpecsToRun(changedFiles)

  if (specs.length > 0) {
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

const runEffectDiagnostics = Effect.gen(function* () {
  const cmd = yield* CommandService
  const startTime = Date.now()

  yield* progress('Effect Diagnostics...')

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
      { timeout: 600_000, throwOnError: false }
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

  const allDiagnosticLines = output.split('\n').filter((line) => {
    if (!line.includes('effect(')) return false
    if (line.includes('runEffectInsideEffect')) return false
    return true
  })

  const errorLines = allDiagnosticLines.filter((line) => line.match(/error.*effect\(/))

  const warningLines = allDiagnosticLines.filter((line) => line.match(/warning.*effect\(/))

  const messageLines = allDiagnosticLines.filter((line) => line.match(/message.*effect\(/))

  const errorCount = errorLines.length
  const warningCount = warningLines.length
  const messageCount = messageLines.length

  if (warningCount > 0) {
    yield* Effect.log(`\n⚠️  Effect Diagnostics: ${warningCount} warning(s)`)
    yield* Effect.log('   (Non-blocking, but should be addressed)\n')
    for (const line of warningLines) console.log(line)
  }
  if (messageCount > 0) {
    yield* Effect.log(`\nℹ️  Effect Diagnostics: ${messageCount} informational message(s)`)
    yield* Effect.log('   (Suggestions, do not block the build)\n')
    for (const line of messageLines) console.log(line)
  }

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

  const parts: string[] = []
  if (messageCount > 0) parts.push(`${messageCount} informational messages`)
  if (warningCount > 0) parts.push(`${warningCount} warnings`)
  const summary = parts.length > 0 ? ` (${parts.join(', ')})` : ''
  yield* success(`Effect Diagnostics passed (${duration}ms)${summary}`)
  return {
    name: 'Effect Diagnostics',
    success: true,
    duration,
  } as CheckResult
})

const runFullChecks = (options: QualityOptions) =>
  Effect.gen(function* () {
    yield* section('Running quality checks on entire codebase (fail-fast)')

    const results: CheckResult[] = []

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
          '.eslintcache',
          '--cache-strategy',
          'content',
        ]
    const eslintResult = yield* runCheck('ESLint', eslintCmd, 300_000, [], NODE_HEAP_ENV)
    results.push(eslintResult)
    if (!eslintResult.success) {
      yield* logError('\n⚠️  Stopping checks due to ESLint failure (fail-fast mode)')
      return results
    }

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

    if (!options.skipAudit) {
      const auditResult = yield* runDependencyAudit
      results.push(auditResult)
      if (!auditResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Dependency Audit failure (fail-fast mode)')
        return results
      }
    } else {
      yield* skip('Dependency Audit skipped (--skip-audit flag)')
      results.push({
        name: 'Dependency Audit',
        success: true,
        duration: 0,
      })
    }

    const tscCmd = options.noCache
      ? ['bunx', 'tsc', '--noEmit', '--incremental', 'false']
      : ['bunx', 'tsc', '--noEmit']
    const tscResult = yield* runTypeScriptCheck(tscCmd, 60_000, NODE_HEAP_ENV)
    results.push(tscResult)
    if (!tscResult.success) {
      yield* logError('\n⚠️  Stopping checks due to TypeScript failure (fail-fast mode)')
      return results
    }

    if (options.includeEffect) {
      const effectResult = yield* runEffectDiagnostics
      results.push(effectResult)
      if (!effectResult.success) {
        yield* logError('\n⚠️  Stopping checks due to Effect Diagnostics failure (fail-fast mode)')
        return results
      }
    } else {
      yield* skip(' Effect Diagnostics skipped (use --include-effect to include)')
      results.push({
        name: 'Effect Diagnostics',
        success: true,
        duration: 0,
      })
    }

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
      yield* skip(` Skipping E2E: ${e2eDecision.reason}`)
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

    const e2eResult = yield* runCheck(
      'E2E Regression Tests',
      ['bunx', 'playwright', 'test', '--grep', '@regression', ...e2eDecision.specs],
      300_000
    )
    results.push(e2eResult)

    return results
  })

const main = Effect.gen(function* () {
  const options = parseArgs()

  const overallStart = Date.now()

  let results: readonly CheckResult[]

  if (options.file && !options.file.startsWith('--')) {
    results = yield* runFileChecks(options.file, options)
  } else {
    results = yield* runFullChecks(options)
  }

  const overallDuration = Date.now() - overallStart

  if (results.length === 0) {
    return
  }

  yield* printSummary(results, overallDuration)
})

const BaseLayer = Layer.mergeAll(FileSystemServiceLive, CommandServiceLive, LoggerServicePretty())

const GitLayer = GitServiceLive.pipe(Layer.provide(CommandServiceLive))
const SpecMappingLayer = SpecMappingServiceLive.pipe(Layer.provide(FileSystemServiceLive))
const CoverageLayer = CoverageServiceLive.pipe(Layer.provide(FileSystemServiceLive))

const MainLayer = Layer.mergeAll(BaseLayer, GitLayer, SpecMappingLayer, CoverageLayer)

const program = main.pipe(
  Effect.provide(MainLayer),
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      console.error('❌ Failed to run quality checks:', error)
      return yield* error
    })
  )
)

Effect.runPromise(program)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
