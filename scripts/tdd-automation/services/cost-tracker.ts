/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cost Tracker Service
 *
 * Effect service for parsing costs from Claude Code workflow logs.
 * Used by check-credit-limits program to enforce spending limits.
 */

import { Context, Effect, Layer } from 'effect'
import { CostParsingFailed } from '../core/errors'
import { GitHubApi } from './github-api'
import type { GitHubApiError } from '../core/errors'

/**
 * Cost tracker service interface
 */
export interface CostTrackerService {
  /**
   * Parse cost from workflow run logs
   *
   * Searches for patterns:
   * - "Total cost: $X.XX"
   * - "Cost: $X.XX"
   * - "Session cost: $X.XX"
   *
   * @param runId - GitHub workflow run ID
   * @returns Parsed cost in dollars
   */
  readonly parseCostFromLogs: (
    runId: string
  ) => Effect.Effect<number, CostParsingFailed | GitHubApiError>
}

/**
 * Cost tracker service Context.Tag for dependency injection
 */
export class CostTracker extends Context.Tag('CostTracker')<CostTracker, CostTrackerService>() {}

/**
 * Cost parsing regex patterns (priority order, case-insensitive)
 *
 * Claude Code outputs cost in various formats:
 * - "Total Cost: $12.34" (note: capital C in actual output)
 * - "Cost: $12.34"
 * - "Session Cost: $12.34"
 */
const COST_PATTERNS = [
  /Total cost: \$(\d+(?:\.\d+)?)/i,
  /Cost: \$(\d+(?:\.\d+)?)/i,
  /Session cost: \$(\d+(?:\.\d+)?)/i,
]

/**
 * Parse cost value from log text using multiple patterns
 */
function extractCostFromText(text: string): number | null {
  for (const pattern of COST_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const cost = parseFloat(match[1])
      if (!isNaN(cost)) {
        return cost
      }
    }
  }
  return null
}

/**
 * Live implementation that fetches logs from GitHub API
 */
export const CostTrackerLive = Layer.effect(
  CostTracker,
  Effect.gen(function* () {
    const github = yield* GitHubApi

    return {
      parseCostFromLogs: (runId) =>
        Effect.gen(function* () {
          // Fetch logs from GitHub API
          const logs = yield* github.getRunLogs(runId)

          // Extract cost from logs
          const cost = extractCostFromText(logs)

          if (cost === null) {
            return yield* new CostParsingFailed({
              runId,
              rawLog: logs.slice(0, 500), // Include first 500 chars for debugging
            })
          }

          return cost
        }),
    }
  })
)

/**
 * Test implementation that parses cost from provided text directly
 * (for unit testing without GitHub API calls)
 */
export const CostTrackerTest = (mockCost: number) =>
  Layer.succeed(CostTracker, {
    parseCostFromLogs: () => Effect.succeed(mockCost),
  })

/**
 * Test implementation that always fails with CostParsingFailed
 */
export const CostTrackerTestFailing = Layer.succeed(CostTracker, {
  parseCostFromLogs: (runId) =>
    Effect.fail(
      new CostParsingFailed({
        runId,
        rawLog: 'Mock logs with no cost pattern',
      })
    ),
})
