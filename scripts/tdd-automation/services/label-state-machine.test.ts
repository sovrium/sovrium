/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CommandService } from '../../lib/effect/CommandService'
import { GitHubAPIClient, type GitHubIssue } from './github-api-client'
import {
  LabelStateMachine,
  LabelStateMachineLive,
  InvalidStateTransitionError,
  // Pure helpers
  getStateLabel,
  parseStateFromLabel,
  buildRetryLabel,
  parseRetryLabel,
  getFailureLabel,
  parseFailureFromLabel,
  isTddLabel,
  isTransitionValid,
  analyzeLabels,
  // Constants
  ALL_STATE_LABELS,
  MAX_RETRIES,
  FAILURE_LABELS,
  VALID_TRANSITIONS,
} from './label-state-machine'

// =============================================================================
// Mock GitHubAPIClient
// =============================================================================

interface MockIssueState {
  labels: string[]
}

const createMockGitHubClient = (
  issueState: MockIssueState
): Layer.Layer<GitHubAPIClient, never, never> => {
  return Layer.succeed(
    GitHubAPIClient,
    GitHubAPIClient.of({
      getIssue: (issueNumber: number) =>
        Effect.succeed({
          number: issueNumber,
          title: `Test Issue #${issueNumber}`,
          body: 'Test body',
          state: 'open',
          labels: issueState.labels.map((name) => ({ name })),
          createdAt: '2025-01-25T10:00:00Z',
          updatedAt: '2025-01-25T10:00:00Z',
          url: `https://github.com/owner/repo/issues/${issueNumber}`,
        } as GitHubIssue),

      getIssueBody: () => Effect.succeed('Test body'),

      addLabels: (_issueNumber: number, labels: ReadonlyArray<string>) => {
        for (const label of labels) {
          if (!issueState.labels.includes(label)) {
            issueState.labels.push(label)
          }
        }
        return Effect.void
      },

      removeLabels: (_issueNumber: number, labels: ReadonlyArray<string>) => {
        for (const label of labels) {
          const index = issueState.labels.indexOf(label)
          if (index > -1) {
            issueState.labels.splice(index, 1)
          }
        }
        return Effect.void
      },

      // Unused methods (minimal implementation)
      checkRateLimit: () =>
        Effect.succeed({
          remaining: 5000,
          limit: 5000,
          resetTimestamp: Date.now() + 3_600_000,
          resetDate: new Date(Date.now() + 3_600_000),
        }),
      ensureRateLimit: () => Effect.succeed(true),
      listIssues: () => Effect.succeed([]),
      listPRs: () => Effect.succeed([]),
      hasPRForBranch: () => Effect.succeed(false),
      branchExists: () => Effect.succeed({ exists: false, name: '' }),
      listWorkflowRuns: () => Effect.succeed([]),
      getWorkflowRunLogs: () => Effect.succeed(''),
      addComment: () => Effect.void,
      closeIssue: () => Effect.void,
    })
  )
}

/**
 * Creates a mock CommandService layer for testing
 */
const createMockCommandService = (): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(
    CommandService,
    CommandService.of({
      exec: () => Effect.succeed(''),
      spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
      parallel: (commands) => Effect.all(commands, { concurrency: 'unbounded' }),
      withGitHubOutput: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
    })
  )
}

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('getStateLabel', () => {
  it('should return correct label for queued state', () => {
    expect(getStateLabel('queued')).toBe('tdd-spec:queued')
  })

  it('should return correct label for in-progress state', () => {
    expect(getStateLabel('in-progress')).toBe('tdd-spec:in-progress')
  })

  it('should return correct label for completed state', () => {
    expect(getStateLabel('completed')).toBe('tdd-spec:completed')
  })

  it('should return correct label for failed state', () => {
    expect(getStateLabel('failed')).toBe('tdd-spec:failed')
  })
})

describe('parseStateFromLabel', () => {
  it('should parse queued state from label', () => {
    expect(parseStateFromLabel('tdd-spec:queued')).toBe('queued')
  })

  it('should parse in-progress state from label', () => {
    expect(parseStateFromLabel('tdd-spec:in-progress')).toBe('in-progress')
  })

  it('should parse completed state from label', () => {
    expect(parseStateFromLabel('tdd-spec:completed')).toBe('completed')
  })

  it('should parse failed state from label', () => {
    expect(parseStateFromLabel('tdd-spec:failed')).toBe('failed')
  })

  it('should return null for non-state labels', () => {
    expect(parseStateFromLabel('bug')).toBeNull()
    expect(parseStateFromLabel('tdd-automation')).toBeNull()
    expect(parseStateFromLabel('')).toBeNull()
  })
})

describe('buildRetryLabel', () => {
  it('should build spec retry labels', () => {
    expect(buildRetryLabel('spec', 1)).toBe('retry:spec:1')
    expect(buildRetryLabel('spec', 2)).toBe('retry:spec:2')
    expect(buildRetryLabel('spec', 3)).toBe('retry:spec:3')
  })

  it('should build infra retry labels', () => {
    expect(buildRetryLabel('infra', 1)).toBe('retry:infra:1')
    expect(buildRetryLabel('infra', 2)).toBe('retry:infra:2')
    expect(buildRetryLabel('infra', 3)).toBe('retry:infra:3')
  })
})

describe('parseRetryLabel', () => {
  it('should parse spec retry labels', () => {
    expect(parseRetryLabel('retry:spec:1')).toEqual({ category: 'spec', count: 1 })
    expect(parseRetryLabel('retry:spec:2')).toEqual({ category: 'spec', count: 2 })
    expect(parseRetryLabel('retry:spec:3')).toEqual({ category: 'spec', count: 3 })
  })

  it('should parse infra retry labels', () => {
    expect(parseRetryLabel('retry:infra:1')).toEqual({ category: 'infra', count: 1 })
    expect(parseRetryLabel('retry:infra:2')).toEqual({ category: 'infra', count: 2 })
    expect(parseRetryLabel('retry:infra:3')).toEqual({ category: 'infra', count: 3 })
  })

  it('should return null for non-retry labels', () => {
    expect(parseRetryLabel('tdd-spec:queued')).toBeNull()
    expect(parseRetryLabel('retry:unknown:1')).toBeNull()
    expect(parseRetryLabel('retry:spec')).toBeNull()
    expect(parseRetryLabel('')).toBeNull()
  })
})

describe('getFailureLabel', () => {
  it('should return correct failure labels', () => {
    expect(getFailureLabel('spec')).toBe('failure:spec')
    expect(getFailureLabel('regression')).toBe('failure:regression')
    expect(getFailureLabel('infra')).toBe('failure:infra')
  })
})

describe('parseFailureFromLabel', () => {
  it('should parse failure labels', () => {
    expect(parseFailureFromLabel('failure:spec')).toBe('spec')
    expect(parseFailureFromLabel('failure:regression')).toBe('regression')
    expect(parseFailureFromLabel('failure:infra')).toBe('infra')
  })

  it('should return null for non-failure labels', () => {
    expect(parseFailureFromLabel('tdd-spec:failed')).toBeNull()
    expect(parseFailureFromLabel('failure:unknown')).toBeNull()
    expect(parseFailureFromLabel('')).toBeNull()
  })
})

describe('isTddLabel', () => {
  it('should identify state labels as TDD labels', () => {
    expect(isTddLabel('tdd-spec:queued')).toBe(true)
    expect(isTddLabel('tdd-spec:in-progress')).toBe(true)
    expect(isTddLabel('tdd-spec:completed')).toBe(true)
    expect(isTddLabel('tdd-spec:failed')).toBe(true)
  })

  it('should identify retry labels as TDD labels', () => {
    expect(isTddLabel('retry:spec:1')).toBe(true)
    expect(isTddLabel('retry:infra:2')).toBe(true)
  })

  it('should identify failure labels as TDD labels', () => {
    expect(isTddLabel('failure:spec')).toBe(true)
    expect(isTddLabel('failure:regression')).toBe(true)
    expect(isTddLabel('failure:infra')).toBe(true)
  })

  it('should identify tdd-automation as TDD label', () => {
    expect(isTddLabel('tdd-automation')).toBe(true)
  })

  it('should not identify non-TDD labels', () => {
    expect(isTddLabel('bug')).toBe(false)
    expect(isTddLabel('enhancement')).toBe(false)
    expect(isTddLabel('')).toBe(false)
  })
})

describe('isTransitionValid', () => {
  it('should allow null -> queued (initial state)', () => {
    expect(isTransitionValid(null, 'queued')).toBe(true)
  })

  it('should not allow null -> other states', () => {
    expect(isTransitionValid(null, 'in-progress')).toBe(false)
    expect(isTransitionValid(null, 'completed')).toBe(false)
    expect(isTransitionValid(null, 'failed')).toBe(false)
  })

  it('should allow queued -> in-progress', () => {
    expect(isTransitionValid('queued', 'in-progress')).toBe(true)
  })

  it('should not allow queued -> completed or failed directly', () => {
    expect(isTransitionValid('queued', 'completed')).toBe(false)
    expect(isTransitionValid('queued', 'failed')).toBe(false)
  })

  it('should allow in-progress -> completed', () => {
    expect(isTransitionValid('in-progress', 'completed')).toBe(true)
  })

  it('should allow in-progress -> failed', () => {
    expect(isTransitionValid('in-progress', 'failed')).toBe(true)
  })

  it('should allow in-progress -> queued (retry)', () => {
    expect(isTransitionValid('in-progress', 'queued')).toBe(true)
  })

  it('should allow failed -> queued (manual re-queue)', () => {
    expect(isTransitionValid('failed', 'queued')).toBe(true)
  })

  it('should not allow completed -> any other state', () => {
    expect(isTransitionValid('completed', 'queued')).toBe(false)
    expect(isTransitionValid('completed', 'in-progress')).toBe(false)
    expect(isTransitionValid('completed', 'failed')).toBe(false)
  })

  it('should not allow failed -> in-progress or completed directly', () => {
    expect(isTransitionValid('failed', 'in-progress')).toBe(false)
    expect(isTransitionValid('failed', 'completed')).toBe(false)
  })
})

describe('analyzeLabels', () => {
  it('should extract current state from labels', () => {
    const result = analyzeLabels(['bug', 'tdd-spec:in-progress', 'enhancement'])
    expect(result.currentState).toBe('in-progress')
  })

  it('should extract retry counts from labels', () => {
    const result = analyzeLabels(['tdd-spec:queued', 'retry:spec:2', 'retry:infra:1'])
    expect(result.specRetryCount).toBe(2)
    expect(result.infraRetryCount).toBe(1)
  })

  it('should extract failure type from labels', () => {
    const result = analyzeLabels(['tdd-spec:failed', 'failure:regression'])
    expect(result.failureType).toBe('regression')
  })

  it('should collect TDD labels', () => {
    const labels = ['bug', 'tdd-spec:in-progress', 'retry:spec:1', 'enhancement']
    const result = analyzeLabels(labels)
    expect(result.tddLabels).toEqual(['tdd-spec:in-progress', 'retry:spec:1'])
  })

  it('should handle empty labels', () => {
    const result = analyzeLabels([])
    expect(result.currentState).toBeNull()
    expect(result.specRetryCount).toBe(0)
    expect(result.infraRetryCount).toBe(0)
    expect(result.failureType).toBeNull()
    expect(result.tddLabels).toEqual([])
  })

  it('should take highest retry count if multiple exist', () => {
    const result = analyzeLabels(['retry:spec:1', 'retry:spec:3', 'retry:spec:2'])
    expect(result.specRetryCount).toBe(3)
  })
})

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
  it('should have all state labels', () => {
    expect(ALL_STATE_LABELS).toContain('tdd-spec:queued')
    expect(ALL_STATE_LABELS).toContain('tdd-spec:in-progress')
    expect(ALL_STATE_LABELS).toContain('tdd-spec:completed')
    expect(ALL_STATE_LABELS).toContain('tdd-spec:failed')
    expect(ALL_STATE_LABELS).toHaveLength(4)
  })

  it('should have MAX_RETRIES set to 3', () => {
    expect(MAX_RETRIES).toBe(3)
  })

  it('should have all failure labels', () => {
    expect(FAILURE_LABELS.spec).toBe('failure:spec')
    expect(FAILURE_LABELS.regression).toBe('failure:regression')
    expect(FAILURE_LABELS.infra).toBe('failure:infra')
  })

  it('should have valid transitions defined', () => {
    expect(VALID_TRANSITIONS.length).toBeGreaterThan(0)
    expect(VALID_TRANSITIONS.some((t) => t.from === 'queued' && t.to === 'in-progress')).toBe(true)
    expect(VALID_TRANSITIONS.some((t) => t.from === 'in-progress' && t.to === 'completed')).toBe(
      true
    )
  })
})

// =============================================================================
// Service Tests
// =============================================================================

describe('LabelStateMachine Service', () => {
  describe('getIssueState', () => {
    it('should return state info for issue with TDD labels', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:1', 'bug'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.getIssueState(123)
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result.currentState).toBe('in-progress')
      expect(result.specRetryCount).toBe(1)
      expect(result.infraRetryCount).toBe(0)
      expect(result.tddLabels).toContain('tdd-spec:in-progress')
      expect(result.tddLabels).toContain('retry:spec:1')
    })

    it('should return null state for issue without state label', async () => {
      const issueState = { labels: ['bug', 'enhancement'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.getIssueState(123)
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result.currentState).toBeNull()
    })
  })

  describe('isValidTransition', () => {
    it('should validate transitions using service method', async () => {
      const issueState = { labels: [] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return {
            queuedToInProgress: sm.isValidTransition('queued', 'in-progress'),
            queuedToCompleted: sm.isValidTransition('queued', 'completed'),
            nullToQueued: sm.isValidTransition(null, 'queued'),
          }
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result.queuedToInProgress).toBe(true)
      expect(result.queuedToCompleted).toBe(false)
      expect(result.nullToQueued).toBe(true)
    })
  })

  describe('transitionTo', () => {
    it('should transition from queued to in-progress', async () => {
      const issueState = { labels: ['tdd-spec:queued'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.transitionTo(123, 'in-progress')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result.success).toBe(true)
      expect(result.newState).toBe('in-progress')
      expect(result.labelsAdded).toContain('tdd-spec:in-progress')
      expect(result.labelsRemoved).toContain('tdd-spec:queued')
      expect(issueState.labels).toContain('tdd-spec:in-progress')
      expect(issueState.labels).not.toContain('tdd-spec:queued')
    })

    it('should fail for invalid transition', async () => {
      const issueState = { labels: ['tdd-spec:queued'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.transitionTo(123, 'completed')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService()),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(InvalidStateTransitionError)
      }
    })

    it('should allow transition from null to queued', async () => {
      const issueState = { labels: ['bug'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.transitionTo(123, 'queued')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result.success).toBe(true)
      expect(result.newState).toBe('queued')
      expect(issueState.labels).toContain('tdd-spec:queued')
    })
  })

  describe('forceTransitionTo', () => {
    it('should force transition even for invalid paths', async () => {
      const issueState = { labels: ['tdd-spec:completed'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.forceTransitionTo(123, 'in-progress')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result.success).toBe(true)
      expect(result.newState).toBe('in-progress')
      expect(issueState.labels).toContain('tdd-spec:in-progress')
      expect(issueState.labels).not.toContain('tdd-spec:completed')
    })
  })

  describe('incrementRetry', () => {
    it('should add first retry label', async () => {
      const issueState = { labels: ['tdd-spec:in-progress'] }

      const newCount = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.incrementRetry(123, 'spec')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(newCount).toBe(1)
      expect(issueState.labels).toContain('retry:spec:1')
    })

    it('should increment existing retry label', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:1'] }

      const newCount = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.incrementRetry(123, 'spec')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(newCount).toBe(2)
      expect(issueState.labels).toContain('retry:spec:2')
      expect(issueState.labels).not.toContain('retry:spec:1')
    })

    it('should cap retry at MAX_RETRIES', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:3'] }

      const newCount = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.incrementRetry(123, 'spec')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(newCount).toBe(3) // Still 3, not 4
      expect(issueState.labels).toContain('retry:spec:3')
    })

    it('should handle infra retries separately from spec', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:2'] }

      const newCount = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.incrementRetry(123, 'infra')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(newCount).toBe(1)
      expect(issueState.labels).toContain('retry:infra:1')
      expect(issueState.labels).toContain('retry:spec:2') // Unchanged
    })
  })

  describe('hasMaxRetries', () => {
    it('should return true when at max retries', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:3'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.hasMaxRetries(123, 'spec')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result).toBe(true)
    })

    it('should return false when below max retries', async () => {
      const issueState = { labels: ['tdd-spec:in-progress', 'retry:spec:2'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.hasMaxRetries(123, 'spec')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result).toBe(false)
    })

    it('should return false when no retries', async () => {
      const issueState = { labels: ['tdd-spec:in-progress'] }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          return yield* sm.hasMaxRetries(123, 'spec')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(result).toBe(false)
    })
  })

  describe('clearRetryLabels', () => {
    it('should remove all retry labels', async () => {
      const issueState = {
        labels: ['tdd-spec:in-progress', 'retry:spec:2', 'retry:infra:1', 'bug'],
      }

      await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          yield* sm.clearRetryLabels(123)
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(issueState.labels).not.toContain('retry:spec:2')
      expect(issueState.labels).not.toContain('retry:infra:1')
      expect(issueState.labels).toContain('tdd-spec:in-progress')
      expect(issueState.labels).toContain('bug')
    })
  })

  describe('setFailureType', () => {
    it('should add failure label', async () => {
      const issueState = { labels: ['tdd-spec:failed'] }

      await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          yield* sm.setFailureType(123, 'spec')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(issueState.labels).toContain('failure:spec')
    })

    it('should replace existing failure label', async () => {
      const issueState = { labels: ['tdd-spec:failed', 'failure:spec'] }

      await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          yield* sm.setFailureType(123, 'infra')
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(issueState.labels).toContain('failure:infra')
      expect(issueState.labels).not.toContain('failure:spec')
    })
  })

  describe('clearFailureType', () => {
    it('should remove failure labels', async () => {
      const issueState = { labels: ['tdd-spec:failed', 'failure:regression'] }

      await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          yield* sm.clearFailureType(123)
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(issueState.labels).not.toContain('failure:regression')
      expect(issueState.labels).toContain('tdd-spec:failed')
    })
  })

  describe('clearAllTddLabels', () => {
    it('should remove all TDD labels', async () => {
      const issueState = {
        labels: ['tdd-spec:in-progress', 'retry:spec:2', 'failure:spec', 'bug', 'tdd-automation'],
      }

      await Effect.runPromise(
        Effect.gen(function* () {
          const sm = yield* LabelStateMachine
          yield* sm.clearAllTddLabels(123)
        }).pipe(
          Effect.provide(LabelStateMachineLive),
          Effect.provide(createMockGitHubClient(issueState)),
          Effect.provide(createMockCommandService())
        )
      )

      expect(issueState.labels).toEqual(['bug'])
    })
  })
})
