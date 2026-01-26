/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import {
  LabelStateMachine,
  type RetryCategory,
  type FailureType,
  MAX_RETRIES,
} from './label-state-machine'
import { TimeUtils } from './time-utils'
import type { ErrorClassification } from './error-classifier'
import type { GitHubAPIClient } from './github-api-client'
import type { CommandService } from '../../lib/effect/CommandService'

// =============================================================================
// Types
// =============================================================================

/**
 * Retry decision result
 */
export interface RetryDecision {
  /** Whether to retry */
  readonly shouldRetry: boolean

  /** Category of retry (spec or infra) */
  readonly category: RetryCategory | null

  /** New retry count (1-3) */
  readonly newRetryCount: number

  /** Delay before retry in seconds */
  readonly delaySeconds: number

  /** Reason for decision */
  readonly reason: string

  /** Whether max retries reached */
  readonly maxRetriesReached: boolean
}

/**
 * Cooldown check result
 */
export interface CooldownStatus {
  /** Whether currently in cooldown */
  readonly isInCooldown: boolean

  /** Minutes remaining in cooldown (0 if not in cooldown) */
  readonly remainingMinutes: number

  /** When cooldown expires (ISO timestamp, null if not in cooldown) */
  readonly expiresAt: string | null

  /** Source of cooldown (last activity timestamp) */
  readonly lastActivityAt: string | null
}

/**
 * Backoff configuration
 */
export interface BackoffConfig {
  /** Base delay in seconds */
  readonly baseDelaySeconds: number

  /** Maximum delay in seconds */
  readonly maxDelaySeconds: number

  /** Whether to add jitter */
  readonly useJitter: boolean

  /** Jitter range as fraction of delay (0-1) */
  readonly jitterFraction: number
}

/**
 * Retry context for decision making
 */
export interface RetryContext {
  /** Issue number */
  readonly issueNumber: number

  /** Error classification from error-classifier */
  readonly errorClassification: ErrorClassification

  /** Current spec retry count */
  readonly specRetryCount: number

  /** Current infra retry count */
  readonly infraRetryCount: number

  /** Timestamp of last activity (ISO format) */
  readonly lastActivityAt?: string
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when retry operation fails
 */
export class RetryOperationError extends Error {
  readonly _tag = 'RetryOperationError' as const

  constructor(
    readonly operation: string,
    override readonly message: string,
    override readonly cause?: unknown
  ) {
    super(`Retry operation error in ${operation}: ${message}`)
    this.name = 'RetryOperationError'
  }
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default backoff configuration
 */
export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  baseDelaySeconds: 60,
  maxDelaySeconds: 300,
  useJitter: true,
  jitterFraction: 0.25,
}

/**
 * Standard cooldown periods in minutes
 */
export const COOLDOWN_PERIODS = {
  /** Standard cooldown for automated retries */
  standard: 30,
  /** Extended cooldown for failed PR fix attempts */
  failedPR: 90,
  /** Short cooldown for infra errors */
  infraError: 10,
  /** Minimum time before escalating stuck spec */
  stuckEscalation: 15,
} as const

// =============================================================================
// Service Interface
// =============================================================================

/**
 * RetryManager service for managing retry logic with exponential backoff.
 *
 * Provides utilities for:
 * - Retry decision making based on error type and current count
 * - Exponential backoff calculation with jitter
 * - Cooldown period management
 * - Retry label tracking
 */
export interface RetryManager {
  // =========================================================================
  // Retry Decisions
  // =========================================================================

  /**
   * Determine whether to retry based on error and current state.
   *
   * @param context - Retry context with error classification and counts
   * @returns Retry decision
   */
  readonly shouldRetry: (context: RetryContext) => Effect.Effect<RetryDecision, RetryOperationError>

  /**
   * Get retry category from error classification.
   *
   * @param errorClassification - Error classification result
   * @returns Retry category (spec or infra)
   */
  readonly getRetryCategory: (errorClassification: ErrorClassification) => RetryCategory

  /**
   * Check if retry is allowed based on retry count.
   *
   * @param category - Retry category
   * @param currentCount - Current retry count
   * @returns true if more retries allowed
   */
  readonly canRetry: (category: RetryCategory, currentCount: number) => boolean

  // =========================================================================
  // Backoff Calculation
  // =========================================================================

  /**
   * Calculate delay for next retry using exponential backoff.
   *
   * @param retryCount - Current retry count (1-based)
   * @param config - Backoff configuration (optional)
   * @returns Delay in seconds
   */
  readonly calculateBackoffDelay: (retryCount: number, config?: BackoffConfig) => number

  /**
   * Add jitter to a delay value.
   *
   * @param delaySeconds - Base delay in seconds
   * @param jitterFraction - Jitter range as fraction (0-1)
   * @returns Delay with jitter added
   */
  readonly addJitter: (delaySeconds: number, jitterFraction?: number) => number

  // =========================================================================
  // Cooldown Management
  // =========================================================================

  /**
   * Check if an issue is in cooldown period.
   *
   * @param lastActivityAt - Timestamp of last activity (ISO format)
   * @param cooldownMinutes - Cooldown period in minutes
   * @returns Cooldown status
   */
  readonly checkCooldown: (
    lastActivityAt: string,
    cooldownMinutes?: number
  ) => Effect.Effect<CooldownStatus, RetryOperationError, TimeUtils>

  /**
   * Check if standard cooldown applies (30 min).
   *
   * @param lastActivityAt - Timestamp of last activity (ISO format)
   * @returns true if in cooldown
   */
  readonly isInStandardCooldown: (
    lastActivityAt: string
  ) => Effect.Effect<boolean, RetryOperationError, TimeUtils>

  /**
   * Check if failed PR cooldown applies (90 min).
   *
   * @param lastActivityAt - Timestamp of last activity (ISO format)
   * @returns true if in cooldown
   */
  readonly isInFailedPRCooldown: (
    lastActivityAt: string
  ) => Effect.Effect<boolean, RetryOperationError, TimeUtils>

  // =========================================================================
  // Retry Execution
  // =========================================================================

  /**
   * Execute retry for an issue (increment retry count, transition to queued).
   *
   * @param issueNumber - Issue number
   * @param category - Retry category
   * @returns New retry count
   */
  readonly executeRetry: (
    issueNumber: number,
    category: RetryCategory
  ) => Effect.Effect<
    number,
    RetryOperationError,
    CommandService | GitHubAPIClient | LabelStateMachine
  >

  /**
   * Mark issue as failed (max retries reached).
   *
   * @param issueNumber - Issue number
   * @param failureType - Type of failure
   */
  readonly markAsFailed: (
    issueNumber: number,
    failureType: FailureType
  ) => Effect.Effect<
    void,
    RetryOperationError,
    CommandService | GitHubAPIClient | LabelStateMachine
  >
}

// =============================================================================
// Service Tag
// =============================================================================

export const RetryManager = Context.GenericTag<RetryManager>('RetryManager')

// =============================================================================
// Pure Helper Functions
// =============================================================================

/**
 * Calculate exponential backoff delay.
 * Formula: min(baseDelay * 2^(retryCount-1), maxDelay)
 */
export const calculateExponentialBackoff = (
  retryCount: number,
  baseDelaySeconds: number,
  maxDelaySeconds: number
): number => {
  if (retryCount <= 0) return baseDelaySeconds

  // 2^(retryCount-1) gives: 1, 2, 4, 8, ...
  const multiplier = Math.pow(2, retryCount - 1)
  const delay = baseDelaySeconds * multiplier

  return Math.min(delay, maxDelaySeconds)
}

/**
 * Add random jitter to delay to avoid thundering herd.
 * Adds 0 to (delay * jitterFraction) seconds.
 */
export const addRandomJitter = (delaySeconds: number, jitterFraction: number): number => {
  const jitterRange = delaySeconds * jitterFraction
  const jitter = Math.random() * jitterRange
  return Math.round(delaySeconds + jitter)
}

/**
 * Determine retry category from error classification.
 */
export const getRetryCategoryFromError = (
  errorClassification: ErrorClassification
): RetryCategory => {
  if (errorClassification.isInfrastructure) {
    return 'infra'
  }
  return 'spec'
}

/**
 * Check if retry count is below maximum.
 */
export const isRetryAllowed = (currentCount: number): boolean => {
  return currentCount < MAX_RETRIES
}

/**
 * Build retry decision.
 */
export const buildRetryDecision = (
  shouldRetry: boolean,
  category: RetryCategory | null,
  newRetryCount: number,
  delaySeconds: number,
  reason: string
): RetryDecision => ({
  shouldRetry,
  category,
  newRetryCount,
  delaySeconds,
  reason,
  maxRetriesReached: newRetryCount >= MAX_RETRIES,
})

/**
 * Calculate remaining cooldown minutes.
 */
export const calculateRemainingCooldown = (ageMinutes: number, cooldownMinutes: number): number => {
  const remaining = cooldownMinutes - ageMinutes
  return Math.max(0, Math.ceil(remaining))
}

// =============================================================================
// Service Implementation
// =============================================================================

const retryManagerImpl: RetryManager = {
  // =========================================================================
  // Retry Decisions
  // =========================================================================

  shouldRetry: (context) =>
    Effect.sync(() => {
      const { errorClassification, specRetryCount, infraRetryCount } = context

      // Non-retryable errors
      if (!errorClassification.isRetryable) {
        return buildRetryDecision(false, null, 0, 0, 'Error is not retryable')
      }

      // Determine category
      const category = getRetryCategoryFromError(errorClassification)
      const currentCount = category === 'spec' ? specRetryCount : infraRetryCount

      // Check if max retries reached
      if (!isRetryAllowed(currentCount)) {
        return buildRetryDecision(
          false,
          category,
          currentCount,
          0,
          `Max retries reached for ${category} errors (${currentCount}/${MAX_RETRIES})`
        )
      }

      // Calculate next retry count and delay
      const newCount = currentCount + 1
      const baseDelay = calculateExponentialBackoff(
        newCount,
        DEFAULT_BACKOFF_CONFIG.baseDelaySeconds,
        DEFAULT_BACKOFF_CONFIG.maxDelaySeconds
      )
      const delay = DEFAULT_BACKOFF_CONFIG.useJitter
        ? addRandomJitter(baseDelay, DEFAULT_BACKOFF_CONFIG.jitterFraction)
        : baseDelay

      return buildRetryDecision(
        true,
        category,
        newCount,
        delay,
        `Retry ${newCount}/${MAX_RETRIES} for ${category} error: ${errorClassification.errorType}`
      )
    }),

  getRetryCategory: (errorClassification) => getRetryCategoryFromError(errorClassification),

  canRetry: (category, currentCount) => isRetryAllowed(currentCount),

  // =========================================================================
  // Backoff Calculation
  // =========================================================================

  calculateBackoffDelay: (retryCount, config = DEFAULT_BACKOFF_CONFIG) => {
    const baseDelay = calculateExponentialBackoff(
      retryCount,
      config.baseDelaySeconds,
      config.maxDelaySeconds
    )

    if (config.useJitter) {
      return addRandomJitter(baseDelay, config.jitterFraction)
    }

    return baseDelay
  },

  addJitter: (delaySeconds, jitterFraction = DEFAULT_BACKOFF_CONFIG.jitterFraction) => {
    return addRandomJitter(delaySeconds, jitterFraction)
  },

  // =========================================================================
  // Cooldown Management
  // =========================================================================

  checkCooldown: (lastActivityAt, cooldownMinutes = COOLDOWN_PERIODS.standard) =>
    Effect.gen(function* () {
      const timeUtils = yield* TimeUtils

      const ageResult = yield* timeUtils
        .getAgeMinutes(lastActivityAt)
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new RetryOperationError('checkCooldown', `Failed to parse timestamp: ${error}`, error)
            )
          )
        )

      const isInCooldown = ageResult < cooldownMinutes
      const remainingMinutes = calculateRemainingCooldown(ageResult, cooldownMinutes)

      let expiresAt: string | null = null
      if (isInCooldown) {
        const expiresDate = new Date(
          new Date(lastActivityAt).getTime() + cooldownMinutes * 60 * 1000
        )
        expiresAt = expiresDate.toISOString()
      }

      return {
        isInCooldown,
        remainingMinutes,
        expiresAt,
        lastActivityAt,
      }
    }),

  isInStandardCooldown: (lastActivityAt) =>
    Effect.gen(function* () {
      const status = yield* retryManagerImpl.checkCooldown(
        lastActivityAt,
        COOLDOWN_PERIODS.standard
      )
      return status.isInCooldown
    }),

  isInFailedPRCooldown: (lastActivityAt) =>
    Effect.gen(function* () {
      const status = yield* retryManagerImpl.checkCooldown(
        lastActivityAt,
        COOLDOWN_PERIODS.failedPR
      )
      return status.isInCooldown
    }),

  // =========================================================================
  // Retry Execution
  // =========================================================================

  executeRetry: (issueNumber, category) =>
    Effect.gen(function* () {
      const sm = yield* LabelStateMachine

      // Increment retry count
      const newCount = yield* sm
        .incrementRetry(issueNumber, category)
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new RetryOperationError(
                'executeRetry',
                `Failed to increment retry count: ${error}`,
                error
              )
            )
          )
        )

      // Transition to queued for retry
      yield* sm
        .transitionTo(issueNumber, 'queued')
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new RetryOperationError(
                'executeRetry',
                `Failed to transition to queued: ${error}`,
                error
              )
            )
          )
        )

      return newCount
    }),

  markAsFailed: (issueNumber, failureType) =>
    Effect.gen(function* () {
      const sm = yield* LabelStateMachine

      // Set failure type
      yield* sm
        .setFailureType(issueNumber, failureType)
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new RetryOperationError('markAsFailed', `Failed to set failure type: ${error}`, error)
            )
          )
        )

      // Transition to failed
      yield* sm
        .transitionTo(issueNumber, 'failed')
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new RetryOperationError(
                'markAsFailed',
                `Failed to transition to failed: ${error}`,
                error
              )
            )
          )
        )
    }),
}

// =============================================================================
// Layer
// =============================================================================

export const RetryManagerLive = Layer.succeed(RetryManager, RetryManager.of(retryManagerImpl))
