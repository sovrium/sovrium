/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Parse TDD PR Title
 *
 * Extracts spec ID and attempt count from PR title format:
 * [TDD] Implement <spec-id> | Attempt X/5
 *
 * Usage:
 *   bun run scripts/tdd-automation/core/parse-pr-title.ts "[TDD] Implement APP-VERSION-001 | Attempt 2/5"
 *
 * Output (JSON):
 *   { "specId": "APP-VERSION-001", "attempt": 2, "maxAttempts": 5 }
 */

import type { TDDPRTitle } from './types'

/**
 * Regular expression to match TDD PR title format
 *
 * Format: [TDD] Implement <spec-id> | Attempt X/Y
 * Examples:
 *   - [TDD] Implement APP-VERSION-001 | Attempt 1/5
 *   - [TDD] Implement API-HEALTH-002 | Attempt 3/5
 *   - [TDD] Implement MIG-ERROR-REGRESSION | Attempt 5/5
 */
const TDD_TITLE_REGEX =
  /^\[TDD\]\s+Implement\s+([A-Z]+-[A-Z-]+-(?:\d{3}|REGRESSION))\s*\|\s*Attempt\s+(\d+)\/(\d+)$/i

/**
 * Parse a TDD PR title to extract spec ID and attempt information
 *
 * @param title PR title string
 * @returns Parsed title info or null if not a valid TDD PR title
 */
export function parseTDDPRTitle(title: string): TDDPRTitle | null {
  const match = title.match(TDD_TITLE_REGEX)

  if (!match) {
    return null
  }

  const [, specId, attemptStr, maxAttemptsStr] = match

  if (!specId || !attemptStr || !maxAttemptsStr) {
    return null
  }

  return {
    specId: specId.toUpperCase(),
    attempt: parseInt(attemptStr, 10),
    maxAttempts: parseInt(maxAttemptsStr, 10),
  }
}

/**
 * Check if a PR title matches the TDD automation format
 *
 * @param title PR title string
 * @returns true if the title matches TDD format
 */
export function isTDDPRTitle(title: string): boolean {
  return TDD_TITLE_REGEX.test(title)
}

/**
 * Extract spec ID from TDD branch name
 *
 * Branch format: tdd/<spec-id>
 * Example: tdd/app-version-001 → APP-VERSION-001
 *
 * @param branchName Branch name
 * @returns Spec ID or null if not a TDD branch
 */
export function extractSpecIdFromBranch(branchName: string): string | null {
  const match = branchName.match(/^tdd\/(.+)$/i)

  if (!match || !match[1]) {
    return null
  }

  return match[1].toUpperCase()
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: bun run parse-pr-title.ts "<PR title>"')
    console.error(
      'Example: bun run parse-pr-title.ts "[TDD] Implement APP-VERSION-001 | Attempt 2/5"'
    )
    process.exit(1)
  }

  const title = args[0]!
  const parsed = parseTDDPRTitle(title)

  if (!parsed) {
    console.error(`Error: Invalid TDD PR title format: "${title}"`)
    console.error('Expected format: [TDD] Implement <spec-id> | Attempt X/Y')
    process.exit(1)
  }

  // Output as JSON for easy parsing by workflows
  console.log(JSON.stringify(parsed))
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
}
