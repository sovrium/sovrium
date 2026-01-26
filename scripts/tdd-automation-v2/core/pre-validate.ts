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

const program = Effect.gen(function* () {
  // Parse arguments from command line (supports both --arg=value and --arg value)
  let file: string | undefined
  let output: string | undefined

  // Parse --file argument
  const fileArgWithEquals = process.argv.find((arg) => arg.startsWith('--file='))
  if (fileArgWithEquals) {
    file = fileArgWithEquals.split('=')[1]
  } else {
    const fileIndex = process.argv.indexOf('--file')
    if (fileIndex !== -1 && process.argv[fileIndex + 1]) {
      file = process.argv[fileIndex + 1]
    }
  }

  // Parse --output argument
  const outputArgWithEquals = process.argv.find((arg) => arg.startsWith('--output='))
  if (outputArgWithEquals) {
    output = outputArgWithEquals.split('=')[1]
  } else {
    const outputIndex = process.argv.indexOf('--output')
    if (outputIndex !== -1 && process.argv[outputIndex + 1]) {
      output = process.argv[outputIndex + 1]
    }
  }

  if (!file) {
    console.error('Error: --file argument is required')
    process.exit(1)
  }

  if (!output) {
    console.error('Error: --output argument is required')
    process.exit(1)
  }

  yield* Console.log(`🔍 Pre-validating spec file: ${file}`)

  // Remove .fixme() from all tests in the file
  const content = yield* Effect.tryPromise({
    try: () => Bun.file(file).text(),
    catch: (error) => new Error(`Failed to read file: ${error}`),
  })

  const cleanedContent = content.replace(/\.fixme\(\)/g, '')

  yield* Effect.tryPromise({
    try: () => Bun.write(file, cleanedContent),
    catch: (error) => new Error(`Failed to write file: ${error}`),
  })

  yield* Console.log(`✅ Removed .fixme() from ${file}`)

  // Run tests for this file
  yield* Console.log(`🧪 Running tests for ${file}`)

  const testResult = yield* Effect.tryPromise({
    try: async () => {
      const proc = await $`bun test ${file} --reporter=json`.nothrow().quiet()
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

  yield* Console.log(`📊 Pre-validation results: ${passed} passed, ${failed} failed`)

  // Write results to output file
  yield* Effect.tryPromise({
    try: () => Bun.write(output, JSON.stringify(validationResult, null, 2)),
    catch: (error) => new Error(`Failed to write output file: ${error}`),
  })

  yield* Console.log(`✅ Results written to ${output}`)

  if (failed === 0) {
    yield* Console.log(`🎉 All tests pass without implementation!`)
  } else {
    yield* Console.log(`❌ ${failed} test(s) still failing, implementation needed`)
  }
})

Effect.runPromise(program).catch((error) => {
  console.error('Pre-validation failed:', error)
  process.exit(1)
})
