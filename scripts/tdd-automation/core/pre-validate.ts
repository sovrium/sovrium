/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { $ } from 'bun'
import { Effect, Console, Data } from 'effect'

interface ValidationResult {
  passed: number
  failed: number
  originalContent?: string // Store original content for restoration on failure
}

/**
 * Tagged error types for pre-validation operations
 */
class FileReadError extends Data.TaggedError('FileReadError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class FileWriteError extends Data.TaggedError('FileWriteError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class TestExecutionError extends Data.TaggedError('TestExecutionError')<{
  readonly specId: string
  readonly cause: unknown
}> {}

class OutputWriteError extends Data.TaggedError('OutputWriteError')<{
  readonly path: string
  readonly cause: unknown
}> {}

// Helper to get argument value from command line (supports both --arg=value and --arg value)
const getArgValue = (argName: string): string | undefined => {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${argName}=`))
  if (withEquals) return withEquals.split('=')[1]

  const index = process.argv.indexOf(`--${argName}`)
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]

  return undefined
}

const program = Effect.gen(function* () {
  // Parse arguments from command line
  const file = getArgValue('file')
  const specId = getArgValue('spec-id')
  const testName = getArgValue('test-name')
  const output = getArgValue('output')

  if (!file) {
    console.error('Error: --file argument is required')
    process.exit(1)
  }

  if (!specId) {
    console.error('Error: --spec-id argument is required')
    process.exit(1)
  }

  if (!testName) {
    console.error('Error: --test-name argument is required')
    process.exit(1)
  }

  if (!output) {
    console.error('Error: --output argument is required')
    process.exit(1)
  }

  yield* Console.log(`🔍 Pre-validating spec: ${specId}`)
  yield* Console.log(`📁 File: ${file}`)
  yield* Console.log(`🧪 Test: ${testName}`)

  // Remove .fixme() from ONLY the specified test
  const content = yield* Effect.tryPromise({
    try: () => Bun.file(file).text(),
    catch: (error) => new FileReadError({ path: file, cause: error }),
  })

  // Escape special regex characters in test name
  const escapedTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Match: test.fixme('TEST-NAME', ... or test.fixme("TEST-NAME", ...
  // and remove the .fixme() part
  const fixmePattern = new RegExp(`test\\.fixme\\((['"])${escapedTestName}\\1`, 'g')

  const cleanedContent = content.replace(fixmePattern, (match) => {
    // Replace test.fixme( with test(
    return match.replace('test.fixme(', 'test(')
  })

  if (cleanedContent === content) {
    yield* Console.warn(`⚠️ No .fixme() found for test: ${testName}`)
    yield* Console.warn('This test may have already been implemented')
  }

  yield* Effect.tryPromise({
    try: () => Bun.write(file, cleanedContent),
    catch: (error) => new FileWriteError({ path: file, cause: error }),
  })

  yield* Console.log(`✅ Removed .fixme() from ${specId}`)

  // Run ONLY the specific test using Playwright (E2E tests)
  yield* Console.log(`🧪 Running E2E test: ${specId}`)

  const testResult = yield* Effect.tryPromise({
    try: async () => {
      // Use bunx playwright test for E2E tests (not bun test which is for unit tests)
      const proc = await $`bunx playwright test ${file} --grep ${testName}`.nothrow().quiet()
      return {
        exitCode: proc.exitCode,
        stdout: proc.stdout.toString(),
        stderr: proc.stderr.toString(),
      }
    },
    catch: (error) => new TestExecutionError({ specId, cause: error }),
  })

  // Playwright exit codes: 0 = all passed, 1 = some failed
  const passed = testResult.exitCode === 0 ? 1 : 0
  const failed = testResult.exitCode === 0 ? 0 : 1

  // Include original content in result for potential restoration
  const validationResult: ValidationResult = { passed, failed, originalContent: content }

  yield* Console.log(`📊 Pre-validation results for ${specId}: ${passed} passed, ${failed} failed`)

  // Write results to output file
  yield* Effect.tryPromise({
    try: () => Bun.write(output, JSON.stringify(validationResult, null, 2)),
    catch: (error) => new OutputWriteError({ path: output, cause: error }),
  })

  yield* Console.log(`✅ Results written to ${output}`)

  if (failed === 0 && passed > 0) {
    yield* Console.log(`🎉 Spec ${specId} passes without implementation!`)
  } else if (failed > 0) {
    yield* Console.log(`❌ Spec ${specId} failing, implementation needed`)
  } else {
    yield* Console.warn(`⚠️ No tests matched for ${specId}`)
  }
})

Effect.runPromise(program).catch((error) => {
  console.error('Pre-validation failed:', error)
  process.exit(1)
})
