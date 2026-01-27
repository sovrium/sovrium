/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation Error Types
 *
 * Typed error hierarchy for the TDD automation pipeline using Effect's
 * Data.TaggedError pattern for type-safe error handling.
 */

import { Data } from 'effect'

/**
 * Credit limit exceeded error
 *
 * Thrown when daily or weekly spending limits are reached.
 * Used in check-credit-limits program.
 */
export class CreditLimitExceeded extends Data.TaggedError('CreditLimitExceeded')<{
  readonly dailySpend: number
  readonly weeklySpend: number
  readonly limit: 'daily' | 'weekly'
}> {}

/**
 * Cost parsing failed error
 *
 * Thrown when unable to extract cost from workflow logs.
 * Includes raw log for debugging.
 */
export class CostParsingFailed extends Data.TaggedError('CostParsingFailed')<{
  readonly runId: string
  readonly rawLog: string
}> {}

/**
 * Active TDD PR exists error
 *
 * Thrown when attempting to create a new TDD PR while one is already active.
 * TDD automation uses serial processing (1 PR at a time).
 */
export class ActiveTDDPRExists extends Data.TaggedError('ActiveTDDPRExists')<{
  readonly prNumber: number
  readonly specId: string
}> {}

/**
 * No pending specs error
 *
 * Thrown when spec scanner finds no .fixme() tests to process.
 * Normal condition when queue is empty.
 */
export class NoPendingSpecs extends Data.TaggedError('NoPendingSpecs')<{
  readonly message: string
}> {}

/**
 * Merge conflict error
 *
 * Thrown when PR branch has conflicts with main.
 * Used by merge-watchdog workflow.
 */
export class MergeConflict extends Data.TaggedError('MergeConflict')<{
  readonly branch: string
  readonly conflictingFiles: readonly string[]
}> {}

/**
 * Max attempts reached error
 *
 * Thrown when a spec has reached maximum implementation attempts.
 * Triggers manual-intervention label.
 */
export class MaxAttemptsReached extends Data.TaggedError('MaxAttemptsReached')<{
  readonly prNumber: number
  readonly specId: string
  readonly attempts: number
}> {}

/**
 * GitHub API error
 *
 * Thrown when GitHub API operations fail.
 * Wraps underlying cause for debugging.
 */
export class GitHubApiError extends Data.TaggedError('GitHubApiError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

/**
 * Git operation error
 *
 * Thrown when git CLI commands fail.
 * Includes operation and stderr for debugging.
 */
export class GitOperationError extends Data.TaggedError('GitOperationError')<{
  readonly operation: string
  readonly stderr: string
}> {}

/**
 * CSS compilation error (re-export for consistency)
 *
 * Note: This error is defined in infrastructure layer but re-exported
 * here for convenience in TDD automation scripts that may need it.
 */
export class CSSCompilationError extends Data.TaggedError('CSSCompilationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Union type of all TDD automation errors
 */
export type TDDAutomationError =
  | CreditLimitExceeded
  | CostParsingFailed
  | ActiveTDDPRExists
  | NoPendingSpecs
  | MergeConflict
  | MaxAttemptsReached
  | GitHubApiError
  | GitOperationError
