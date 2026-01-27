/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Update TDD PR Title
 *
 * Increments the attempt counter in a TDD PR title.
 *
 * Usage:
 *   bun run scripts/tdd-automation/core/update-pr-title.ts <pr-number>
 *
 * Environment:
 *   - GITHUB_REPOSITORY: owner/repo (e.g., "owner/sovrium")
 *   - GH_TOKEN or GITHUB_TOKEN: GitHub API token
 *
 * Output:
 *   New PR title and attempt count
 */

import { Effect, Console } from 'effect'
import { GitHubApi, GitHubApiLive } from '../services/github-api'
import { parseTDDPRTitle } from './parse-pr-title'
import { formatTDDPRTitle } from './types'
import type { GitHubApiError } from './errors'

/**
 * Error for invalid PR title format
 */
class InvalidPRTitleError {
  readonly _tag = 'InvalidPRTitleError'
  constructor(
    readonly prNumber: number,
    readonly title: string
  ) {}
}

/**
 * Increment attempt count in PR title
 *
 * Effect program that:
 * 1. Fetches current PR title
 * 2. Parses the TDD title format
 * 3. Increments attempt count
 * 4. Updates PR with new title
 *
 * @param prNumber PR number to update
 * @returns Object with new title and attempt count
 */
export const incrementAttempt = (prNumber: number) =>
  Effect.gen(function* () {
    const githubApi = yield* GitHubApi

    // Fetch current PR
    const pr = yield* githubApi.getPR(prNumber)

    // Parse current title
    const parsed = parseTDDPRTitle(pr.title)

    if (!parsed) {
      return yield* Effect.fail(new InvalidPRTitleError(prNumber, pr.title))
    }

    // Increment attempt
    const newAttempt = parsed.attempt + 1

    // Create new title
    const newTitle = formatTDDPRTitle(parsed.specId, newAttempt, parsed.maxAttempts)

    // Update PR
    yield* githubApi.updatePRTitle(prNumber, newTitle)

    yield* Console.error(`✅ Updated PR #${prNumber} title:`)
    yield* Console.error(`   Old: ${pr.title}`)
    yield* Console.error(`   New: ${newTitle}`)

    return {
      newTitle,
      newAttempt,
      specId: parsed.specId,
    }
  })

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: bun run update-pr-title.ts <pr-number>')
    console.error('Example: bun run update-pr-title.ts 123')
    console.error('')
    console.error('Environment variables required:')
    console.error('  GITHUB_REPOSITORY: owner/repo')
    console.error('  GH_TOKEN or GITHUB_TOKEN: GitHub API token')
    process.exit(1)
  }

  const prNumber = parseInt(args[0]!, 10)

  if (isNaN(prNumber) || prNumber <= 0) {
    console.error(`Error: Invalid PR number: ${args[0]}`)
    process.exit(1)
  }

  const program = incrementAttempt(prNumber).pipe(
    Effect.catchTag('InvalidPRTitleError', (error) =>
      Effect.gen(function* () {
        yield* Console.error(
          `PR #${error.prNumber} does not have a valid TDD title format: "${error.title}"`
        )
        return yield* Effect.fail(error)
      })
    ),
    Effect.catchTag('GitHubApiError', (error: GitHubApiError) =>
      Effect.gen(function* () {
        yield* Console.error(`GitHub API error: ${error.operation}`)
        yield* Console.error(String(error.cause))
        return yield* error
      })
    ),
    Effect.provide(GitHubApiLive)
  )

  const result = await Effect.runPromise(
    program.pipe(
      Effect.match({
        onSuccess: (result) => {
          // Output JSON for workflow parsing
          console.log(
            JSON.stringify({
              prNumber,
              specId: result.specId,
              newAttempt: result.newAttempt,
              newTitle: result.newTitle,
            })
          )
        },
        onFailure: (error) => {
          console.error('Error:', error instanceof Error ? error.message : error)
          process.exit(1)
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
    process.exit(1)
  })
}
