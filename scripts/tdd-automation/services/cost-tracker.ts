/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const COST_PATTERN = /\*\*Cost\*\*\s*\|\s*\$(\d+(?:\.\d+)?)/

export function extractCostFromComment(body: string): number | null {
  if (!body.includes('Claude Code Execution Report')) {
    return null
  }

  const match = body.match(COST_PATTERN)
  if (match?.[1]) {
    const cost = parseFloat(match[1])
    if (!isNaN(cost)) {
      return cost
    }
  }
  return null
}
