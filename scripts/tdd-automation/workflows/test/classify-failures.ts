/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Classify Failures CLI Entry Point
 *
 * CLI script called by test.yml workflow to classify test failures.
 * Detects infrastructure errors and categorizes failures.
 *
 * Usage:
 *   TEST_RESULTS_DIR=all-test-results \
 *   JSON_RESULTS_DIR=all-json-results \
 *   TARGET_SPEC="specs/app.spec.ts" \
 *   bun run scripts/tdd-automation/workflows/test/classify-failures.ts
 *
 * Output (JSON):
 *   {
 *     "hasRegressions": false,
 *     "regressionSpecs": [],
 *     "targetSpec": "specs/app.spec.ts",
 *     "failedSpecs": ["specs/app.spec.ts"],
 *     "failureType": "target_only",
 *     "infraErrorType": null,
 *     "isInfraError": false
 *   }
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { Effect, Console } from 'effect'

/**
 * Infrastructure error types
 */
type InfraErrorType =
  | 'playwright_browser_missing'
  | 'network_error'
  | 'docker_error'
  | 'resource_exhaustion'
  | 'permission_error'
  | 'browser_context_closed'
  | 'test_timeout'
  | null

/**
 * Failure type classification
 */
type FailureType = 'target_only' | 'regression_only' | 'mixed' | 'infrastructure' | 'unknown'

interface ClassifyResult {
  readonly hasRegressions: boolean
  readonly regressionSpecs: readonly string[]
  readonly targetSpec: string
  readonly failedSpecs: readonly string[]
  readonly failureType: FailureType
  readonly infraErrorType: InfraErrorType
  readonly isInfraError: boolean
}

/**
 * Infrastructure error patterns
 */
const INFRA_ERROR_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp
  readonly type: InfraErrorType
  readonly message: string
}> = [
  {
    pattern: /browserType\.launch|Executable doesn't exist|chrome-headless-shell/,
    type: 'playwright_browser_missing',
    message: 'Playwright browser not installed',
  },
  {
    pattern: /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up/,
    type: 'network_error',
    message: 'Network connectivity issue',
  },
  {
    pattern: /docker.*error|Cannot connect to Docker|docker daemon/i,
    type: 'docker_error',
    message: 'Docker service unavailable',
  },
  {
    pattern: /out of memory|OOM|ENOMEM|killed/i,
    type: 'resource_exhaustion',
    message: 'Resource exhaustion (OOM)',
  },
  {
    pattern: /EPERM|EACCES|Permission denied/,
    type: 'permission_error',
    message: 'Permission denied',
  },
  {
    pattern: /Target page.*closed|Context disposed|Page closed|browser has been closed/,
    type: 'browser_context_closed',
    message: 'Browser context prematurely closed',
  },
  {
    pattern: /Test timeout of \d+ms exceeded/,
    type: 'test_timeout',
    message: 'Test execution timeout',
  },
]

/**
 * Recursively find files matching a pattern in a directory
 */
function findFiles(dir: string, patterns: readonly string[]): readonly string[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const results: string[] = []

  function walkDir(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        walkDir(fullPath)
      } else if (patterns.some((p) => entry.name.endsWith(p) || entry.name.includes(p))) {
        results.push(fullPath)
      }
    }
  }

  walkDir(dir)
  return results
}

/**
 * Read all text content from test result files
 */
function readTestOutput(testResultsDir: string, jsonResultsDir: string): string {
  let output = ''

  // Read from test results directory (txt, log files)
  const textFiles = findFiles(testResultsDir, ['.txt', '.log', 'output'])
  for (const file of textFiles) {
    try {
      output += fs.readFileSync(file, 'utf-8') + '\n'
    } catch {
      // Ignore read errors
    }
  }

  // Read error messages from JSON results
  const jsonFiles = findFiles(jsonResultsDir, ['.json'])
  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8')
      const json = JSON.parse(content)

      // Extract error messages from Playwright JSON format
      const extractErrors = (obj: unknown): void => {
        if (typeof obj !== 'object' || obj === null) return

        if ('error' in obj && typeof obj.error === 'string') {
          output += obj.error + '\n'
        }
        if ('message' in obj && typeof obj.message === 'string') {
          output += obj.message + '\n'
        }

        for (const value of Object.values(obj)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              extractErrors(item)
            }
          } else if (typeof value === 'object') {
            extractErrors(value)
          }
        }
      }

      extractErrors(json)
    } catch {
      // Ignore parse errors
    }
  }

  return output
}

/**
 * Detect infrastructure errors from test output
 */
function detectInfraError(testOutput: string): InfraErrorType {
  for (const { pattern, type } of INFRA_ERROR_PATTERNS) {
    if (pattern.test(testOutput)) {
      return type
    }
  }
  return null
}

/**
 * Extract failed spec files from JSON test results
 */
function extractFailedSpecs(jsonResultsDir: string): readonly string[] {
  const failedSpecs = new Set<string>()

  const jsonFiles = findFiles(jsonResultsDir, ['.json'])

  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8')
      const json = JSON.parse(content)

      // Playwright JSON reporter format
      // Structure: { suites: [{ specs: [{ file, tests: [{ status }] }] }] }
      const extractSpecs = (obj: unknown): void => {
        if (typeof obj !== 'object' || obj === null) return

        // Check if this is a spec with tests
        if ('file' in obj && 'tests' in obj && typeof obj.file === 'string') {
          const { tests } = obj
          if (Array.isArray(tests)) {
            const hasFailed = tests.some((test: unknown) => {
              if (typeof test === 'object' && test !== null && 'status' in test) {
                return test.status !== 'passed' && test.status !== 'skipped'
              }
              return false
            })
            if (hasFailed) {
              failedSpecs.add(obj.file)
            }
          }
        }

        // Recurse into arrays and objects
        for (const value of Object.values(obj)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              extractSpecs(item)
            }
          } else if (typeof value === 'object') {
            extractSpecs(value)
          }
        }
      }

      extractSpecs(json)
    } catch {
      // Ignore parse errors
    }
  }

  return Array.from(failedSpecs).sort()
}

/**
 * Classify the failure type
 */
function classifyFailure(
  targetSpec: string,
  failedSpecs: readonly string[]
): { failureType: FailureType; hasRegressions: boolean; regressionSpecs: readonly string[] } {
  if (failedSpecs.length === 0) {
    return { failureType: 'unknown', hasRegressions: false, regressionSpecs: [] }
  }

  if (!targetSpec) {
    return { failureType: 'unknown', hasRegressions: false, regressionSpecs: [] }
  }

  // Find regression specs (failed specs that are not the target)
  const regressionSpecs = failedSpecs.filter((spec) => spec !== targetSpec)
  const targetFailed = failedSpecs.includes(targetSpec)

  if (regressionSpecs.length > 0) {
    if (targetFailed) {
      return { failureType: 'mixed', hasRegressions: true, regressionSpecs }
    }
    return { failureType: 'regression_only', hasRegressions: true, regressionSpecs }
  }

  if (targetFailed) {
    return { failureType: 'target_only', hasRegressions: false, regressionSpecs: [] }
  }

  return { failureType: 'unknown', hasRegressions: false, regressionSpecs: [] }
}

const main = Effect.gen(function* () {
  const testResultsDir = process.env['TEST_RESULTS_DIR'] ?? 'all-test-results'
  const jsonResultsDir = process.env['JSON_RESULTS_DIR'] ?? 'all-json-results'
  const targetSpec = process.env['TARGET_SPEC'] ?? ''

  yield* Console.error('🔍 Classifying test failures for TDD automation PR...')

  // Read test output for infrastructure error detection
  const testOutput = readTestOutput(testResultsDir, jsonResultsDir)

  // Check for infrastructure errors first
  const infraErrorType = detectInfraError(testOutput)

  if (infraErrorType) {
    yield* Console.error('')
    yield* Console.error('🚨 INFRASTRUCTURE ERROR DETECTED - NOT a code regression!')
    yield* Console.error(`   Error Type: ${infraErrorType}`)
    yield* Console.error('   This failure should be retried, not classified as regression')

    const result: ClassifyResult = {
      hasRegressions: false,
      regressionSpecs: [],
      targetSpec,
      failedSpecs: [],
      failureType: 'infrastructure',
      infraErrorType,
      isInfraError: true,
    }

    yield* Console.log(JSON.stringify(result))
    return
  }

  yield* Console.error(
    '✅ No infrastructure errors detected - proceeding with failure classification'
  )
  yield* Console.error('')

  // Extract failed specs from JSON results
  const failedSpecs = extractFailedSpecs(jsonResultsDir)
  yield* Console.error(
    `❌ Failed specs: ${failedSpecs.length > 0 ? failedSpecs.join(', ') : 'unknown'}`
  )

  // Classify the failure
  const classification = classifyFailure(targetSpec, failedSpecs)

  const result: ClassifyResult = {
    hasRegressions: classification.hasRegressions,
    regressionSpecs: classification.regressionSpecs,
    targetSpec,
    failedSpecs,
    failureType: classification.failureType,
    infraErrorType: null,
    isInfraError: false,
  }

  yield* Console.error('')
  yield* Console.error('📊 Classification Results:')
  yield* Console.error(`  Target spec: ${targetSpec}`)
  yield* Console.error(`  Failed specs: ${failedSpecs.join(', ') || 'none'}`)
  yield* Console.error(`  Has regressions: ${classification.hasRegressions}`)
  yield* Console.error(`  Regression specs: ${classification.regressionSpecs.join(', ') || 'none'}`)
  yield* Console.error(`  Failure type: ${classification.failureType}`)

  yield* Console.log(JSON.stringify(result))
})

Effect.runPromise(main).catch((error) => {
  console.error(`::error::${error}`)
  console.log(
    JSON.stringify({
      hasRegressions: false,
      regressionSpecs: [],
      targetSpec: '',
      failedSpecs: [],
      failureType: 'unknown',
      infraErrorType: null,
      isInfraError: false,
      error: String(error),
    })
  )
})
