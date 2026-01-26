/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CommandService } from '../../lib/effect'
import {
  GitHubAPIClient,
  GitHubAPIError,
  type GitHubIssue,
  type GitHubWorkflowRun,
} from './github-api-client'
import {
  HealthMetrics,
  HealthMetricsLive,
  DEFAULT_THRESHOLDS,
  WORKFLOW_WINDOW_HOURS,
  CIRCUIT_BREAKER_LABEL,
  calculateFailureRatePercentage,
  calculateRetryThreshold,
  isFailureRateCritical,
  isRetryCountCritical,
  determineHealthLevelFromMetrics,
  getHealthIssuesFromMetrics,
  buildHealthSummary,
  type QueueMetrics,
  type WorkflowMetrics,
  type HealthThresholds,
} from './health-metrics'
import { STATE_LABELS } from './label-state-machine'
import { TimeUtilsLive } from './time-utils'

// Mock CommandService for tests (required by GitHubAPIClient methods in interface)
const MockCommandServiceLive = Layer.succeed(CommandService, {
  spawn: () => Effect.succeed({ stdout: '', stderr: '', exitCode: 0, duration: 0 }),
  exec: () => Effect.succeed(''),
  parallel: (commands) => Effect.all(commands),
  withGitHubOutput: () => Effect.succeed({ stdout: '', stderr: '', exitCode: 0, duration: 0 }),
})

// =============================================================================
// Mock Helpers
// =============================================================================

interface MockGitHubState {
  issues: GitHubIssue[]
  workflowRuns: GitHubWorkflowRun[]
}

const createMockIssue = (
  number: number,
  title: string,
  labels: string[],
  state: 'open' | 'closed',
  createdAt?: string
): GitHubIssue => ({
  number,
  title,
  labels: labels.map((name) => ({ name })),
  state,
  body: null,
  createdAt: createdAt ?? '2025-01-25T10:00:00Z',
  updatedAt: '2025-01-25T10:00:00Z',
  url: `https://github.com/test/repo/issues/${number}`,
})

const createMockWorkflowRun = (
  id: number,
  status: 'queued' | 'in_progress' | 'completed',
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null,
  createdAt: string,
  displayTitle?: string
): GitHubWorkflowRun => ({
  id,
  name: displayTitle ?? `Run ${id}`,
  status,
  conclusion,
  headBranch: 'main',
  createdAt,
  updatedAt: createdAt,
  url: `https://github.com/test/repo/actions/runs/${id}`,
})

const createMockGitHubClient = (
  state: MockGitHubState
): Layer.Layer<GitHubAPIClient, never, never> => {
  return Layer.succeed(
    GitHubAPIClient,
    GitHubAPIClient.of({
      checkRateLimit: () =>
        Effect.succeed({
          remaining: 5000,
          limit: 5000,
          resetTimestamp: Date.now() + 3_600_000,
          resetDate: new Date(Date.now() + 3_600_000),
        }),
      ensureRateLimit: () => Effect.succeed(true),
      getIssue: (issueNumber: number) => {
        const issue = state.issues.find((i) => i.number === issueNumber)
        if (!issue) {
          return Effect.fail(new GitHubAPIError('getIssue', `Issue ${issueNumber} not found`))
        }
        return Effect.succeed(issue)
      },
      getIssueBody: (issueNumber: number) => {
        const issue = state.issues.find((i) => i.number === issueNumber)
        if (!issue) {
          return Effect.fail(new GitHubAPIError('getIssueBody', `Issue ${issueNumber} not found`))
        }
        return Effect.succeed(issue.body ?? '')
      },
      listIssues: (options) => {
        let filtered = state.issues
        if (options?.labels && options.labels.length > 0) {
          filtered = state.issues.filter((issue) =>
            options.labels!.every((label) => issue.labels.some((l) => l.name === label))
          )
        }
        return Effect.succeed(filtered)
      },
      listWorkflowRuns: () => Effect.succeed(state.workflowRuns),
      getWorkflowRunLogs: () => Effect.succeed(''),
      addLabels: () => Effect.void,
      removeLabels: () => Effect.void,
      addComment: () => Effect.void,
      closeIssue: () => Effect.void,
      listPRs: () => Effect.succeed([]),
      hasPRForBranch: () => Effect.succeed(false),
      branchExists: () => Effect.succeed({ exists: false, name: '' }),
    })
  )
}

const createQueueMetrics = (overrides: Partial<QueueMetrics> = {}): QueueMetrics => ({
  queuedCount: 10,
  inProgressCount: 2,
  completedCount: 50,
  failedCount: 5,
  retryCount: 3,
  retryByCategory: { spec: 2, infra: 1 },
  activeCount: 12,
  timestamp: '2025-01-25T12:00:00Z',
  ...overrides,
})

const createWorkflowMetrics = (overrides: Partial<WorkflowMetrics> = {}): WorkflowMetrics => ({
  totalRuns: 20,
  failedRuns: 4,
  failureRate: 20,
  windowHours: 24,
  timestamp: '2025-01-25T12:00:00Z',
  ...overrides,
})

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('health-metrics pure functions', () => {
  describe('calculateFailureRatePercentage', () => {
    test('returns 0 when total is 0', () => {
      expect(calculateFailureRatePercentage(0, 0)).toBe(0)
    })

    test('calculates correct percentage', () => {
      expect(calculateFailureRatePercentage(5, 100)).toBe(5)
      expect(calculateFailureRatePercentage(50, 100)).toBe(50)
      expect(calculateFailureRatePercentage(1, 3)).toBe(33) // Rounded
    })

    test('handles 100% failure', () => {
      expect(calculateFailureRatePercentage(10, 10)).toBe(100)
    })
  })

  describe('calculateRetryThreshold', () => {
    test('uses minimum threshold when calculated is lower', () => {
      expect(calculateRetryThreshold(10, 20, 5)).toBe(5) // 20% of 10 = 2, min 5
    })

    test('uses calculated threshold when higher than minimum', () => {
      expect(calculateRetryThreshold(100, 20, 5)).toBe(20) // 20% of 100 = 20
    })

    test('handles zero queue size', () => {
      expect(calculateRetryThreshold(0, 20, 5)).toBe(5)
    })
  })

  describe('isFailureRateCritical', () => {
    const thresholds: HealthThresholds = {
      ...DEFAULT_THRESHOLDS,
      failureRateThreshold: 50,
      minSamples: 5,
    }

    test('returns false when below min samples', () => {
      expect(isFailureRateCritical(100, 4, thresholds)).toBe(false)
    })

    test('returns false when below threshold', () => {
      expect(isFailureRateCritical(30, 10, thresholds)).toBe(false)
      expect(isFailureRateCritical(50, 10, thresholds)).toBe(false) // Exactly at threshold
    })

    test('returns true when above threshold with sufficient samples', () => {
      expect(isFailureRateCritical(51, 10, thresholds)).toBe(true)
      expect(isFailureRateCritical(80, 5, thresholds)).toBe(true)
    })
  })

  describe('isRetryCountCritical', () => {
    const thresholds: HealthThresholds = {
      ...DEFAULT_THRESHOLDS,
      retryPercentageThreshold: 20,
      minRetryIssues: 5,
    }

    test('returns false when below threshold', () => {
      expect(isRetryCountCritical(4, 100, thresholds)).toBe(false)
    })

    test('returns true when at or above threshold', () => {
      expect(isRetryCountCritical(5, 10, thresholds)).toBe(true) // Uses min 5
      expect(isRetryCountCritical(20, 100, thresholds)).toBe(true) // 20% of 100
    })

    test('uses minimum threshold for small queues', () => {
      // For queue of 10, 20% = 2, but min is 5
      expect(isRetryCountCritical(4, 10, thresholds)).toBe(false)
      expect(isRetryCountCritical(5, 10, thresholds)).toBe(true)
    })
  })

  describe('determineHealthLevelFromMetrics', () => {
    test('returns critical when failure rate exceeds threshold', () => {
      const queue = createQueueMetrics()
      const workflow = createWorkflowMetrics({ failureRate: 60, totalRuns: 10 })

      expect(determineHealthLevelFromMetrics(queue, workflow)).toBe('critical')
    })

    test('returns critical when retry count exceeds threshold', () => {
      const queue = createQueueMetrics({ retryCount: 10, queuedCount: 20 })
      const workflow = createWorkflowMetrics({ failureRate: 10, totalRuns: 10 })

      expect(determineHealthLevelFromMetrics(queue, workflow)).toBe('critical')
    })

    test('returns degraded when moderate issues exist', () => {
      const queue = createQueueMetrics({ retryCount: 3 })
      const workflow = createWorkflowMetrics({ failureRate: 30, totalRuns: 10 })

      expect(determineHealthLevelFromMetrics(queue, workflow)).toBe('degraded')
    })

    test('returns healthy when no issues', () => {
      const queue = createQueueMetrics({ retryCount: 0 })
      const workflow = createWorkflowMetrics({ failureRate: 10, totalRuns: 10 })

      expect(determineHealthLevelFromMetrics(queue, workflow)).toBe('healthy')
    })
  })

  describe('getHealthIssuesFromMetrics', () => {
    test('returns empty array when healthy', () => {
      const queue = createQueueMetrics({ retryCount: 0, inProgressCount: 2 })
      const workflow = createWorkflowMetrics({ failureRate: 10, totalRuns: 10 })

      const issues = getHealthIssuesFromMetrics(queue, workflow)
      expect(issues).toEqual([])
    })

    test('includes high failure rate issue', () => {
      const queue = createQueueMetrics()
      const workflow = createWorkflowMetrics({ failureRate: 60, totalRuns: 10 })

      const issues = getHealthIssuesFromMetrics(queue, workflow)
      expect(issues.some((i) => i.includes('High failure rate'))).toBe(true)
    })

    test('includes elevated failure rate issue', () => {
      const queue = createQueueMetrics()
      const workflow = createWorkflowMetrics({ failureRate: 30, totalRuns: 4 }) // Below minSamples

      const issues = getHealthIssuesFromMetrics(queue, workflow)
      expect(issues.some((i) => i.includes('Elevated failure rate'))).toBe(true)
    })

    test('includes high retry count issue', () => {
      const queue = createQueueMetrics({ retryCount: 10, queuedCount: 20 })
      const workflow = createWorkflowMetrics({ failureRate: 10, totalRuns: 10 })

      const issues = getHealthIssuesFromMetrics(queue, workflow)
      expect(issues.some((i) => i.includes('High retry count'))).toBe(true)
    })

    test('includes infrastructure issues dominant warning', () => {
      const queue = createQueueMetrics({
        retryByCategory: { spec: 1, infra: 5 },
      })
      const workflow = createWorkflowMetrics({ failureRate: 10, totalRuns: 10 })

      const issues = getHealthIssuesFromMetrics(queue, workflow)
      expect(issues.some((i) => i.includes('Infrastructure issues dominant'))).toBe(true)
    })

    test('includes queue stagnation warning', () => {
      const queue = createQueueMetrics({ queuedCount: 10, inProgressCount: 0 })
      const workflow = createWorkflowMetrics({ failureRate: 10, totalRuns: 10 })

      const issues = getHealthIssuesFromMetrics(queue, workflow)
      expect(issues.some((i) => i.includes('Queue stagnation'))).toBe(true)
    })
  })

  describe('buildHealthSummary', () => {
    test('includes correct emoji for healthy', () => {
      const summary = buildHealthSummary('healthy', createQueueMetrics(), createWorkflowMetrics())
      expect(summary.startsWith('✅')).toBe(true)
      expect(summary.includes('HEALTHY')).toBe(true)
    })

    test('includes correct emoji for degraded', () => {
      const summary = buildHealthSummary('degraded', createQueueMetrics(), createWorkflowMetrics())
      expect(summary.startsWith('⚠️')).toBe(true)
      expect(summary.includes('DEGRADED')).toBe(true)
    })

    test('includes correct emoji for critical', () => {
      const summary = buildHealthSummary('critical', createQueueMetrics(), createWorkflowMetrics())
      expect(summary.startsWith('🚨')).toBe(true)
      expect(summary.includes('CRITICAL')).toBe(true)
    })

    test('includes metrics in summary', () => {
      const queue = createQueueMetrics({ queuedCount: 5, inProgressCount: 2, activeCount: 7 })
      const workflow = createWorkflowMetrics({ failureRate: 15 })

      const summary = buildHealthSummary('healthy', queue, workflow)

      expect(summary.includes('7 active specs')).toBe(true)
      expect(summary.includes('5 queued')).toBe(true)
      expect(summary.includes('2 in-progress')).toBe(true)
      expect(summary.includes('15% failure rate')).toBe(true)
    })
  })
})

// =============================================================================
// Constants Tests
// =============================================================================

describe('health-metrics constants', () => {
  describe('DEFAULT_THRESHOLDS', () => {
    test('has expected values', () => {
      expect(DEFAULT_THRESHOLDS.failureRateThreshold).toBe(50)
      expect(DEFAULT_THRESHOLDS.minSamples).toBe(5)
      expect(DEFAULT_THRESHOLDS.retryPercentageThreshold).toBe(20)
      expect(DEFAULT_THRESHOLDS.minRetryIssues).toBe(5)
      expect(DEFAULT_THRESHOLDS.stuckSpecMinutes).toBe(90)
      expect(DEFAULT_THRESHOLDS.staleLockMinutes).toBe(60)
    })
  })

  test('WORKFLOW_WINDOW_HOURS is 24', () => {
    expect(WORKFLOW_WINDOW_HOURS).toBe(24)
  })

  test('CIRCUIT_BREAKER_LABEL is correct', () => {
    expect(CIRCUIT_BREAKER_LABEL).toBe('tdd-queue:disabled')
  })
})

// =============================================================================
// Service Tests
// =============================================================================

describe('HealthMetrics service', () => {
  describe('countByState', () => {
    test('counts issues with state label', async () => {
      const mockState: MockGitHubState = {
        issues: [
          createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open'),
          createMockIssue(2, 'Spec 2', [STATE_LABELS.queued], 'open'),
          createMockIssue(3, 'Spec 3', [STATE_LABELS['in-progress']], 'open'),
        ],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.countByState('queued')
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe(2)
    })

    test('returns 0 for no matching issues', async () => {
      const mockState: MockGitHubState = {
        issues: [createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open')],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.countByState('failed')
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe(0)
    })
  })

  describe('countRetryIssues', () => {
    test('counts all retry issues when no category specified', async () => {
      const mockState: MockGitHubState = {
        issues: [
          createMockIssue(1, 'Spec 1', ['retry:spec:1'], 'open'),
          createMockIssue(2, 'Spec 2', ['retry:spec:2'], 'open'),
          createMockIssue(3, 'Spec 3', ['retry:infra:1'], 'open'),
        ],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.countRetryIssues()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe(3)
    })

    test('counts only spec retries when category is spec', async () => {
      const mockState: MockGitHubState = {
        issues: [
          createMockIssue(1, 'Spec 1', ['retry:spec:1'], 'open'),
          createMockIssue(2, 'Spec 2', ['retry:spec:2'], 'open'),
          createMockIssue(3, 'Spec 3', ['retry:infra:1'], 'open'),
        ],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.countRetryIssues('spec')
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe(2)
    })
  })

  describe('getQueueMetrics', () => {
    test('returns complete queue metrics', async () => {
      const mockState: MockGitHubState = {
        issues: [
          createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open'),
          createMockIssue(2, 'Spec 2', [STATE_LABELS.queued], 'open'),
          createMockIssue(3, 'Spec 3', [STATE_LABELS['in-progress']], 'open'),
          createMockIssue(4, 'Spec 4', [STATE_LABELS.completed], 'closed'),
          createMockIssue(5, 'Spec 5', [STATE_LABELS.failed], 'open'),
          createMockIssue(6, 'Spec 6', ['retry:spec:1'], 'open'),
        ],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.getQueueMetrics()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)

      expect(result.queuedCount).toBe(2)
      expect(result.inProgressCount).toBe(1)
      expect(result.completedCount).toBe(1)
      expect(result.failedCount).toBe(1)
      expect(result.activeCount).toBe(3)
      expect(result.timestamp).toBeDefined()
    })
  })

  describe('getWorkflowMetrics', () => {
    test('calculates workflow metrics correctly', async () => {
      const now = new Date()
      const mockState: MockGitHubState = {
        issues: [],
        workflowRuns: [
          createMockWorkflowRun(1, 'completed', 'success', now.toISOString(), 'Run 1'),
          createMockWorkflowRun(2, 'completed', 'failure', now.toISOString(), 'Run 2'),
          createMockWorkflowRun(3, 'completed', 'cancelled', now.toISOString(), 'Run 3'),
          createMockWorkflowRun(4, 'completed', 'success', now.toISOString(), 'Run 4'),
        ],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.getWorkflowMetrics()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)

      expect(result.totalRuns).toBe(4)
      expect(result.failedRuns).toBe(2) // failure + cancelled
      expect(result.failureRate).toBe(50)
      expect(result.windowHours).toBe(24)
    })

    test('returns 0% failure rate when no runs', async () => {
      const mockState: MockGitHubState = {
        issues: [],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.getWorkflowMetrics()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)

      expect(result.totalRuns).toBe(0)
      expect(result.failedRuns).toBe(0)
      expect(result.failureRate).toBe(0)
    })
  })

  describe('getCircuitBreakerState', () => {
    test('returns closed state when no circuit breaker issue', async () => {
      const mockState: MockGitHubState = {
        issues: [],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.getCircuitBreakerState()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)

      expect(result.isOpen).toBe(false)
      expect(result.openedAt).toBeNull()
      expect(result.reason).toContain('closed')
    })

    test('returns open state when circuit breaker issue exists', async () => {
      const mockState: MockGitHubState = {
        issues: [
          createMockIssue(
            100,
            'Circuit Breaker',
            [CIRCUIT_BREAKER_LABEL],
            'open',
            '2025-01-25T10:00:00Z'
          ),
        ],
        workflowRuns: [],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.getCircuitBreakerState()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)

      expect(result.isOpen).toBe(true)
      expect(result.openedAt).toBe('2025-01-25T10:00:00Z')
      expect(result.reason).toContain('100')
    })
  })

  describe('shouldOpenCircuit', () => {
    test('returns true when failure rate exceeds threshold', async () => {
      const now = new Date()
      const mockState: MockGitHubState = {
        issues: [createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open')],
        workflowRuns: [
          // 6 failures out of 10 = 60%
          ...Array.from({ length: 6 }, (_, i) =>
            createMockWorkflowRun(i, 'completed', 'failure', now.toISOString(), `Failed ${i}`)
          ),
          ...Array.from({ length: 4 }, (_, i) =>
            createMockWorkflowRun(i + 6, 'completed', 'success', now.toISOString(), `Success ${i}`)
          ),
        ],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.shouldOpenCircuit()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe(true)
    })

    test('returns false when below thresholds', async () => {
      const now = new Date()
      const mockState: MockGitHubState = {
        issues: [createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open')],
        workflowRuns: [
          // 2 failures out of 10 = 20%
          ...Array.from({ length: 2 }, (_, i) =>
            createMockWorkflowRun(i, 'completed', 'failure', now.toISOString(), `Failed ${i}`)
          ),
          ...Array.from({ length: 8 }, (_, i) =>
            createMockWorkflowRun(i + 2, 'completed', 'success', now.toISOString(), `Success ${i}`)
          ),
        ],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.shouldOpenCircuit()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe(false)
    })
  })

  describe('canCloseCircuit', () => {
    test('returns true when metrics are healthy', async () => {
      const now = new Date()
      const mockState: MockGitHubState = {
        issues: [createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open')],
        workflowRuns: [
          // 1 failure out of 10 = 10% (below 25% threshold for closing)
          createMockWorkflowRun(1, 'completed', 'failure', now.toISOString(), 'Failed'),
          ...Array.from({ length: 9 }, (_, i) =>
            createMockWorkflowRun(i + 2, 'completed', 'success', now.toISOString(), `Success ${i}`)
          ),
        ],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.canCloseCircuit()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe(true)
    })
  })

  describe('assessHealth', () => {
    test('returns complete health assessment', async () => {
      const now = new Date()
      const mockState: MockGitHubState = {
        issues: [
          createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open'),
          createMockIssue(2, 'Spec 2', [STATE_LABELS['in-progress']], 'open'),
        ],
        workflowRuns: [
          createMockWorkflowRun(1, 'completed', 'success', now.toISOString(), 'Run 1'),
        ],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.assessHealth()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)

      expect(result.level).toBe('healthy')
      expect(result.summary).toContain('HEALTHY')
      expect(result.issues).toEqual([])
      expect(result.queueMetrics).toBeDefined()
      expect(result.workflowMetrics).toBeDefined()
      expect(result.circuitBreaker).toBeDefined()
      expect(result.timestamp).toBeDefined()
    })

    test('returns critical assessment when failure rate is high', async () => {
      const now = new Date()
      const mockState: MockGitHubState = {
        issues: [createMockIssue(1, 'Spec 1', [STATE_LABELS.queued], 'open')],
        workflowRuns: [
          // 6 failures out of 10 = 60%
          ...Array.from({ length: 6 }, (_, i) =>
            createMockWorkflowRun(i, 'completed', 'failure', now.toISOString(), `Failed ${i}`)
          ),
          ...Array.from({ length: 4 }, (_, i) =>
            createMockWorkflowRun(i + 6, 'completed', 'success', now.toISOString(), `Success ${i}`)
          ),
        ],
      }

      const layer = Layer.mergeAll(
        createMockGitHubClient(mockState),
        TimeUtilsLive,
        MockCommandServiceLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return yield* metrics.assessHealth()
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)

      expect(result.level).toBe('critical')
      expect(result.summary).toContain('CRITICAL')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues.some((i) => i.includes('failure rate'))).toBe(true)
    })
  })

  describe('determineHealthLevel (service method)', () => {
    test('delegates to pure function', async () => {
      const queue = createQueueMetrics()
      const workflow = createWorkflowMetrics({ failureRate: 60, totalRuns: 10 })

      const layer = Layer.merge(
        createMockGitHubClient({ issues: [], workflowRuns: [] }),
        TimeUtilsLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return metrics.determineHealthLevel(queue, workflow)
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result).toBe('critical')
    })
  })

  describe('getHealthIssues (service method)', () => {
    test('delegates to pure function', async () => {
      const queue = createQueueMetrics({ retryCount: 10, queuedCount: 20 })
      const workflow = createWorkflowMetrics({ failureRate: 60, totalRuns: 10 })

      const layer = Layer.merge(
        createMockGitHubClient({ issues: [], workflowRuns: [] }),
        TimeUtilsLive
      )
      const program = Effect.gen(function* () {
        const metrics = yield* HealthMetrics
        return metrics.getHealthIssues(queue, workflow)
      }).pipe(Effect.provide(Layer.merge(HealthMetricsLive, layer)))

      const result = await Effect.runPromise(program)
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
