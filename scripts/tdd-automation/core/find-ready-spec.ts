/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find Ready Spec
 *
 * Finds the next highest-priority spec ready for TDD automation.
 * Checks for:
 *   1. Specs with .fixme() marker
 *   2. No existing TDD PR for the spec
 *   3. No other active TDD PR (serial processing)
 *
 * Usage:
 *   bun run scripts/tdd-automation/core/find-ready-spec.ts
 *
 * Environment:
 *   - GITHUB_REPOSITORY: owner/repo
 *   - GH_TOKEN or GITHUB_TOKEN: GitHub API token
 *
 * Output (JSON):
 *   {
 *     "specId": "APP-VERSION-001",
 *     "file": "specs/app/version/version.spec.ts",
 *     "line": 42,
 *     "description": "App version displays correctly",
 *     "priority": 1
 *   }
 *
 * Exit codes:
 *   0: Spec found (JSON output)
 *   1: No spec available (active PR exists or no .fixme() specs)
 *   2: Error occurred
 */

import { Effect, Console, Layer } from 'effect'
import { FileSystemServiceLive, LoggerServiceLive } from '../../lib/effect'
import { GitHubApi, GitHubApiLive } from '../services/github-api'
import { scanForFixmeSpecs } from './spec-scanner'
import type { ReadySpec } from './types'

/**
 * Find the next spec ready for TDD automation
 *
 * Effect program that:
 * 1. Checks for active TDD PRs (serial processing)
 * 2. Scans for .fixme() specs
 * 3. Filters out specs with existing PRs
 * 4. Returns highest priority spec
 */
export const findReadySpec = Effect.gen(function* () {
  const githubApi = yield* GitHubApi

  yield* Console.error('🔍 Finding next ready spec for TDD automation...')
  yield* Console.error('')

  // Step 1: Check for active TDD PRs (serial processing)
  const openPRs = yield* githubApi.listTDDPRs()

  // Filter to active PRs (not in manual intervention)
  const activePRs = openPRs.filter((pr) => !pr.hasManualInterventionLabel)

  if (activePRs.length > 0) {
    const activePR = activePRs[0]!
    yield* Console.error(`⏳ Active TDD PR found: #${activePR.number} (${activePR.specId})`)
    yield* Console.error('   Serial processing: waiting for current PR to complete')
    return null as ReadySpec | null
  }

  // Step 2: Scan for .fixme() specs
  yield* Console.error('📂 Scanning for .fixme() specs...')

  const scanResult = yield* scanForFixmeSpecs

  if (scanResult.specs.length === 0) {
    yield* Console.error('✅ No .fixme() specs found - all tests are passing!')
    return null as ReadySpec | null
  }

  yield* Console.error(`   Found ${scanResult.specs.length} .fixme() specs`)

  // Step 3: Filter out specs that already have PRs (including manual intervention)
  const specIdsWithPRs = new Set(openPRs.map((pr) => pr.specId))
  const availableSpecs = scanResult.specs.filter((spec) => !specIdsWithPRs.has(spec.specId))

  if (availableSpecs.length === 0) {
    yield* Console.error('⏳ All .fixme() specs have open PRs (pending or manual intervention)')
    return null as ReadySpec | null
  }

  yield* Console.error(`   ${availableSpecs.length} specs available (no existing PR)`)

  // Step 4: Return highest priority spec (already sorted by priority)
  const nextSpec = availableSpecs[0]!

  yield* Console.error('')
  yield* Console.error('✅ Next spec to process:')
  yield* Console.error(`   Spec ID: ${nextSpec.specId}`)
  yield* Console.error(`   File: ${nextSpec.file}:${nextSpec.line}`)
  yield* Console.error(`   Description: ${nextSpec.description}`)
  yield* Console.error(`   Priority: ${nextSpec.priority}`)

  return {
    specId: nextSpec.specId,
    file: nextSpec.file,
    line: nextSpec.line,
    description: nextSpec.description,
    priority: nextSpec.priority,
  } as ReadySpec | null
})

/**
 * Layer composition for find-ready-spec program
 */
const FindReadySpecLayer = Layer.mergeAll(GitHubApiLive, FileSystemServiceLive, LoggerServiceLive())

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const program = findReadySpec.pipe(
    Effect.catchTag('GitHubApiError', (error) =>
      Effect.gen(function* () {
        yield* Console.error(`GitHub API error: ${error.operation}`)
        yield* Console.error(String(error.cause))
        return yield* error
      })
    ),
    Effect.provide(FindReadySpecLayer)
  )

  const result = await Effect.runPromise(
    program.pipe(
      Effect.match({
        onSuccess: (spec) => {
          if (!spec) {
            console.error('')
            console.error('No spec ready for processing')
            process.exit(1)
          }
          // Output JSON for workflow parsing
          console.log(JSON.stringify(spec))
        },
        onFailure: (error) => {
          console.error('Error:', error instanceof Error ? error.message : error)
          process.exit(2)
        },
      })
    )
  )

  return result
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Error:', error)
    process.exit(2)
  })
}
