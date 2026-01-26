/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import { GitHubAPIClient } from './github-api-client'
import type { CommandService } from '../../lib/effect/CommandService'

// =============================================================================
// Types
// =============================================================================

/**
 * TDD Spec lifecycle states
 */
export type SpecState = 'queued' | 'in-progress' | 'completed' | 'failed'

/**
 * Labels corresponding to each state
 */
export const STATE_LABELS: Record<SpecState, string> = {
  queued: 'tdd-spec:queued',
  'in-progress': 'tdd-spec:in-progress',
  completed: 'tdd-spec:completed',
  failed: 'tdd-spec:failed',
} as const

/**
 * All valid state labels
 */
export const ALL_STATE_LABELS = Object.values(STATE_LABELS)

/**
 * Retry label categories
 */
export type RetryCategory = 'spec' | 'infra'

/**
 * Maximum retry count per category
 */
export const MAX_RETRIES = 3

/**
 * Retry label pattern: retry:{category}:{count}
 */
export const RETRY_LABEL_PREFIX = 'retry:'

/**
 * Failure classification labels
 */
export type FailureType = 'spec' | 'regression' | 'infra'

export const FAILURE_LABELS: Record<FailureType, string> = {
  spec: 'failure:spec',
  regression: 'failure:regression',
  infra: 'failure:infra',
} as const

/**
 * Result of a state transition attempt
 */
export interface StateTransitionResult {
  /** Whether the transition was successful */
  readonly success: boolean

  /** The new state after transition (or current state if failed) */
  readonly newState: SpecState

  /** Labels that were added */
  readonly labelsAdded: ReadonlyArray<string>

  /** Labels that were removed */
  readonly labelsRemoved: ReadonlyArray<string>

  /** Error message if transition failed */
  readonly error?: string
}

/**
 * Current state analysis of an issue
 */
export interface IssueStateInfo {
  /** Current spec state (or null if no state label) */
  readonly currentState: SpecState | null

  /** Current retry count for spec errors */
  readonly specRetryCount: number

  /** Current retry count for infrastructure errors */
  readonly infraRetryCount: number

  /** Current failure type (if any) */
  readonly failureType: FailureType | null

  /** All TDD-related labels on the issue */
  readonly tddLabels: ReadonlyArray<string>
}

/**
 * Valid state transitions
 */
export interface StateTransition {
  readonly from: SpecState
  readonly to: SpecState
  readonly description: string
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when state transition is invalid
 */
export class InvalidStateTransitionError extends Error {
  readonly _tag = 'InvalidStateTransitionError' as const

  constructor(
    readonly fromState: SpecState | null,
    readonly toState: SpecState,
    readonly reason: string
  ) {
    super(`Invalid state transition from '${fromState ?? 'none'}' to '${toState}': ${reason}`)
    this.name = 'InvalidStateTransitionError'
  }
}

/**
 * Error when label operation fails
 */
export class LabelOperationError extends Error {
  readonly _tag = 'LabelOperationError' as const

  constructor(
    readonly operation: 'add' | 'remove',
    readonly label: string,
    readonly issueNumber: number,
    override readonly cause?: unknown
  ) {
    super(`Failed to ${operation} label '${label}' on issue #${issueNumber}`)
    this.name = 'LabelOperationError'
  }
}

// =============================================================================
// Constants - Valid Transitions
// =============================================================================

/**
 * All valid state transitions in the TDD spec lifecycle
 */
export const VALID_TRANSITIONS: ReadonlyArray<StateTransition> = [
  // Normal flow
  { from: 'queued', to: 'in-progress', description: 'Spec picked up for processing' },
  { from: 'in-progress', to: 'completed', description: 'Spec successfully implemented' },
  { from: 'in-progress', to: 'failed', description: 'Spec failed after max retries' },

  // Retry flow
  { from: 'in-progress', to: 'queued', description: 'Spec queued for retry' },

  // Recovery flow (stuck specs)
  { from: 'in-progress', to: 'queued', description: 'Stuck spec reset to queue' },

  // Re-queue failed (manual intervention)
  { from: 'failed', to: 'queued', description: 'Failed spec manually re-queued' },
]

// =============================================================================
// Service Interface
// =============================================================================

/**
 * LabelStateMachine service for managing TDD spec lifecycle states.
 *
 * Provides utilities for:
 * - State transitions (with validation)
 * - Retry label management
 * - Failure classification
 * - State analysis
 */
export interface LabelStateMachine {
  // =========================================================================
  // State Analysis
  // =========================================================================

  /**
   * Analyze current state of an issue from its labels.
   *
   * @param issueNumber - Issue to analyze
   * @returns Current state info
   */
  readonly getIssueState: (
    issueNumber: number
  ) => Effect.Effect<IssueStateInfo, LabelOperationError, CommandService | GitHubAPIClient>

  /**
   * Check if a state transition is valid.
   *
   * @param from - Current state (null if no state label)
   * @param to - Target state
   * @returns true if transition is valid
   */
  readonly isValidTransition: (from: SpecState | null, to: SpecState) => boolean

  // =========================================================================
  // State Transitions
  // =========================================================================

  /**
   * Transition an issue to a new state.
   * Removes old state label, adds new state label.
   *
   * @param issueNumber - Issue to transition
   * @param toState - Target state
   * @returns Transition result
   */
  readonly transitionTo: (
    issueNumber: number,
    toState: SpecState
  ) => Effect.Effect<
    StateTransitionResult,
    InvalidStateTransitionError | LabelOperationError,
    CommandService | GitHubAPIClient
  >

  /**
   * Force transition (bypasses validation).
   * Use for administrative/recovery operations only.
   *
   * @param issueNumber - Issue to transition
   * @param toState - Target state
   * @returns Transition result
   */
  readonly forceTransitionTo: (
    issueNumber: number,
    toState: SpecState
  ) => Effect.Effect<StateTransitionResult, LabelOperationError, CommandService | GitHubAPIClient>

  // =========================================================================
  // Retry Management
  // =========================================================================

  /**
   * Increment retry count for a category.
   * Returns new retry count.
   *
   * @param issueNumber - Issue number
   * @param category - Retry category (spec or infra)
   * @returns New retry count (1-3)
   */
  readonly incrementRetry: (
    issueNumber: number,
    category: RetryCategory
  ) => Effect.Effect<number, LabelOperationError, CommandService | GitHubAPIClient>

  /**
   * Check if max retries reached for a category.
   *
   * @param issueNumber - Issue number
   * @param category - Retry category
   * @returns true if max retries reached
   */
  readonly hasMaxRetries: (
    issueNumber: number,
    category: RetryCategory
  ) => Effect.Effect<boolean, LabelOperationError, CommandService | GitHubAPIClient>

  /**
   * Clear all retry labels from an issue.
   *
   * @param issueNumber - Issue number
   */
  readonly clearRetryLabels: (
    issueNumber: number
  ) => Effect.Effect<void, LabelOperationError, CommandService | GitHubAPIClient>

  // =========================================================================
  // Failure Classification
  // =========================================================================

  /**
   * Set failure type label on an issue.
   * Removes any existing failure labels first.
   *
   * @param issueNumber - Issue number
   * @param failureType - Type of failure
   */
  readonly setFailureType: (
    issueNumber: number,
    failureType: FailureType
  ) => Effect.Effect<void, LabelOperationError, CommandService | GitHubAPIClient>

  /**
   * Clear failure type label from an issue.
   *
   * @param issueNumber - Issue number
   */
  readonly clearFailureType: (
    issueNumber: number
  ) => Effect.Effect<void, LabelOperationError, CommandService | GitHubAPIClient>

  // =========================================================================
  // Label Utilities
  // =========================================================================

  /**
   * Add a label to an issue.
   *
   * @param issueNumber - Issue number
   * @param label - Label to add
   */
  readonly addLabel: (
    issueNumber: number,
    label: string
  ) => Effect.Effect<void, LabelOperationError, CommandService | GitHubAPIClient>

  /**
   * Remove a label from an issue.
   *
   * @param issueNumber - Issue number
   * @param label - Label to remove
   */
  readonly removeLabel: (
    issueNumber: number,
    label: string
  ) => Effect.Effect<void, LabelOperationError, CommandService | GitHubAPIClient>

  /**
   * Clear all TDD-related labels from an issue.
   * Useful for complete reset.
   *
   * @param issueNumber - Issue number
   */
  readonly clearAllTddLabels: (
    issueNumber: number
  ) => Effect.Effect<void, LabelOperationError, CommandService | GitHubAPIClient>
}

// =============================================================================
// Service Tag
// =============================================================================

export const LabelStateMachine = Context.GenericTag<LabelStateMachine>('LabelStateMachine')

// =============================================================================
// Pure Helper Functions
// =============================================================================

/**
 * Get the state label for a given state
 */
export const getStateLabel = (state: SpecState): string => STATE_LABELS[state]

/**
 * Parse a state from a label string
 */
export const parseStateFromLabel = (label: string): SpecState | null => {
  for (const [state, stateLabel] of Object.entries(STATE_LABELS)) {
    if (label === stateLabel) {
      return state as SpecState
    }
  }
  return null
}

/**
 * Build a retry label
 */
export const buildRetryLabel = (category: RetryCategory, count: number): string => {
  return `${RETRY_LABEL_PREFIX}${category}:${count}`
}

/**
 * Parse a retry label
 */
export const parseRetryLabel = (
  label: string
): { category: RetryCategory; count: number } | null => {
  const match = /^retry:(spec|infra):(\d+)$/.exec(label)
  if (!match || !match[1] || !match[2]) {
    return null
  }
  return {
    category: match[1] as RetryCategory,
    count: parseInt(match[2], 10),
  }
}

/**
 * Get the failure label for a failure type
 */
export const getFailureLabel = (failureType: FailureType): string => FAILURE_LABELS[failureType]

/**
 * Parse a failure type from a label
 */
export const parseFailureFromLabel = (label: string): FailureType | null => {
  for (const [type, failureLabel] of Object.entries(FAILURE_LABELS)) {
    if (label === failureLabel) {
      return type as FailureType
    }
  }
  return null
}

/**
 * Check if a label is a TDD-related label
 */
export const isTddLabel = (label: string): boolean => {
  // State labels
  if (ALL_STATE_LABELS.includes(label)) return true

  // Retry labels
  if (label.startsWith(RETRY_LABEL_PREFIX)) return true

  // Failure labels
  if (Object.values(FAILURE_LABELS).includes(label)) return true

  // Other TDD labels
  if (label === 'tdd-automation') return true

  return false
}

/**
 * Check if a transition from one state to another is valid
 */
export const isTransitionValid = (from: SpecState | null, to: SpecState): boolean => {
  // Starting fresh (no current state) - only queued is valid
  if (from === null) {
    return to === 'queued'
  }

  // Check against valid transitions
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to)
}

/**
 * Analyze labels to extract state info
 */
export const analyzeLabels = (labels: ReadonlyArray<string>): IssueStateInfo => {
  let currentState: SpecState | null = null
  let specRetryCount = 0
  let infraRetryCount = 0
  let failureType: FailureType | null = null
  const tddLabels: string[] = []

  for (const label of labels) {
    if (!isTddLabel(label)) continue
    tddLabels.push(label)

    // Check for state label
    const state = parseStateFromLabel(label)
    if (state !== null) {
      currentState = state
      continue
    }

    // Check for retry label
    const retry = parseRetryLabel(label)
    if (retry !== null) {
      if (retry.category === 'spec') {
        specRetryCount = Math.max(specRetryCount, retry.count)
      } else {
        infraRetryCount = Math.max(infraRetryCount, retry.count)
      }
      continue
    }

    // Check for failure label
    const failure = parseFailureFromLabel(label)
    if (failure !== null) {
      failureType = failure
    }
  }

  return {
    currentState,
    specRetryCount,
    infraRetryCount,
    failureType,
    tddLabels,
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

const labelStateMachineImpl: LabelStateMachine = {
  // =========================================================================
  // State Analysis
  // =========================================================================

  getIssueState: (issueNumber) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      const issue = yield* ghClient
        .getIssue(issueNumber)
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new LabelOperationError('add', 'N/A', issueNumber, error))
          )
        )

      return analyzeLabels(issue.labels.map((l) => l.name))
    }),

  isValidTransition: (from, to) => isTransitionValid(from, to),

  // =========================================================================
  // State Transitions
  // =========================================================================

  transitionTo: (issueNumber, toState) =>
    Effect.gen(function* () {
      // Get current state
      const stateInfo = yield* labelStateMachineImpl.getIssueState(issueNumber)
      const fromState = stateInfo.currentState

      // Validate transition
      if (!isTransitionValid(fromState, toState)) {
        return yield* Effect.fail(
          new InvalidStateTransitionError(
            fromState,
            toState,
            `Transition from '${fromState ?? 'none'}' to '${toState}' is not allowed`
          )
        )
      }

      // Perform transition
      return yield* labelStateMachineImpl.forceTransitionTo(issueNumber, toState)
    }),

  forceTransitionTo: (issueNumber, toState) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      // Get current state
      const stateInfo = yield* labelStateMachineImpl.getIssueState(issueNumber)
      const fromState = stateInfo.currentState

      const labelsAdded: string[] = []
      const labelsRemoved: string[] = []

      // Remove old state label if exists
      if (fromState !== null) {
        const oldLabel = getStateLabel(fromState)
        yield* ghClient
          .removeLabels(issueNumber, [oldLabel])
          .pipe(
            Effect.catchAll((error) =>
              Effect.fail(new LabelOperationError('remove', oldLabel, issueNumber, error))
            )
          )
        labelsRemoved.push(oldLabel)
      }

      // Add new state label
      const newLabel = getStateLabel(toState)
      yield* ghClient
        .addLabels(issueNumber, [newLabel])
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new LabelOperationError('add', newLabel, issueNumber, error))
          )
        )
      labelsAdded.push(newLabel)

      return {
        success: true,
        newState: toState,
        labelsAdded,
        labelsRemoved,
      }
    }),

  // =========================================================================
  // Retry Management
  // =========================================================================

  incrementRetry: (issueNumber, category) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      // Get current retry count
      const stateInfo = yield* labelStateMachineImpl.getIssueState(issueNumber)
      const currentCount =
        category === 'spec' ? stateInfo.specRetryCount : stateInfo.infraRetryCount

      // Remove old retry label if exists
      if (currentCount > 0) {
        const oldLabel = buildRetryLabel(category, currentCount)
        yield* ghClient
          .removeLabels(issueNumber, [oldLabel])
          .pipe(
            Effect.catchAll((error) =>
              Effect.fail(new LabelOperationError('remove', oldLabel, issueNumber, error))
            )
          )
      }

      // Add new retry label (capped at MAX_RETRIES)
      const newCount = Math.min(currentCount + 1, MAX_RETRIES)
      const newLabel = buildRetryLabel(category, newCount)
      yield* ghClient
        .addLabels(issueNumber, [newLabel])
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new LabelOperationError('add', newLabel, issueNumber, error))
          )
        )

      return newCount
    }),

  hasMaxRetries: (issueNumber, category) =>
    Effect.gen(function* () {
      const stateInfo = yield* labelStateMachineImpl.getIssueState(issueNumber)
      const count = category === 'spec' ? stateInfo.specRetryCount : stateInfo.infraRetryCount
      return count >= MAX_RETRIES
    }),

  clearRetryLabels: (issueNumber) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient
      const stateInfo = yield* labelStateMachineImpl.getIssueState(issueNumber)

      // Remove all retry labels
      for (const label of stateInfo.tddLabels) {
        if (label.startsWith(RETRY_LABEL_PREFIX)) {
          yield* ghClient
            .removeLabels(issueNumber, [label])
            .pipe(
              Effect.catchAll((error) =>
                Effect.fail(new LabelOperationError('remove', label, issueNumber, error))
              )
            )
        }
      }
    }),

  // =========================================================================
  // Failure Classification
  // =========================================================================

  setFailureType: (issueNumber, failureType) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      // Clear existing failure labels first
      yield* labelStateMachineImpl.clearFailureType(issueNumber)

      // Add new failure label
      const label = getFailureLabel(failureType)
      yield* ghClient
        .addLabels(issueNumber, [label])
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new LabelOperationError('add', label, issueNumber, error))
          )
        )
    }),

  clearFailureType: (issueNumber) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient
      const stateInfo = yield* labelStateMachineImpl.getIssueState(issueNumber)

      // Remove all failure labels
      for (const label of stateInfo.tddLabels) {
        if (Object.values(FAILURE_LABELS).includes(label)) {
          yield* ghClient
            .removeLabels(issueNumber, [label])
            .pipe(
              Effect.catchAll((error) =>
                Effect.fail(new LabelOperationError('remove', label, issueNumber, error))
              )
            )
        }
      }
    }),

  // =========================================================================
  // Label Utilities
  // =========================================================================

  addLabel: (issueNumber, label) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient
      yield* ghClient
        .addLabels(issueNumber, [label])
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new LabelOperationError('add', label, issueNumber, error))
          )
        )
    }),

  removeLabel: (issueNumber, label) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient
      yield* ghClient
        .removeLabels(issueNumber, [label])
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new LabelOperationError('remove', label, issueNumber, error))
          )
        )
    }),

  clearAllTddLabels: (issueNumber) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient
      const stateInfo = yield* labelStateMachineImpl.getIssueState(issueNumber)

      // Remove all TDD labels
      for (const label of stateInfo.tddLabels) {
        yield* ghClient
          .removeLabels(issueNumber, [label])
          .pipe(
            Effect.catchAll((error) =>
              Effect.fail(new LabelOperationError('remove', label, issueNumber, error))
            )
          )
      }
    }),
}

// =============================================================================
// Layer
// =============================================================================

export const LabelStateMachineLive = Layer.succeed(
  LabelStateMachine,
  LabelStateMachine.of(labelStateMachineImpl)
)
