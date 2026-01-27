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

/**
 * TDD Automation Labels
 */
export const TDD_LABELS = {
  /** Main TDD automation label */
  AUTOMATION: 'tdd-automation',
  /** Manual intervention required (after 5 failures) */
  MANUAL_INTERVENTION: 'tdd-automation:manual-intervention',
  /** Had a merge conflict that was resolved */
  HAD_CONFLICT: 'tdd-automation:had-conflict',
} as const

/**
 * Default configuration
 */
export const TDD_CONFIG = {
  /** Maximum attempts before manual intervention */
  MAX_ATTEMPTS: 5,
  /** Daily credit limit in dollars */
  DAILY_LIMIT: 100,
  /** Weekly credit limit in dollars */
  WEEKLY_LIMIT: 500,
  /** Warning threshold percentage (80%) */
  WARNING_THRESHOLD: 0.8,
  /** Fallback cost per run when parsing fails */
  FALLBACK_COST_PER_RUN: 15,
} as const

/**
 * Branch naming pattern: tdd/<spec-id>
 */
export function getTDDBranchName(specId: string): string {
  return `tdd/${specId.toLowerCase()}`
}

/**
 * PR title format: [TDD] Implement <spec-id> | Attempt X/5
 */
export function formatTDDPRTitle(
  specId: string,
  attempt: number,
  maxAttempts: number = TDD_CONFIG.MAX_ATTEMPTS
): string {
  return `[TDD] Implement ${specId} | Attempt ${attempt}/${maxAttempts}`
}
