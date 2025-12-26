/* eslint-disable max-lines */
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validate Specs Script
 *
 * Automates mechanical TDD validation tasks:
 * - Single spec mode: Pass spec ID, remove .fixme(), run test, restore if failing, commit if passing
 * - Batch mode: Run on all specs with .fixme(), process each, restore failing, commit passing
 *
 * Usage:
 *   bun run validate:specs APP-VERSION-001           # Single spec
 *   bun run validate:specs -- --all                  # Batch mode
 *   bun run validate:specs -- --dry-run APP-VERSION-001  # Preview only
 *   bun run validate:specs -- --json APP-VERSION-001     # JSON output
 *
 * Alternative (direct):
 *   bun run scripts/validate-specs.ts APP-VERSION-001
 *   bun run scripts/validate-specs.ts --all
 */

import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  CommandService,
  CommandServiceLive,
  FileSystemService,
  FileSystemServiceLive,
  GitServiceLive,
  LoggerServicePretty,
  logInfo,
  success,
  progress,
} from './lib/effect'
import { createSchemaPriorityCalculator } from './tdd-automation/schema-priority-calculator'
import { parseTestFileForSpecs } from './tdd-automation/services/spec-scanner'
import type { LoggerService } from './lib/effect'
import type { SpecItem } from './tdd-automation/services/types'

// ============================================================================
// Error Types
// ============================================================================

export class SpecNotFoundError extends Data.TaggedError('SpecNotFoundError')<{
  readonly specId: string
  readonly message: string
}> {}

export class TestFailedError extends Data.TaggedError('TestFailedError')<{
  readonly specId: string
  readonly file: string
  readonly exitCode: number
  readonly stderr: string
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly specId: string
  readonly message: string
  readonly cause?: unknown
}> {}

// ============================================================================
// Result Types
// ============================================================================

export type ValidationResult =
  | {
      readonly status: 'passed'
      readonly specId: string
      readonly file: string
      readonly hasSrcChanges: boolean
      readonly committed: boolean
      readonly issueNumber: number | null
      readonly issueClosed: boolean
    }
  | {
      readonly status: 'failed'
      readonly specId: string
      readonly file: string
      readonly error: string
      readonly restored: boolean
    }
  | {
      readonly status: 'skipped'
      readonly specId: string
      readonly reason: string
    }

export interface BatchResult {
  readonly timestamp: string
  readonly mode: 'single' | 'batch'
  readonly dryRun: boolean
  readonly results: readonly ValidationResult[]
  readonly summary: {
    readonly total: number
    readonly passed: number
    readonly failed: number
    readonly skipped: number
    readonly earlyExits: number
    readonly issuesClosed: number
  }
}

// ============================================================================
// CLI Arguments
// ============================================================================

interface CliArgs {
  readonly specId: string | null
  readonly all: boolean
  readonly dryRun: boolean
  readonly json: boolean
}

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2)
  let specId: string | null = null
  let all = false
  let dryRun = false
  let json = false

  for (const arg of args) {
    switch (arg) {
      case '--all': {
        all = true
        break
      }
      case '--dry-run': {
        dryRun = true
        break
      }
      case '--json': {
        json = true
        break
      }
      default: {
        if (!arg.startsWith('-')) {
          specId = arg
        }
      }
    }
  }

  return { specId, all, dryRun, json }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Find spec file and line number for a given spec ID
 */
const findSpecFile = (specId: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    // Scan all spec files
    const specFiles = yield* fs
      .glob('specs/**/*.spec.ts')
      .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
    const calculatePriority = createSchemaPriorityCalculator()

    // Parse each file looking for the spec ID
    for (const file of specFiles) {
      const content = yield* fs.readFile(file).pipe(Effect.catchAll(() => Effect.succeed('')))

      if (content.includes(specId)) {
        // Find line number
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line && line.includes(specId)) {
            // Check if this line or previous line(s) have .fixme(
            // Pattern: test.fixme( or it.fixme( can be on same line or within 3 lines above
            const isFixme = (() => {
              const linesToCheck = [line]
              for (let j = 1; j <= 3 && i - j >= 0; j++) {
                linesToCheck.push(lines[i - j] ?? '')
              }
              return linesToCheck.some((l) => l.includes('.fixme('))
            })()

            if (!isFixme) {
              continue // Not a .fixme() test, skip
            }

            // Extract description
            const descMatch = line.match(/[A-Z]+-[A-Z-]+-\d{3}:\s*(.+?)['"`]/)
            const description = descMatch?.[1]?.trim() ?? 'No description'

            // Extract feature from path
            const pathParts = file.split('/')
            const specsIndex = pathParts.indexOf('specs')
            const feature = pathParts
              .slice(specsIndex + 1)
              .join('/')
              .replace('.spec.ts', '')

            return {
              specId,
              file,
              line: i + 1,
              description,
              feature,
              priority: calculatePriority(specId),
            }
          }
        }

        // Spec ID found but not with .fixme - might already be passing
        return yield* Effect.fail(
          new SpecNotFoundError({
            specId,
            message: `Spec ${specId} found in ${file} but not marked with .fixme() - may already be passing`,
          })
        )
      }
    }

    return yield* Effect.fail(
      new SpecNotFoundError({
        specId,
        message: `Spec ${specId} not found in any spec file`,
      })
    )
  })

/**
 * Remove .fixme() from a specific test in a file
 * Returns the original content for restoration
 */
const removeFixme = (
  file: string,
  specId: string
): Effect.Effect<
  { originalContent: string; modifiedContent: string },
  ValidationError,
  FileSystemService
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const originalContent = yield* fs.readFile(file).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ValidationError({
            specId,
            message: `Failed to read file ${file}`,
            cause: error,
          })
        )
      )
    )

    // Find and replace test.fixme( or it.fixme( for this specific spec ID
    const lines = originalContent.split('\n')
    const modifiedLines: string[] = []
    let found = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) {
        modifiedLines.push(line ?? '')
        continue
      }

      // Check if this line contains our spec ID with .fixme
      if (
        (line.includes('test.fixme(') || line.includes('it.fixme(')) &&
        (line.includes(specId) || (lines[i + 1] && lines[i + 1]!.includes(specId)))
      ) {
        // Replace .fixme( with (
        const modified = line.replace('test.fixme(', 'test(').replace('it.fixme(', 'it(')
        modifiedLines.push(modified)
        found = true
      } else {
        modifiedLines.push(line)
      }
    }

    if (!found) {
      return yield* Effect.fail(
        new ValidationError({
          specId,
          message: `Could not find test.fixme() or it.fixme() for ${specId} in ${file}`,
        })
      )
    }

    const modifiedContent = modifiedLines.join('\n')

    // Write modified content
    yield* fs.writeFile(file, modifiedContent).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ValidationError({
            specId,
            message: `Failed to write modified file ${file}`,
            cause: error,
          })
        )
      )
    )

    return { originalContent, modifiedContent }
  })

/**
 * Restore original file content
 */
const restoreFile = (
  file: string,
  originalContent: string,
  specId: string
): Effect.Effect<void, ValidationError, FileSystemService> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    yield* fs.writeFile(file, originalContent).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ValidationError({
            specId,
            message: `Failed to restore file ${file}`,
            cause: error,
          })
        )
      )
    )
  })

/**
 * Run the spec test (single spec mode)
 */
const runTest = (
  file: string,
  specId: string
): Effect.Effect<{ passed: boolean; exitCode: number; stderr: string }, never, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // Run playwright test with specific file
    const result = yield* cmd
      .spawn(['bunx', 'playwright', 'test', file, '--grep', specId], {
        timeout: 120_000, // 2 minutes
        throwOnError: false,
      })
      .pipe(
        Effect.catchAll(() =>
          Effect.succeed({
            exitCode: 1,
            stdout: '',
            stderr: 'Command spawn failed',
            duration: 0,
          })
        )
      )

    return {
      passed: result.exitCode === 0,
      exitCode: result.exitCode,
      stderr: result.stderr,
    }
  })

/**
 * Playwright JSON reporter result structure
 */
interface PlaywrightTestResult {
  readonly title: string
  readonly status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
}

interface PlaywrightSpec {
  readonly title: string
  readonly tests: readonly PlaywrightTestResult[]
}

interface PlaywrightSuite {
  readonly title: string
  readonly specs: readonly PlaywrightSpec[]
  readonly suites: readonly PlaywrightSuite[]
}

interface PlaywrightJsonReport {
  readonly suites: readonly PlaywrightSuite[]
}

/**
 * Extract all test results from Playwright JSON report (recursive)
 */
const extractTestResults = (
  suites: readonly PlaywrightSuite[]
): ReadonlyMap<string, 'passed' | 'failed'> => {
  const results = new Map<string, 'passed' | 'failed'>()

  const processSpec = (spec: PlaywrightSpec) => {
    for (const test of spec.tests) {
      // Extract spec ID from test title (format: "[SPEC-ID] description" or "SPEC-ID: description")
      const specIdMatch = test.title.match(
        /\[([A-Z]+-[A-Z]+-[A-Z0-9-]+)\]|^([A-Z]+-[A-Z]+-[A-Z0-9-]+):/
      )
      if (specIdMatch) {
        const specId = specIdMatch[1] || specIdMatch[2]
        if (specId) {
          results.set(specId, test.status === 'passed' ? 'passed' : 'failed')
        }
      }
    }
  }

  const processSuite = (suite: PlaywrightSuite) => {
    for (const spec of suite.specs) {
      processSpec(spec)
    }
    for (const nestedSuite of suite.suites) {
      processSuite(nestedSuite)
    }
  }

  for (const suite of suites) {
    processSuite(suite)
  }

  return results
}

/**
 * Run batch tests with a single Playwright command
 * Returns a map of spec ID to pass/fail status
 */
const runBatchTests = (
  files: readonly string[],
  specIds: readonly string[]
): Effect.Effect<ReadonlyMap<string, 'passed' | 'failed'>, never, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // Build grep pattern for all spec IDs: "ID1|ID2|ID3"
    const grepPattern = specIds.join('|')

    // Get unique files
    const uniqueFiles = [...new Set(files)]

    // Run playwright with JSON reporter
    const args = [
      'bunx',
      'playwright',
      'test',
      ...uniqueFiles,
      '--grep',
      grepPattern,
      '--reporter=json',
    ]

    const result = yield* cmd
      .spawn(args, {
        timeout: 600_000, // 10 minutes for batch
        throwOnError: false,
      })
      .pipe(
        Effect.catchAll(() =>
          Effect.succeed({
            exitCode: 1,
            stdout: '{"suites":[]}',
            stderr: 'Command spawn failed',
            duration: 0,
          })
        )
      )

    // Parse JSON output
    try {
      const report = JSON.parse(result.stdout) as PlaywrightJsonReport
      return extractTestResults(report.suites)
    } catch {
      // If JSON parsing fails, assume all tests failed
      const failedResults = new Map<string, 'passed' | 'failed'>()
      for (const specId of specIds) {
        failedResults.set(specId, 'failed')
      }
      return failedResults
    }
  })

/**
 * Check if any src/ files were modified (for early exit detection)
 */
const hasSrcChanges = (): Effect.Effect<boolean, never, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // Get uncommitted changes in src/
    const result = yield* cmd
      .exec('git diff --name-only HEAD | grep "^src/" | wc -l', { throwOnError: false })
      .pipe(Effect.catchAll(() => Effect.succeed('0')))

    const count = parseInt(result.trim(), 10)
    return count > 0
  })

/**
 * Commit the passing spec
 */
const commitSpec = (
  file: string,
  specId: string
): Effect.Effect<void, ValidationError, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // Stage the file
    yield* cmd.spawn(['git', 'add', file], { throwOnError: true }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ValidationError({
            specId,
            message: `Failed to stage ${file}`,
            cause: error,
          })
        )
      )
    )

    // Commit with message
    const message = `fix: implement ${specId}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`

    yield* cmd.spawn(['git', 'commit', '-m', message], { throwOnError: true }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ValidationError({
            specId,
            message: `Failed to commit ${specId}`,
            cause: error,
          })
        )
      )
    )
  })

/**
 * Find GitHub issue number for a spec ID
 * Issues follow format: "🤖 {SPEC-ID}: {description}"
 */
const findIssueBySpecId = (specId: string): Effect.Effect<number | null, never, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // Search for open issues with tdd-automation label containing the spec ID
    const result = yield* cmd
      .exec(
        `gh issue list --label "tdd-automation" --state open --json number,title --jq '.[] | select(.title | contains("${specId}")) | .number'`,
        { throwOnError: false }
      )
      .pipe(Effect.catchAll(() => Effect.succeed('')))

    const issueNumber = parseInt(result.trim(), 10)
    return isNaN(issueNumber) ? null : issueNumber
  })

/**
 * TDD workflow labels for state management
 */
const TDD_STATE_LABELS = ['tdd-spec:queued', 'tdd-spec:in-progress', 'tdd-spec:failed'] as const

/**
 * Close a GitHub issue with proper TDD workflow label management
 *
 * Following TDD workflow process:
 * 1. Remove old state labels (queued, in-progress, failed)
 * 2. Add tdd-spec:completed label
 * 3. Add closure comment
 * 4. Close the issue with reason "completed"
 */
const closeIssue = (
  issueNumber: number,
  specId: string
): Effect.Effect<boolean, never, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // 1. Remove old TDD state labels
    for (const label of TDD_STATE_LABELS) {
      yield* cmd
        .exec(`gh issue edit ${issueNumber} --remove-label "${label}"`, { throwOnError: false })
        .pipe(Effect.catchAll(() => Effect.succeed('')))
    }

    // 2. Add tdd-spec:completed label
    yield* cmd
      .exec(`gh issue edit ${issueNumber} --add-label "tdd-spec:completed"`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.succeed('')))

    // 3. Add a comment explaining the closure
    const comment = `✅ Spec ${specId} passed validation and was committed.\n\nAutomatically closed by validate-specs.ts`

    yield* cmd
      .exec(`gh issue comment ${issueNumber} --body "${comment}"`, { throwOnError: false })
      .pipe(Effect.catchAll(() => Effect.succeed('')))

    // 4. Close the issue
    const closeResult = yield* cmd
      .exec(`gh issue close ${issueNumber} --reason completed`, { throwOnError: false })
      .pipe(
        Effect.map(() => true),
        Effect.catchAll(() => Effect.succeed(false))
      )

    return closeResult
  })

/**
 * Validate a single spec
 */
const validateSpec = (
  specId: string,
  dryRun: boolean
): Effect.Effect<ValidationResult, never, FileSystemService | CommandService | LoggerService> =>
  Effect.gen(function* () {
    yield* progress(`Validating ${specId}...`)

    // 1. Find spec file
    const specItemResult = yield* findSpecFile(specId).pipe(
      Effect.map((item) => ({ type: 'found' as const, item })),
      Effect.catchAll((error) =>
        Effect.succeed({
          type: 'skipped' as const,
          result: {
            status: 'skipped' as const,
            specId,
            reason: error.message,
          },
        })
      )
    )

    if (specItemResult.type === 'skipped') {
      return specItemResult.result
    }

    const { file } = specItemResult.item

    // 2. Remove .fixme()
    yield* logInfo(`  Removing .fixme() from ${file}`)

    if (dryRun) {
      yield* logInfo(`  [DRY RUN] Would run test and check result`)
      return {
        status: 'skipped' as const,
        specId,
        reason: 'Dry run mode - no changes made',
      }
    }

    const removeResult = yield* removeFixme(file, specId).pipe(
      Effect.map((data) => ({ type: 'success' as const, data })),
      Effect.catchAll((error) =>
        Effect.succeed({
          type: 'failed' as const,
          result: {
            status: 'failed' as const,
            specId,
            file,
            error: error.message,
            restored: false,
          },
        })
      )
    )

    if (removeResult.type === 'failed') {
      return removeResult.result
    }

    const { originalContent } = removeResult.data

    // 3. Run test
    yield* logInfo(`  Running test...`)
    const testResult = yield* runTest(file, specId)

    if (!testResult.passed) {
      // 4a. Test failed - restore .fixme()
      yield* logInfo(`  Test failed (exit code ${testResult.exitCode}), restoring .fixme()`)
      yield* restoreFile(file, originalContent, specId).pipe(
        Effect.catchAll(() => Effect.succeed(undefined))
      )

      return {
        status: 'failed' as const,
        specId,
        file,
        error: `Test failed with exit code ${testResult.exitCode}`,
        restored: true,
      }
    }

    // 4b. Test passed - check for src changes (early exit detection)
    yield* success(`  Test passed for ${specId}!`)
    const srcModified = yield* hasSrcChanges()

    if (!srcModified) {
      yield* logInfo(`  ⚡ Early exit: No src/ changes detected - feature already implemented`)
    }

    // 5. Commit the change
    yield* logInfo(`  Committing changes...`)
    const commitResult = yield* commitSpec(file, specId).pipe(
      Effect.map(() => true),
      Effect.catchAll((error) => {
        console.error(`  Failed to commit: ${error.message}`)
        return Effect.succeed(false)
      })
    )

    // 6. Find and close the GitHub issue if committed
    let issueNumber: number | null = null
    let issueClosed = false

    if (commitResult) {
      yield* logInfo(`  Looking for GitHub issue...`)
      issueNumber = yield* findIssueBySpecId(specId)

      if (issueNumber) {
        yield* logInfo(`  Found issue #${issueNumber}, closing...`)
        issueClosed = yield* closeIssue(issueNumber, specId)
        if (issueClosed) {
          yield* success(`  ✅ Closed issue #${issueNumber}`)
        } else {
          yield* logInfo(`  ⚠️  Failed to close issue #${issueNumber}`)
        }
      } else {
        yield* logInfo(`  No open issue found for ${specId}`)
      }
    }

    return {
      status: 'passed' as const,
      specId,
      file,
      hasSrcChanges: srcModified,
      committed: commitResult,
      issueNumber,
      issueClosed,
    }
  })

/**
 * Get all specs with .fixme() for batch mode
 */
const getAllFixmeSpecs = (): Effect.Effect<readonly SpecItem[], never, FileSystemService> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const specFiles = yield* fs
      .glob('specs/**/*.spec.ts')
      .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
    const calculatePriority = createSchemaPriorityCalculator()

    const allSpecs: SpecItem[] = []

    for (const file of specFiles) {
      const specs = yield* parseTestFileForSpecs(file, calculatePriority)
      allSpecs.push(...specs)
    }

    // Sort by priority
    return allSpecs.sort((a, b) => a.priority - b.priority)
  })

/**
 * Remove .fixme() for multiple specs in the same file
 * Returns the original content for restoration
 */
const removeFixmeForSpecs = (
  file: string,
  specIds: readonly string[]
): Effect.Effect<
  { originalContent: string; modifiedContent: string },
  ValidationError,
  FileSystemService
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    const originalContent = yield* fs.readFile(file).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ValidationError({
            specId: specIds[0] ?? 'unknown',
            message: `Failed to read file ${file}`,
            cause: error,
          })
        )
      )
    )

    // Remove .fixme() for all spec IDs in this file
    const lines = originalContent.split('\n')
    const modifiedLines: string[] = []
    const specIdSet = new Set(specIds)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) {
        modifiedLines.push(line ?? '')
        continue
      }

      // Check if this line contains any of our spec IDs with .fixme
      const hasFixme = line.includes('test.fixme(') || line.includes('it.fixme(')
      const matchesSpecId =
        [...specIdSet].some((id) => line.includes(id)) ||
        (lines[i + 1] && [...specIdSet].some((id) => lines[i + 1]!.includes(id)))

      if (hasFixme && matchesSpecId) {
        const modified = line.replace('test.fixme(', 'test(').replace('it.fixme(', 'it(')
        modifiedLines.push(modified)
      } else {
        modifiedLines.push(line)
      }
    }

    const modifiedContent = modifiedLines.join('\n')

    yield* fs.writeFile(file, modifiedContent).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ValidationError({
            specId: specIds[0] ?? 'unknown',
            message: `Failed to write modified file ${file}`,
            cause: error,
          })
        )
      )
    )

    return { originalContent, modifiedContent }
  })

/**
 * Restore .fixme() for specific spec IDs in a file
 */
const restoreFixmeForSpecs = (
  file: string,
  specIds: readonly string[]
): Effect.Effect<void, never, FileSystemService> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    const content = yield* fs.readFile(file).pipe(Effect.catchAll(() => Effect.succeed('')))

    if (!content) return

    const lines = content.split('\n')
    const modifiedLines: string[] = []
    const specIdSet = new Set(specIds)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) {
        modifiedLines.push(line ?? '')
        continue
      }

      // Check if this line is a test( that matches our spec IDs
      const isTest =
        (line.includes('test(') || line.includes('it(')) &&
        !line.includes('test.fixme(') &&
        !line.includes('it.fixme(')
      const matchesSpecId =
        [...specIdSet].some((id) => line.includes(id)) ||
        (lines[i + 1] && [...specIdSet].some((id) => lines[i + 1]!.includes(id)))

      if (isTest && matchesSpecId) {
        const modified = line.replace('test(', 'test.fixme(').replace('it(', 'it.fixme(')
        modifiedLines.push(modified)
      } else {
        modifiedLines.push(line)
      }
    }

    const modifiedContent = modifiedLines.join('\n')

    yield* fs
      .writeFile(file, modifiedContent)
      .pipe(Effect.catchAll(() => Effect.succeed(undefined)))
  })

/**
 * Validate all specs in batch mode (OPTIMIZED: single Playwright run)
 */
const validateAllSpecs = (
  dryRun: boolean
): Effect.Effect<
  readonly ValidationResult[],
  never,
  FileSystemService | CommandService | LoggerService
> =>
  Effect.gen(function* () {
    yield* progress('Batch mode: Scanning for all .fixme() specs...')

    const specs = yield* getAllFixmeSpecs()
    yield* logInfo(`Found ${specs.length} specs with .fixme()`)

    if (specs.length === 0) {
      return []
    }

    if (dryRun) {
      yield* logInfo('[DRY RUN] Would process all specs in single Playwright run')
      return specs.map((spec) => ({
        status: 'skipped' as const,
        specId: spec.specId,
        reason: 'Dry run mode - no changes made',
      }))
    }

    // Group specs by file
    const specsByFile = new Map<string, SpecItem[]>()
    for (const spec of specs) {
      const existing = specsByFile.get(spec.file) ?? []
      existing.push(spec)
      specsByFile.set(spec.file, existing)
    }

    yield* progress(`Preparing ${specsByFile.size} files for batch testing...`)

    // 1. Remove .fixme() from ALL specs at once, storing original content per file
    const originalContents = new Map<string, string>()

    for (const [file, fileSpecs] of specsByFile) {
      const specIds = fileSpecs.map((s) => s.specId)
      yield* logInfo(`  Removing .fixme() from ${file} (${specIds.length} specs)`)

      const result = yield* removeFixmeForSpecs(file, specIds).pipe(
        Effect.catchAll((error) => {
          console.error(`  Failed to modify ${file}: ${error.message}`)
          return Effect.succeed({ originalContent: '', modifiedContent: '' })
        })
      )

      if (result.originalContent) {
        originalContents.set(file, result.originalContent)
      }
    }

    // 2. Run ONE Playwright test for all specs
    yield* progress(`Running tests for ${specs.length} specs in single Playwright instance...`)

    const files = [...specsByFile.keys()]
    const specIds = specs.map((s) => s.specId)
    const testResults = yield* runBatchTests(files, specIds)

    yield* logInfo(`Test run complete. Processing results...`)

    // 3. Process results for each spec
    const results: ValidationResult[] = []

    // Group passed/failed specs by file for efficient restoration
    const failedSpecsByFile = new Map<string, string[]>()
    const passedSpecs: SpecItem[] = []

    for (const spec of specs) {
      const testResult = testResults.get(spec.specId)
      const passed = testResult === 'passed'

      if (passed) {
        passedSpecs.push(spec)
      } else {
        const existing = failedSpecsByFile.get(spec.file) ?? []
        existing.push(spec.specId)
        failedSpecsByFile.set(spec.file, existing)
      }
    }

    // 4. Restore .fixme() for failed specs (per file)
    for (const [file, failedSpecIds] of failedSpecsByFile) {
      yield* logInfo(`  Restoring .fixme() for ${failedSpecIds.length} failed specs in ${file}`)
      yield* restoreFixmeForSpecs(file, failedSpecIds)

      for (const specId of failedSpecIds) {
        results.push({
          status: 'failed' as const,
          specId,
          file,
          error: 'Test failed',
          restored: true,
        })
      }
    }

    // 5. Process passed specs: check src changes, commit, close issues
    for (const spec of passedSpecs) {
      yield* success(`  ✅ ${spec.specId} passed!`)

      const srcModified = yield* hasSrcChanges()

      if (!srcModified) {
        yield* logInfo(`    ⚡ Early exit: No src/ changes detected`)
      }

      // Commit the change
      yield* logInfo(`    Committing...`)
      const commitResult = yield* commitSpec(spec.file, spec.specId).pipe(
        Effect.map(() => true),
        Effect.catchAll((error) => {
          console.error(`    Failed to commit: ${error.message}`)
          return Effect.succeed(false)
        })
      )

      // Find and close the GitHub issue
      let issueNumber: number | null = null
      let issueClosed = false

      if (commitResult) {
        issueNumber = yield* findIssueBySpecId(spec.specId)

        if (issueNumber) {
          yield* logInfo(`    Closing issue #${issueNumber}...`)
          issueClosed = yield* closeIssue(issueNumber, spec.specId)
          if (issueClosed) {
            yield* success(`    🔒 Closed issue #${issueNumber}`)
          }
        }
      }

      results.push({
        status: 'passed' as const,
        specId: spec.specId,
        file: spec.file,
        hasSrcChanges: srcModified,
        committed: commitResult,
        issueNumber,
        issueClosed,
      })
    }

    return results
  })

// ============================================================================
// Main Program
// ============================================================================

const main = Effect.gen(function* () {
  const args = parseArgs()

  // Show usage if no args
  if (!args.specId && !args.all) {
    console.log(`
Usage:
  bun run validate:specs <SPEC-ID>              # Validate single spec
  bun run validate:specs -- --all               # Validate all .fixme() specs
  bun run validate:specs -- --dry-run <ID>      # Preview without changes
  bun run validate:specs -- --json <ID>         # Output as JSON

Alternative (direct):
  bun run scripts/validate-specs.ts <SPEC-ID>
  bun run scripts/validate-specs.ts --all
  bun run scripts/validate-specs.ts --dry-run APP-VERSION-001
  bun run scripts/validate-specs.ts --json APP-THEME-001
`)
    return
  }

  const startTime = Date.now()

  // Run validation
  const results: readonly ValidationResult[] = args.all
    ? yield* validateAllSpecs(args.dryRun)
    : yield* validateSpec(args.specId!, args.dryRun).pipe(Effect.map((r) => [r]))

  // Build summary
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    earlyExits: results.filter((r) => r.status === 'passed' && !r.hasSrcChanges).length,
    issuesClosed: results.filter((r) => r.status === 'passed' && r.issueClosed).length,
  }

  const batchResult: BatchResult = {
    timestamp: new Date().toISOString(),
    mode: args.all ? 'batch' : 'single',
    dryRun: args.dryRun,
    results,
    summary,
  }

  // Output results
  if (args.json) {
    console.log(JSON.stringify(batchResult, null, 2))
  } else {
    console.log('')
    console.log('─────────────────────────────────────────────')
    console.log('Validation Results')
    console.log('─────────────────────────────────────────────')
    console.log(`  Total:       ${summary.total}`)
    console.log(`  ✅ Passed:   ${summary.passed}`)
    console.log(`  ❌ Failed:   ${summary.failed}`)
    console.log(`  ⏭️  Skipped:  ${summary.skipped}`)
    if (summary.earlyExits > 0) {
      console.log(`  ⚡ Early exits: ${summary.earlyExits} (no src/ changes needed)`)
    }
    if (summary.issuesClosed > 0) {
      console.log(`  🔒 Issues closed: ${summary.issuesClosed}`)
    }
    console.log(`  Duration:   ${Date.now() - startTime}ms`)
    console.log('─────────────────────────────────────────────')

    // Show failed specs
    const failed = results.filter((r) => r.status === 'failed')
    if (failed.length > 0) {
      console.log('')
      console.log('Failed specs:')
      for (const f of failed) {
        if (f.status === 'failed') {
          console.log(`  - ${f.specId}: ${f.error}`)
        }
      }
    }
  }

  // Exit with appropriate code
  if (summary.failed > 0) {
    process.exit(1)
  }
})

// ============================================================================
// Run
// ============================================================================

const MainLayer = Layer.mergeAll(
  CommandServiceLive,
  FileSystemServiceLive,
  Layer.provideMerge(GitServiceLive, CommandServiceLive),
  LoggerServicePretty()
)

Effect.runPromise(main.pipe(Effect.provide(MainLayer))).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
