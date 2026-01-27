/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Detect Change Type CLI Entry Point
 *
 * CLI script called by test.yml workflow to detect test-only changes.
 * Analyzes changed files to determine if CI can be reduced (test-only fast path).
 *
 * Usage:
 *   BASE_REF=main \
 *   HAS_TDD_LABEL=true \
 *   PR_BODY="Closes #123" \
 *   bun run scripts/tdd-automation/workflows/test/detect-change-type.ts
 *
 * Output (JSON):
 *   {
 *     "isTestOnly": false,
 *     "targetSpec": "",
 *     "isTDDAutomation": false,
 *     "changedFiles": ["src/index.ts", "specs/app.spec.ts"],
 *     "significantChanges": 45
 *   }
 */

import { Effect, Console } from 'effect'

interface ChangeTypeResult {
  readonly isTestOnly: boolean
  readonly targetSpec: string
  readonly isTDDAutomation: boolean
  readonly changedFiles: readonly string[]
  readonly significantChanges: number
}

/**
 * Execute a shell command and return stdout
 */
function execCommand(command: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(['sh', '-c', command], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`Command failed: ${command}\n${stderr}`)
      }
      return stdout.trim()
    },
    catch: (error) => new Error(`Failed to execute command: ${error}`),
  })
}

/**
 * Extract target spec from linked issue
 */
function extractTargetSpecFromIssue(prBody: string, ghToken: string): Effect.Effect<string, never> {
  return Effect.gen(function* () {
    // Extract issue number from "Closes #123"
    const issueMatch = prBody.match(/Closes #(\d+)/i)
    if (!issueMatch) {
      return ''
    }

    const issueNumber = issueMatch[1]

    // Fetch issue body using gh CLI
    const issueBody = yield* execCommand(
      `GH_TOKEN=${ghToken} gh issue view ${issueNumber} --json body --jq '.body' 2>/dev/null || echo ""`
    ).pipe(Effect.catchAll(() => Effect.succeed('')))

    if (!issueBody) {
      return ''
    }

    // Try to extract spec file from issue body
    // Pattern: **Test File**: `specs/path/file.spec.ts`
    const testFileMatch = issueBody.match(/\*\*(?:Test File|File)\*\*:\s*`([^`]+)`/)
    if (testFileMatch && testFileMatch[1]) {
      return testFileMatch[1]
    }

    // Fallback: find any spec file path
    const specMatch = issueBody.match(/specs\/[^\s:]+\.spec\.ts/)
    if (specMatch && specMatch[0]) {
      return specMatch[0]
    }

    return ''
  })
}

/**
 * Get changed files between base and HEAD
 */
function getChangedFiles(baseRef: string): Effect.Effect<readonly string[], never> {
  return execCommand(`git diff --name-only origin/${baseRef}...HEAD`).pipe(
    Effect.map((output) =>
      output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    ),
    Effect.catchAll(() => Effect.succeed([] as readonly string[]))
  )
}

/**
 * Count significant changes in spec files (non-.fixme() changes)
 */
function countSignificantChanges(baseRef: string): Effect.Effect<number, never> {
  return Effect.gen(function* () {
    const diffOutput = yield* execCommand(`git diff origin/${baseRef}...HEAD -- specs/`).pipe(
      Effect.catchAll(() => Effect.succeed(''))
    )

    if (!diffOutput) {
      return 0
    }

    // Filter out non-significant lines:
    // - Lines starting with +++ or ---  (file headers)
    // - Lines containing .fixme( or .skip(
    // - Empty lines (just + or -)
    const lines = diffOutput.split('\n')
    let significantCount = 0

    for (const line of lines) {
      // Must be a diff line (starts with + or -)
      if (!line.startsWith('+') && !line.startsWith('-')) {
        continue
      }

      // Skip file headers (+++ or ---)
      if (line.startsWith('+++') || line.startsWith('---')) {
        continue
      }

      // Skip .fixme() and .skip() changes
      if (line.includes('.fixme(') || line.includes('.skip(')) {
        continue
      }

      // Skip empty changes (just whitespace after +/-)
      if (line.slice(1).trim() === '') {
        continue
      }

      significantCount++
    }

    return significantCount
  })
}

const main = Effect.gen(function* () {
  const baseRef = process.env['BASE_REF'] ?? 'main'
  const hasTDDLabel = process.env['HAS_TDD_LABEL'] === 'true'
  const prBody = process.env['PR_BODY'] ?? ''
  const ghToken = process.env['GH_TOKEN'] ?? ''

  let isTDDAutomation = false
  let targetSpec = ''
  let isTestOnly = false

  // Check if this is a TDD automation PR
  if (hasTDDLabel) {
    isTDDAutomation = true
    yield* Console.error('🤖 TDD automation PR detected')

    // Extract target spec from linked issue
    if (ghToken) {
      targetSpec = yield* extractTargetSpecFromIssue(prBody, ghToken)
      if (targetSpec) {
        yield* Console.error(`🎯 Target spec: ${targetSpec}`)
      }
    }
  }

  // Get changed files
  const changedFiles = yield* getChangedFiles(baseRef)
  yield* Console.error(`🔍 Changed files: ${changedFiles.length}`)

  // Check if ALL changed files are in specs/ directory
  const nonSpecFiles = changedFiles.filter((file) => !file.startsWith('specs/'))

  if (nonSpecFiles.length === 0 && changedFiles.length > 0) {
    yield* Console.error('✅ Only spec files changed')

    // Count significant changes (non-.fixme() changes)
    const significantChanges = yield* countSignificantChanges(baseRef)
    yield* Console.error(`📊 Significant changes: ${significantChanges} lines`)

    // If less than 10 significant lines, consider it test-only
    if (significantChanges < 10) {
      isTestOnly = true
      yield* Console.error('✅ Test-only change detected (primarily .fixme() removal)')
    } else {
      yield* Console.error('ℹ️ Spec files changed with significant modifications')
    }
  } else if (nonSpecFiles.length > 0) {
    yield* Console.error(`ℹ️ Non-spec files changed: ${nonSpecFiles.slice(0, 10).join(', ')}`)
  }

  const result: ChangeTypeResult = {
    isTestOnly,
    targetSpec,
    isTDDAutomation,
    changedFiles,
    significantChanges: isTestOnly ? 0 : changedFiles.length,
  }

  yield* Console.error('')
  yield* Console.error('📋 Detection Results:')
  yield* Console.error(`  is_test_only=${isTestOnly}`)
  yield* Console.error(`  target_spec=${targetSpec}`)
  yield* Console.error(`  is_tdd_automation=${isTDDAutomation}`)

  // Output JSON (on stdout for YAML to parse)
  yield* Console.log(JSON.stringify(result))
})

Effect.runPromise(main).catch((error) => {
  console.error(`::error::${error}`)
  console.log(
    JSON.stringify({
      isTestOnly: false,
      targetSpec: '',
      isTDDAutomation: false,
      changedFiles: [],
      significantChanges: 0,
      error: String(error),
    })
  )
})
