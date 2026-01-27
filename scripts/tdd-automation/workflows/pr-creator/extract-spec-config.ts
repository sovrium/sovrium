/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Extract Spec Config CLI Entry Point
 *
 * CLI script called by pr-creator.yml workflow to extract per-spec
 * configuration annotations from spec files.
 *
 * Supported annotations (in JSDoc comments):
 *   @tdd-max-attempts <number> - Override max retry attempts
 *   @tdd-timeout <number> - Override timeout in minutes
 *
 * Usage:
 *   SPEC_FILE="specs/app.spec.ts" \
 *   bun run scripts/tdd-automation/workflows/pr-creator/extract-spec-config.ts
 *
 * Output (JSON):
 *   {
 *     "maxAttempts": 5,
 *     "timeout": 45,
 *     "specFile": "specs/app.spec.ts"
 *   }
 */

import * as fs from 'node:fs'
import { Effect, Console } from 'effect'
import { TDD_CONFIG } from '../../core/config'

/**
 * Default configuration values
 */
const DEFAULTS = {
  maxAttempts: TDD_CONFIG.MAX_ATTEMPTS,
  timeout: 45, // minutes
} as const

interface SpecConfig {
  readonly maxAttempts: number
  readonly timeout: number
  readonly specFile: string
}

/**
 * Extract a numeric annotation value from file content
 *
 * @param content File content to search
 * @param annotation Annotation name (e.g., 'tdd-max-attempts')
 * @param defaultValue Default value if annotation not found
 * @returns Extracted value or default
 */
function extractAnnotation(content: string, annotation: string, defaultValue: number): number {
  // Pattern: @tdd-max-attempts 10 or @tdd-timeout 60
  // Supports both JSDoc comments and inline comments
  const pattern = new RegExp(`@${annotation}\\s+(\\d+)`, 'i')
  const match = content.match(pattern)

  if (match && match[1]) {
    const value = parseInt(match[1], 10)
    if (!Number.isNaN(value) && value > 0) {
      return value
    }
  }

  return defaultValue
}

/**
 * Read spec file and extract configuration
 */
function extractSpecConfig(specFile: string): Effect.Effect<SpecConfig, Error> {
  return Effect.gen(function* () {
    // Check file exists
    if (!fs.existsSync(specFile)) {
      return yield* Effect.fail(new Error(`Spec file not found: ${specFile}`))
    }

    // Read file content
    const content = yield* Effect.try({
      try: () => fs.readFileSync(specFile, 'utf-8'),
      catch: (error) => new Error(`Failed to read spec file: ${error}`),
    })

    // Extract annotations
    const maxAttempts = extractAnnotation(content, 'tdd-max-attempts', DEFAULTS.maxAttempts)
    const timeout = extractAnnotation(content, 'tdd-timeout', DEFAULTS.timeout)

    return {
      maxAttempts,
      timeout,
      specFile,
    } satisfies SpecConfig
  })
}

const main = Effect.gen(function* () {
  const specFile = process.env['SPEC_FILE']

  if (!specFile) {
    yield* Console.error('::error::SPEC_FILE environment variable is required')
    yield* Console.log(
      JSON.stringify({
        maxAttempts: DEFAULTS.maxAttempts,
        timeout: DEFAULTS.timeout,
        specFile: '',
        error: 'SPEC_FILE environment variable is required',
      })
    )
    return
  }

  yield* Console.error(`📄 Extracting config from: ${specFile}`)

  const config = yield* extractSpecConfig(specFile)

  yield* Console.error('')
  yield* Console.error('📊 Spec Configuration:')
  yield* Console.error(`  Max attempts: ${config.maxAttempts}`)
  yield* Console.error(`  Timeout: ${config.timeout} minutes`)

  yield* Console.log(JSON.stringify(config))
})

Effect.runPromise(main).catch((error) => {
  console.error(`::error::${error}`)
  console.log(
    JSON.stringify({
      maxAttempts: DEFAULTS.maxAttempts,
      timeout: DEFAULTS.timeout,
      specFile: '',
      error: String(error),
    })
  )
})
