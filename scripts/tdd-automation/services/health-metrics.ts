/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import { GitHubAPIClient } from './github-api-client'
import { STATE_LABELS, type SpecState, type RetryCategory } from './label-state-machine'
import { TimeUtils } from './time-utils'
import type { CommandService } from '../../lib/effect'

// =============================================================================
// Types
// =============================================================================

/**
 * Queue metrics snapshot
 */
export interface QueueMetrics {
  /** Number of specs waiting to be processed */
  readonly queuedCount: number

  /** Number of specs currently being processed */
  readonly inProgressCount: number

  /** Number of specs completed successfully */
  readonly completedCount: number

  /** Number of specs that failed */
  readonly failedCount: number

  /** Number of specs in retry state */
  readonly retryCount: number

  /** Breakdown of retry counts by category */
  readonly retryByCategory: {
    readonly spec: number
    readonly infra: number
  }

  /** Total active specs (queued + in-progress) */
  readonly activeCount: number

  /** Timestamp of snapshot (ISO format) */
  readonly timestamp: string
}

/**
 * Workflow run metrics
 */
export interface WorkflowMetrics {
  /** Total recent workflow runs */
  readonly totalRuns: number

  /** Number of failed/cancelled runs */
  readonly failedRuns: number

  /** Failure rate as percentage (0-100) */
  readonly failureRate: number

  /** Time window in hours */
  readonly windowHours: number

  /** Timestamp of analysis (ISO format) */
  readonly timestamp: string
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  /** Whether circuit is open (queue disabled) */
  readonly isOpen: boolean

  /** Reason for current state */
  readonly reason: string

  /** When circuit was opened (ISO timestamp, null if closed) */
  readonly openedAt: string | null

  /** Current failure rate when checked */
  readonly failureRate: number

  /** Current retry count when checked */
  readonly retryCount: number
}

/**
 * Health status levels
 */
export type HealthLevel = 'healthy' | 'degraded' | 'critical'

/**
 * Overall health assessment
 */
export interface HealthAssessment {
  /** Health level */
  readonly level: HealthLevel

  /** Human-readable summary */
  readonly summary: string

  /** Detailed issues found */
  readonly issues: readonly string[]

  /** Queue metrics snapshot */
  readonly queueMetrics: QueueMetrics

  /** Workflow metrics snapshot */
  readonly workflowMetrics: WorkflowMetrics

  /** Circuit breaker state */
  readonly circuitBreaker: CircuitBreakerState

  /** Timestamp of assessment (ISO format) */
  readonly timestamp: string
}

/**
 * Health thresholds configuration
 */
export interface HealthThresholds {
  /** Failure rate to trigger circuit breaker (percentage) */
  readonly failureRateThreshold: number

  /** Minimum samples before evaluating failure rate */
  readonly minSamples: number

  /** Retry percentage threshold (relative to queue size) */
  readonly retryPercentageThreshold: number

  /** Minimum retry issues before alerting */
  readonly minRetryIssues: number

  /** Stuck spec timeout in minutes */
  readonly stuckSpecMinutes: number

  /** Stale lock timeout in minutes */
  readonly staleLockMinutes: number
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when health check operation fails
 */
export class HealthCheckError extends Error {
  readonly _tag = 'HealthCheckError' as const

  constructor(
    readonly operation: string,
    override readonly message: string,
    override readonly cause?: unknown
  ) {
    super(`Health check error in ${operation}: ${message}`)
    this.name = 'HealthCheckError'
  }
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default health thresholds
 */
export const DEFAULT_THRESHOLDS: HealthThresholds = {
  failureRateThreshold: 50, // 50%
  minSamples: 5,
  retryPercentageThreshold: 20, // 20% of queue
  minRetryIssues: 5,
  stuckSpecMinutes: 90,
  staleLockMinutes: 60,
}

/**
 * Workflow run window in hours for metrics
 */
export const WORKFLOW_WINDOW_HOURS = 24

/**
 * Circuit breaker label
 */
export const CIRCUIT_BREAKER_LABEL = 'tdd-queue:disabled'

// =============================================================================
// Service Interface
// =============================================================================

/**
 * HealthMetrics service for monitoring TDD queue health.
 *
 * Provides utilities for:
 * - Queue metrics collection
 * - Workflow failure rate calculation
 * - Circuit breaker state management
 * - Overall health assessment
 */
export interface HealthMetrics {
  // =========================================================================
  // Queue Metrics
  // =========================================================================

  /**
   * Get current queue metrics.
   *
   * @returns Queue metrics snapshot
   */
  readonly getQueueMetrics: () => Effect.Effect<
    QueueMetrics,
    HealthCheckError,
    CommandService | GitHubAPIClient | TimeUtils
  >

  /**
   * Count issues by state.
   *
   * @param state - Spec state to count
   * @returns Issue count
   */
  readonly countByState: (
    state: SpecState
  ) => Effect.Effect<number, HealthCheckError, CommandService | GitHubAPIClient>

  /**
   * Count issues in retry state.
   *
   * @param category - Optional retry category filter
   * @returns Retry issue count
   */
  readonly countRetryIssues: (
    category?: RetryCategory
  ) => Effect.Effect<number, HealthCheckError, CommandService | GitHubAPIClient>

  // =========================================================================
  // Workflow Metrics
  // =========================================================================

  /**
   * Get workflow run metrics.
   *
   * @param windowHours - Time window in hours (default: 24)
   * @returns Workflow metrics snapshot
   */
  readonly getWorkflowMetrics: (
    windowHours?: number
  ) => Effect.Effect<
    WorkflowMetrics,
    HealthCheckError,
    CommandService | GitHubAPIClient | TimeUtils
  >

  /**
   * Calculate failure rate from recent runs.
   *
   * @param windowHours - Time window in hours
   * @returns Failure rate percentage (0-100)
   */
  readonly calculateFailureRate: (
    windowHours?: number
  ) => Effect.Effect<number, HealthCheckError, CommandService | GitHubAPIClient | TimeUtils>

  // =========================================================================
  // Circuit Breaker
  // =========================================================================

  /**
   * Check circuit breaker state.
   *
   * @returns Circuit breaker state
   */
  readonly getCircuitBreakerState: () => Effect.Effect<
    CircuitBreakerState,
    HealthCheckError,
    CommandService | GitHubAPIClient | TimeUtils
  >

  /**
   * Check if queue should be disabled based on health.
   *
   * @param thresholds - Health thresholds (optional)
   * @returns true if circuit should open
   */
  readonly shouldOpenCircuit: (
    thresholds?: HealthThresholds
  ) => Effect.Effect<boolean, HealthCheckError, CommandService | GitHubAPIClient | TimeUtils>

  /**
   * Check if circuit can be closed (health recovered).
   *
   * @param thresholds - Health thresholds (optional)
   * @returns true if circuit can close
   */
  readonly canCloseCircuit: (
    thresholds?: HealthThresholds
  ) => Effect.Effect<boolean, HealthCheckError, CommandService | GitHubAPIClient | TimeUtils>

  // =========================================================================
  // Health Assessment
  // =========================================================================

  /**
   * Get comprehensive health assessment.
   *
   * @param thresholds - Health thresholds (optional)
   * @returns Health assessment
   */
  readonly assessHealth: (
    thresholds?: HealthThresholds
  ) => Effect.Effect<
    HealthAssessment,
    HealthCheckError,
    CommandService | GitHubAPIClient | TimeUtils
  >

  /**
   * Determine health level from metrics.
   *
   * @param queueMetrics - Queue metrics
   * @param workflowMetrics - Workflow metrics
   * @param thresholds - Health thresholds
   * @returns Health level
   */
  readonly determineHealthLevel: (
    queueMetrics: QueueMetrics,
    workflowMetrics: WorkflowMetrics,
    thresholds?: HealthThresholds
  ) => HealthLevel

  /**
   * Get health issues from metrics.
   *
   * @param queueMetrics - Queue metrics
   * @param workflowMetrics - Workflow metrics
   * @param thresholds - Health thresholds
   * @returns List of issues
   */
  readonly getHealthIssues: (
    queueMetrics: QueueMetrics,
    workflowMetrics: WorkflowMetrics,
    thresholds?: HealthThresholds
  ) => readonly string[]
}

// =============================================================================
// Service Tag
// =============================================================================

export const HealthMetrics = Context.GenericTag<HealthMetrics>('HealthMetrics')

// =============================================================================
// Pure Helper Functions
// =============================================================================

/**
 * Calculate failure rate percentage.
 */
export const calculateFailureRatePercentage = (failed: number, total: number): number => {
  if (total === 0) return 0
  return Math.round((failed * 100) / total)
}

/**
 * Calculate retry threshold based on queue size.
 */
export const calculateRetryThreshold = (
  queueSize: number,
  percentage: number,
  minThreshold: number
): number => {
  const calculated = Math.floor(queueSize * (percentage / 100))
  return Math.max(calculated, minThreshold)
}

/**
 * Determine if failure rate exceeds threshold.
 */
export const isFailureRateCritical = (
  failureRate: number,
  totalSamples: number,
  thresholds: HealthThresholds
): boolean => {
  if (totalSamples < thresholds.minSamples) return false
  return failureRate > thresholds.failureRateThreshold
}

/**
 * Determine if retry count exceeds threshold.
 */
export const isRetryCountCritical = (
  retryCount: number,
  queueSize: number,
  thresholds: HealthThresholds
): boolean => {
  const threshold = calculateRetryThreshold(
    queueSize,
    thresholds.retryPercentageThreshold,
    thresholds.minRetryIssues
  )
  return retryCount >= threshold
}

/**
 * Determine health level from metrics.
 */
export const determineHealthLevelFromMetrics = (
  queueMetrics: QueueMetrics,
  workflowMetrics: WorkflowMetrics,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS
): HealthLevel => {
  // Critical if failure rate exceeds threshold
  if (isFailureRateCritical(workflowMetrics.failureRate, workflowMetrics.totalRuns, thresholds)) {
    return 'critical'
  }

  // Critical if retry count exceeds threshold
  if (isRetryCountCritical(queueMetrics.retryCount, queueMetrics.queuedCount, thresholds)) {
    return 'critical'
  }

  // Degraded if significant retry activity
  if (queueMetrics.retryCount > 0 && queueMetrics.retryCount >= thresholds.minRetryIssues / 2) {
    return 'degraded'
  }

  // Degraded if moderate failure rate
  if (workflowMetrics.failureRate > thresholds.failureRateThreshold / 2) {
    return 'degraded'
  }

  return 'healthy'
}

/**
 * Get list of health issues from metrics.
 */
export const getHealthIssuesFromMetrics = (
  queueMetrics: QueueMetrics,
  workflowMetrics: WorkflowMetrics,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS
): readonly string[] => {
  const issues: string[] = []

  // Check failure rate
  if (isFailureRateCritical(workflowMetrics.failureRate, workflowMetrics.totalRuns, thresholds)) {
    issues.push(
      `High failure rate: ${workflowMetrics.failureRate}% (threshold: ${thresholds.failureRateThreshold}%)`
    )
  } else if (workflowMetrics.failureRate > thresholds.failureRateThreshold / 2) {
    issues.push(`Elevated failure rate: ${workflowMetrics.failureRate}%`)
  }

  // Check retry count
  const retryThreshold = calculateRetryThreshold(
    queueMetrics.queuedCount,
    thresholds.retryPercentageThreshold,
    thresholds.minRetryIssues
  )
  if (queueMetrics.retryCount >= retryThreshold) {
    issues.push(
      `High retry count: ${queueMetrics.retryCount} issues in retry (threshold: ${retryThreshold})`
    )
  }

  // Check infrastructure vs spec retries
  if (queueMetrics.retryByCategory.infra > queueMetrics.retryByCategory.spec * 2) {
    issues.push(
      `Infrastructure issues dominant: ${queueMetrics.retryByCategory.infra} infra vs ${queueMetrics.retryByCategory.spec} spec retries`
    )
  }

  // Check queue stagnation
  if (queueMetrics.queuedCount > 0 && queueMetrics.inProgressCount === 0) {
    issues.push('Queue stagnation: specs queued but none in progress')
  }

  return issues
}

/**
 * Build health summary.
 */
export const buildHealthSummary = (
  level: HealthLevel,
  queueMetrics: QueueMetrics,
  workflowMetrics: WorkflowMetrics
): string => {
  const statusEmoji = level === 'healthy' ? '✅' : level === 'degraded' ? '⚠️' : '🚨'

  return (
    `${statusEmoji} ${level.toUpperCase()}: ` +
    `${queueMetrics.activeCount} active specs ` +
    `(${queueMetrics.queuedCount} queued, ${queueMetrics.inProgressCount} in-progress), ` +
    `${workflowMetrics.failureRate}% failure rate`
  )
}

// =============================================================================
// Service Implementation
// =============================================================================

const healthMetricsImpl: HealthMetrics = {
  // =========================================================================
  // Queue Metrics
  // =========================================================================

  getQueueMetrics: () =>
    Effect.gen(function* () {
      const timeUtils = yield* TimeUtils

      const [queuedCount, inProgressCount, completedCount, failedCount, specRetries, infraRetries] =
        yield* Effect.all([
          healthMetricsImpl.countByState('queued'),
          healthMetricsImpl.countByState('in-progress'),
          healthMetricsImpl.countByState('completed'),
          healthMetricsImpl.countByState('failed'),
          healthMetricsImpl.countRetryIssues('spec'),
          healthMetricsImpl.countRetryIssues('infra'),
        ])

      const timestamp = yield* timeUtils.getCurrentISOTimestamp()

      return {
        queuedCount,
        inProgressCount,
        completedCount,
        failedCount,
        retryCount: specRetries + infraRetries,
        retryByCategory: {
          spec: specRetries,
          infra: infraRetries,
        },
        activeCount: queuedCount + inProgressCount,
        timestamp,
      }
    }),

  countByState: (state) =>
    Effect.gen(function* () {
      const client = yield* GitHubAPIClient

      const label = STATE_LABELS[state]

      const issues = yield* client
        .listIssues({ labels: [label] })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new HealthCheckError('countByState', `Failed to list issues: ${error}`, error)
            )
          )
        )

      return issues.length
    }),

  countRetryIssues: (category) =>
    Effect.gen(function* () {
      const client = yield* GitHubAPIClient

      // We need to search for issues with any retry label
      // Since we can't do a prefix match, we'll search for each level
      const levels = [1, 2, 3]
      const categories: RetryCategory[] = category ? [category] : ['spec', 'infra']

      let totalCount = 0

      for (const cat of categories) {
        for (const level of levels) {
          const label = `retry:${cat}:${level}`
          const issues = yield* client
            .listIssues({ labels: [label] })
            .pipe(Effect.catchAll(() => Effect.succeed([])))
          totalCount += issues.length
        }
      }

      return totalCount
    }),

  // =========================================================================
  // Workflow Metrics
  // =========================================================================

  getWorkflowMetrics: (windowHours = WORKFLOW_WINDOW_HOURS) =>
    Effect.gen(function* () {
      const timeUtils = yield* TimeUtils
      const client = yield* GitHubAPIClient

      // Get recent workflow runs
      const runs = yield* client
        .listWorkflowRuns({ workflow: 'TDD - Execute (Claude Code)' })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new HealthCheckError(
                'getWorkflowMetrics',
                `Failed to list workflow runs: ${error}`,
                error
              )
            )
          )
        )

      const totalRuns = runs.length
      const failedRuns = runs.filter(
        (run) => run.conclusion === 'failure' || run.conclusion === 'cancelled'
      ).length

      const failureRate = calculateFailureRatePercentage(failedRuns, totalRuns)
      const timestamp = yield* timeUtils.getCurrentISOTimestamp()

      return {
        totalRuns,
        failedRuns,
        failureRate,
        windowHours,
        timestamp,
      }
    }),

  calculateFailureRate: (windowHours = WORKFLOW_WINDOW_HOURS) =>
    Effect.gen(function* () {
      const metrics = yield* healthMetricsImpl.getWorkflowMetrics(windowHours)
      return metrics.failureRate
    }),

  // =========================================================================
  // Circuit Breaker
  // =========================================================================

  getCircuitBreakerState: () =>
    Effect.gen(function* () {
      const client = yield* GitHubAPIClient

      // Check if circuit breaker issue exists and is open
      const issues = yield* client
        .listIssues({ labels: [CIRCUIT_BREAKER_LABEL] })
        .pipe(Effect.catchAll(() => Effect.succeed([])))

      const isOpen = issues.length > 0
      const circuitIssue = issues[0]

      // Get current metrics for context
      const [workflowMetrics, retryCount] = yield* Effect.all([
        healthMetricsImpl.getWorkflowMetrics().pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              totalRuns: 0,
              failedRuns: 0,
              failureRate: 0,
              windowHours: WORKFLOW_WINDOW_HOURS,
              timestamp: new Date().toISOString(),
            })
          )
        ),
        healthMetricsImpl.countRetryIssues().pipe(Effect.catchAll(() => Effect.succeed(0))),
      ])

      return {
        isOpen,
        reason: isOpen
          ? `Circuit breaker issue #${circuitIssue?.number} is open`
          : 'Circuit is closed (queue active)',
        openedAt: isOpen ? (circuitIssue?.createdAt ?? null) : null,
        failureRate: workflowMetrics.failureRate,
        retryCount,
      }
    }),

  shouldOpenCircuit: (thresholds = DEFAULT_THRESHOLDS) =>
    Effect.gen(function* () {
      const [queueMetrics, workflowMetrics] = yield* Effect.all([
        healthMetricsImpl.getQueueMetrics(),
        healthMetricsImpl.getWorkflowMetrics(),
      ])

      // Check failure rate threshold
      if (
        isFailureRateCritical(workflowMetrics.failureRate, workflowMetrics.totalRuns, thresholds)
      ) {
        return true
      }

      // Check retry count threshold
      if (isRetryCountCritical(queueMetrics.retryCount, queueMetrics.queuedCount, thresholds)) {
        return true
      }

      return false
    }),

  canCloseCircuit: (thresholds = DEFAULT_THRESHOLDS) =>
    Effect.gen(function* () {
      const [queueMetrics, workflowMetrics] = yield* Effect.all([
        healthMetricsImpl.getQueueMetrics(),
        healthMetricsImpl.getWorkflowMetrics(),
      ])

      // Can close if failure rate is below half the threshold
      const failureRateOk =
        workflowMetrics.failureRate <= thresholds.failureRateThreshold / 2 ||
        workflowMetrics.totalRuns < thresholds.minSamples

      // Can close if retry count is below half the threshold
      const retryThreshold = calculateRetryThreshold(
        queueMetrics.queuedCount,
        thresholds.retryPercentageThreshold,
        thresholds.minRetryIssues
      )
      const retryCountOk = queueMetrics.retryCount < retryThreshold / 2

      return failureRateOk && retryCountOk
    }),

  // =========================================================================
  // Health Assessment
  // =========================================================================

  assessHealth: (thresholds = DEFAULT_THRESHOLDS) =>
    Effect.gen(function* () {
      const timeUtils = yield* TimeUtils

      const [queueMetrics, workflowMetrics, circuitBreaker] = yield* Effect.all([
        healthMetricsImpl.getQueueMetrics(),
        healthMetricsImpl.getWorkflowMetrics(),
        healthMetricsImpl.getCircuitBreakerState(),
      ])

      const level = determineHealthLevelFromMetrics(queueMetrics, workflowMetrics, thresholds)
      const issues = getHealthIssuesFromMetrics(queueMetrics, workflowMetrics, thresholds)
      const summary = buildHealthSummary(level, queueMetrics, workflowMetrics)

      const timestamp = yield* timeUtils.getCurrentISOTimestamp()

      return {
        level,
        summary,
        issues,
        queueMetrics,
        workflowMetrics,
        circuitBreaker,
        timestamp,
      }
    }),

  determineHealthLevel: (queueMetrics, workflowMetrics, thresholds = DEFAULT_THRESHOLDS) =>
    determineHealthLevelFromMetrics(queueMetrics, workflowMetrics, thresholds),

  getHealthIssues: (queueMetrics, workflowMetrics, thresholds = DEFAULT_THRESHOLDS) =>
    getHealthIssuesFromMetrics(queueMetrics, workflowMetrics, thresholds),
}

// =============================================================================
// Layer
// =============================================================================

export const HealthMetricsLive = Layer.succeed(HealthMetrics, HealthMetrics.of(healthMetricsImpl))
