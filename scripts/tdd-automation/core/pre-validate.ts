/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { $ } from 'bun'
import { Effect, Console } from 'effect'

interface ValidationResult {
  passed: number
  failed: number
}

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
    catch: (error) => new Error(`Failed to read file: ${error}`),
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
    catch: (error) => new Error(`Failed to write file: ${error}`),
  })

  yield* Console.log(`✅ Removed .fixme() from ${specId}`)

  // Run ONLY the specific test using --grep
  yield* Console.log(`🧪 Running test: ${specId}`)

  const testResult = yield* Effect.tryPromise({
    try: async () => {
      const proc = await $`bun test ${file} --grep ${testName} --reporter=json`.nothrow().quiet()
      return {
        exitCode: proc.exitCode,
        stdout: proc.stdout.toString(),
        stderr: proc.stderr.toString(),
      }
    },
    catch: (error) => new Error(`Failed to run tests: ${error}`),
  })

  // Parse test results
  let passed = 0
  let failed = 0

  try {
    const lines = testResult.stdout.split('\n').filter((line) => line.trim())
    for (const line of lines) {
      try {
        const result = JSON.parse(line)
        if (result.kind === 'test-result') {
          if (result.status === 'pass') {
            passed++
          } else if (result.status === 'fail') {
            failed++
          }
        }
      } catch {
        // Ignore lines that aren't JSON
      }
    }
  } catch (error) {
    yield* Console.error(`Failed to parse test results: ${error}`)
  }

  const validationResult: ValidationResult = { passed, failed }

  yield* Console.log(`📊 Pre-validation results for ${specId}: ${passed} passed, ${failed} failed`)

  // Write results to output file
  yield* Effect.tryPromise({
    try: () => Bun.write(output, JSON.stringify(validationResult, null, 2)),
    catch: (error) => new Error(`Failed to write output file: ${error}`),
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
