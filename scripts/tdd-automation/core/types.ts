/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation V3 Types
 *
 * V3 uses GitHub PRs as state management instead of JSON state files.
 * These types define the PR-based state model.
 */

// Re-export config for backward compatibility
export { TDD_CONFIG, TDD_LABELS, getTDDBranchName, formatTDDPRTitle } from './config'

/**
 * PR title format: [TDD] Implement <spec-id> | Attempt X/5
 */
export interface TDDPRTitle {
  readonly specId: string
  readonly attempt: number
  readonly maxAttempts: number
}

/**
 * Parsed TDD PR information
 */
export interface TDDPullRequest {
  readonly number: number
  readonly title: string
  readonly branch: string
  readonly specId: string
  readonly attempt: number
  readonly maxAttempts: number
  readonly labels: readonly string[]
  readonly hasManualInterventionLabel: boolean
  readonly hasConflictLabel: boolean
}

/**
 * Result of finding a ready spec
 */
export interface ReadySpec {
  readonly specId: string
  readonly file: string
  readonly line: number
  readonly description: string
  readonly priority: number
}

/**
 * Individual spec item from scanning
 */
export interface SpecItem {
  readonly specId: string
  readonly file: string
  readonly line: number
  readonly description: string
  readonly feature: string
  readonly priority: number
}

/**
 * Result of scanning for fixme specs
 */
export interface QueueScanResult {
  readonly timestamp: string
  readonly totalSpecs: number
  readonly specs: readonly SpecItem[]
}

/**
 * Credit usage tracking
 */
export interface CreditUsage {
  readonly dailySpend: number
  readonly weeklySpend: number
  readonly dailyLimit: number
  readonly weeklyLimit: number
  readonly isAtDailyLimit: boolean
  readonly isAtWeeklyLimit: boolean
  readonly dailyWarning: boolean
  readonly weeklyWarning: boolean
}
