/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find Excluded Specs CLI Entry Point
 *
 * CLI script called by pr-creator.yml workflow to find specs that should
 * be excluded from TDD automation (those with manual-intervention PRs).
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/pr-creator/find-excluded-specs.ts
 *
 * Output (JSON):
 *   {
 *     "excludedSpecs": ["APP-001", "APP-002"],
 *     "count": 2,
 *     "excludedList": "APP-001,APP-002"
 *   }
 */

import { Effect, Console } from 'effect'
import { LiveLayer } from '../../layers/live'
import { GitHubApi } from '../../services/github-api'

interface ExcludedSpecsResult {
  readonly excludedSpecs: readonly string[]
  readonly count: number
  /** Comma-separated list for easy YAML consumption */
  readonly excludedList: string
}

/**
 * Extract spec ID from branch name
 *
 * Branch format: tdd/<spec-id> (lowercase)
 * Returns the spec ID in uppercase
 */
function extractSpecIdFromBranch(branch: string): string | null {
  const match = branch.match(/^tdd\/(.+)$/i)
  if (match && match[1]) {
    return match[1].toUpperCase()
  }
  return null
}

const main = Effect.gen(function* () {
  const github = yield* GitHubApi

  yield* Console.error('🔍 Finding excluded specs (manual-intervention PRs)...')

  // Get all TDD PRs
  const prs = yield* github.listTDDPRs()

  // Filter to only those with manual-intervention label
  const manualInterventionPRs = prs.filter((pr) => pr.hasManualInterventionLabel)

  // Extract spec IDs from branch names
  const excludedSpecs = manualInterventionPRs
    .map((pr) => extractSpecIdFromBranch(pr.branch))
    .filter((specId): specId is string => specId !== null)

  yield* Console.error(`📋 Found ${excludedSpecs.length} excluded spec(s)`)
  for (const specId of excludedSpecs) {
    yield* Console.error(`   - ${specId}`)
  }

  const result: ExcludedSpecsResult = {
    excludedSpecs,
    count: excludedSpecs.length,
    excludedList: excludedSpecs.join(','),
  }

  yield* Console.log(JSON.stringify(result))
}).pipe(
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      yield* Console.log(
        JSON.stringify({
          excludedSpecs: [],
          count: 0,
          excludedList: '',
          error: error.message,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
