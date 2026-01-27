/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation V3 Scripts
 *
 * V3 uses GitHub PRs as state management instead of JSON state files.
 * This provides serial processing (one spec at a time) with cost protection.
 *
 * Scripts:
 *   - find-ready-spec.ts: Find next highest-priority spec
 *   - parse-pr-title.ts: Parse PR title for spec ID and attempt count
 *   - update-pr-title.ts: Increment attempt counter in PR title
 *   - check-credit-usage.ts: Track daily/weekly credit usage
 *   - types.ts: TypeScript type definitions
 */

// Re-export types
export * from './types'

// Re-export functions
export { findReadySpec } from './find-ready-spec'
export { parseTDDPRTitle, isTDDPRTitle, extractSpecIdFromBranch } from './parse-pr-title'
export { incrementAttempt } from './update-pr-title'
export { checkCreditUsage, extractCostFromLogs } from './check-credit-usage'
