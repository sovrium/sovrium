/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find Excluded Specs CLI Entry Point
 *
 * CLI script called by pr-creator.yml workflow to identify spec files that should
 * be blocked from TDD automation (those with manual-intervention PRs).
 *
 * File-Based Blocking Logic:
 * - Spec IDs follow pattern: <PREFIX>-<NUMBER> (e.g., API-TABLES-001)
 * - File prefix is everything before the final number (e.g., API-TABLES)
 * - When a spec has a manual-intervention PR, its entire file is blocked
 * - This prevents cascading failures where multiple specs from the same file fail for the same reason
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/pr-creator/find-excluded-specs.ts
 *
 * Output (JSON):
 *   {
 *     "blockedFiles": ["API-TABLES", "API-USERS"],
 *     "blockedSpecs": ["API-TABLES-001", "API-USERS-002"],
 *     "count": 2,
 *     "excludedList": "API-TABLES,API-USERS"
 *   }
 */

import { Effect, Console } from 'effect'
import { LiveLayer } from '../../layers/live'
import { GitHubApi } from '../../services/github-api'

interface BlockedFilesResult {
  /** File prefixes blocked due to manual-intervention PRs */
  readonly blockedFiles: readonly string[]
  /** Individual spec IDs with manual-intervention (for logging) */
  readonly blockedSpecs: readonly string[]
  /** Count of blocked files */
  readonly count: number
  /** Comma-separated list of blocked file prefixes for easy YAML consumption */
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

/**
 * Extract file prefix from spec ID
 *
 * Spec ID format: <PREFIX>-<NUMBER>
 * Returns everything before the final hyphen-number sequence
 *
 * Examples:
 * - API-TABLES-001 → API-TABLES
 * - API-TABLES-RECORDS-001 → API-TABLES-RECORDS
 * - APP-VERSION-001 → APP-VERSION
 */
function extractFilePrefix(specId: string): string | null {
  // Match everything up to the last hyphen-number sequence
  const match = specId.match(/^(.+)-\d+$/i)
  if (match && match[1]) {
    return match[1].toUpperCase()
  }
  return null
}

const main = Effect.gen(function* () {
  const github = yield* GitHubApi

  yield* Console.error('🔍 Finding blocked spec files (manual-intervention PRs)...')

  // Get all TDD PRs
  const prs = yield* github.listTDDPRs()

  // Filter to only those with manual-intervention label
  const manualInterventionPRs = prs.filter((pr) => pr.hasManualInterventionLabel)

  // Extract spec IDs from branch names
  const blockedSpecs = manualInterventionPRs
    .map((pr) => extractSpecIdFromBranch(pr.branch))
    .filter((specId): specId is string => specId !== null)

  // Extract unique file prefixes from spec IDs
  const filePrefixes = blockedSpecs
    .map((specId) => extractFilePrefix(specId))
    .filter((prefix): prefix is string => prefix !== null)

  // Remove duplicates
  const blockedFiles = Array.from(new Set(filePrefixes))

  yield* Console.error(
    `📋 Found ${blockedFiles.length} blocked file(s) from ${blockedSpecs.length} manual-intervention PR(s)`
  )

  if (blockedFiles.length > 0) {
    yield* Console.error('   Blocked files:')
    for (const filePrefix of blockedFiles) {
      const specs = blockedSpecs.filter((spec) => extractFilePrefix(spec) === filePrefix)
      yield* Console.error(`   - ${filePrefix} (specs: ${specs.join(', ')})`)
    }
  }

  const result: BlockedFilesResult = {
    blockedFiles,
    blockedSpecs,
    count: blockedFiles.length,
    excludedList: blockedFiles.join(','),
  }

  // @effect-diagnostics effect/preferSchemaOverJson:off
  yield* Console.log(JSON.stringify(result))
}).pipe(
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          blockedFiles: [],
          blockedSpecs: [],
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
