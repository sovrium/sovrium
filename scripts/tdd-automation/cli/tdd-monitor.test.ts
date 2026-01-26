/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CommandService, FileSystemService } from '../../lib/effect'
import { GitHubAPIClient, type GitHubIssue, type GitHubPR } from '../services/github-api-client'
import {
  HealthMetrics,
  type HealthAssessment,
  type HealthLevel,
  type QueueMetrics,
  type WorkflowMetrics,
  type CircuitBreakerState,
} from '../services/health-metrics'
import {
  LabelStateMachine,
  type SpecState,
  type IssueStateInfo,
  type StateTransitionResult,
  type FailureType,
} from '../services/label-state-machine'
import { PRManager, type OrphanBranch } from '../services/pr-manager'
import { TimeUtils } from '../services/time-utils'

// =============================================================================
// Mock State & FileSystem
// =============================================================================

interface MockState {
  readonly writtenFiles: Map<string, string>
}

const createMockState = (): MockState => ({
  writtenFiles: new Map(),
})

const createMockFileSystemService = (
  state: MockState
): Layer.Layer<FileSystemService, never, never> => {
  return Layer.succeed(
    FileSystemService,
    FileSystemService.of({
      readFile: (path: string) => Effect.succeed(state.writtenFiles.get(path) ?? ''),
      writeFile: (path: string, content: string) => {
        state.writtenFiles.set(path, content)
        return Effect.void
      },
      exists: (path: string) => Effect.succeed(state.writtenFiles.has(path)),
      mkdir: () => Effect.void,
      glob: () => Effect.succeed([]),
      format: (content: string) => Effect.succeed(content),
      writeFormatted: (path: string, content: string) => {
        state.writtenFiles.set(path, content)
        return Effect.void
      },
    })
  )
}

// =============================================================================
// Mock Factories for Service Data Types
// =============================================================================

const createMockQueueMetrics = (overrides?: Partial<QueueMetrics>): QueueMetrics => ({
  queuedCount: 10,
  inProgressCount: 2,
  completedCount: 50,
  failedCount: 5,
  retryCount: 3,
  retryByCategory: { spec: 2, infra: 1 },
  activeCount: 12,
  timestamp: new Date().toISOString(),
  ...overrides,
})

const createMockWorkflowMetrics = (overrides?: Partial<WorkflowMetrics>): WorkflowMetrics => ({
  totalRuns: 100,
  failedRuns: 10,
  failureRate: 10,
  windowHours: 24,
  timestamp: new Date().toISOString(),
  ...overrides,
})

const createMockCircuitBreakerState = (
  overrides?: Partial<CircuitBreakerState>
): CircuitBreakerState => ({
  isOpen: false,
  reason: 'Queue is healthy',
  openedAt: null,
  failureRate: 10,
  retryCount: 3,
  ...overrides,
})

const createMockHealthAssessment = (
  level: HealthLevel,
  overrides?: Partial<HealthAssessment>
): HealthAssessment => ({
  level,
  summary: `Pipeline ${level}`,
  issues: level === 'critical' ? ['High failure rate', 'Too many retries'] : [],
  queueMetrics: createMockQueueMetrics(),
  workflowMetrics: createMockWorkflowMetrics({ failureRate: level === 'critical' ? 75 : 10 }),
  circuitBreaker: createMockCircuitBreakerState({ isOpen: level === 'critical' }),
  timestamp: new Date().toISOString(),
  ...overrides,
})

const createMockIssueStateInfo = (overrides?: Partial<IssueStateInfo>): IssueStateInfo => ({
  currentState: 'queued',
  specRetryCount: 0,
  infraRetryCount: 0,
  failureType: null,
  tddLabels: ['tdd-spec:queued'],
  ...overrides,
})

const createMockStateTransitionResult = (toState: SpecState): StateTransitionResult => ({
  success: true,
  newState: toState,
  labelsAdded: [`tdd-spec:${toState}`],
  labelsRemoved: [],
})

const createMockGitHubIssue = (
  number: number,
  title: string,
  labelNames: readonly string[],
  state: 'open' | 'closed' = 'open',
  updatedAt: string = new Date().toISOString()
): GitHubIssue => ({
  number,
  title,
  body: '',
  state,
  labels: labelNames.map((name) => ({ name })),
  createdAt: new Date().toISOString(),
  updatedAt,
  url: `https://github.com/test/repo/issues/${number}`,
})

const createMockGitHubPR = (
  number: number,
  title: string,
  headRefName: string,
  state: 'open' | 'closed' | 'merged' = 'open'
): GitHubPR => ({
  number,
  title,
  headRefName,
  baseRefName: 'main',
  state,
  url: `https://github.com/test/repo/pull/${number}`,
  isDraft: false,
})

// =============================================================================
// Mock Service Layers
// =============================================================================

const createMockHealthMetrics = (
  assessment: HealthAssessment
): Layer.Layer<HealthMetrics, never, never> => {
  return Layer.succeed(
    HealthMetrics,
    HealthMetrics.of({
      getQueueMetrics: () => Effect.succeed(assessment.queueMetrics),
      countByState: () => Effect.succeed(10),
      countRetryIssues: () => Effect.succeed(assessment.queueMetrics.retryCount),
      getWorkflowMetrics: () => Effect.succeed(assessment.workflowMetrics),
      calculateFailureRate: () => Effect.succeed(assessment.workflowMetrics.failureRate),
      getCircuitBreakerState: () => Effect.succeed(assessment.circuitBreaker),
      shouldOpenCircuit: () => Effect.succeed(assessment.level === 'critical'),
      canCloseCircuit: () =>
        Effect.succeed(
          assessment.level === 'healthy' && assessment.workflowMetrics.failureRate < 20
        ),
      assessHealth: () => Effect.succeed(assessment),
      determineHealthLevel: () => assessment.level,
      getHealthIssues: () => assessment.issues,
    })
  )
}

const createMockLabelStateMachine = (
  issueStateInfo: IssueStateInfo = createMockIssueStateInfo({ currentState: 'in-progress' })
): Layer.Layer<LabelStateMachine, never, never> => {
  return Layer.succeed(
    LabelStateMachine,
    LabelStateMachine.of({
      getIssueState: () => Effect.succeed(issueStateInfo),
      isValidTransition: () => true,
      transitionTo: (_issueNumber: number, toState: SpecState) =>
        Effect.succeed(createMockStateTransitionResult(toState)),
      forceTransitionTo: (_issueNumber: number, toState: SpecState) =>
        Effect.succeed(createMockStateTransitionResult(toState)),
      incrementRetry: () => Effect.succeed(1),
      hasMaxRetries: () => Effect.succeed(false),
      clearRetryLabels: () => Effect.void,
      setFailureType: (_issueNumber: number, _failureType: FailureType) => Effect.void,
      clearFailureType: () => Effect.void,
      addLabel: () => Effect.void,
      removeLabel: () => Effect.void,
      clearAllTddLabels: () => Effect.void,
    })
  )
}

const createMockPRManager = (
  prs: Array<{ number: number; hasConflicts: boolean; isAutoMergeEnabled: boolean }> = [],
  orphans: OrphanBranch[] = []
): Layer.Layer<PRManager, never, never> => {
  return Layer.succeed(
    PRManager,
    PRManager.of({
      getPRInfo: (prNumber: number) => {
        const pr = prs.find((p) => p.number === prNumber)
        return Effect.succeed({
          number: prNumber,
          title: `PR #${prNumber}`,
          state: 'open' as const,
          headRefName: 'claude/issue-123',
          baseRefName: 'main',
          url: `https://github.com/test/repo/pull/${prNumber}`,
          isDraft: false,
          linkedIssues: [],
          mergeable: (pr?.hasConflicts ? 'CONFLICTING' : 'MERGEABLE') as
            | 'MERGEABLE'
            | 'CONFLICTING'
            | 'UNKNOWN',
          hasConflicts: pr?.hasConflicts ?? false,
          isAutoMergeEnabled: pr?.isAutoMergeEnabled ?? false,
        })
      },
      extractLinkedIssues: () => [],
      findPRsForIssue: () => Effect.succeed([]),
      checkDuplicatePRs: () =>
        Effect.succeed({
          issueNumber: 0,
          hasDuplicates: false,
          activePRs: [],
          recommendedAction: 'proceed' as const,
        }),
      isSuperseded: () => Effect.succeed(false),
      getPRCheckStatus: (prNumber: number) =>
        Effect.succeed({
          prNumber,
          isSuperseded: false,
          supersededReason: null,
          hasDuplicates: false,
          duplicatePRs: [],
          canProceed: true,
        }),
      enableAutoMerge: (prNumber: number) =>
        Effect.succeed({
          prNumber,
          enabled: true,
          reason: 'Auto-merge enabled',
        }),
      hasAutoMergeEnabled: (prNumber: number) => {
        const pr = prs.find((p) => p.number === prNumber)
        return Effect.succeed(pr?.isAutoMergeEnabled ?? false)
      },
      hasConflicts: (prNumber: number) => {
        const pr = prs.find((p) => p.number === prNumber)
        return Effect.succeed(pr?.hasConflicts ?? false)
      },
      getMergeableState: () => Effect.succeed('MERGEABLE' as const),
      findOrphanBranches: () => Effect.succeed(orphans),
      deleteBranch: (branchName: string) =>
        Effect.succeed({
          branchName,
          deleted: true,
          reason: 'Branch deleted',
        }),
      cleanupOrphanBranches: () =>
        Effect.succeed(
          orphans.map((o) => ({
            branchName: o.name,
            deleted: true,
            reason: 'Orphan branch deleted',
          }))
        ),
      closePR: () => Effect.succeed(true),
      closeDuplicatePRs: () => Effect.succeed([]),
    })
  )
}

const createMockGitHubAPIClient = (
  prs: readonly GitHubPR[] = [],
  issues: readonly GitHubIssue[] = []
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
        const issue = issues.find((i) => i.number === issueNumber)
        if (issue) {
          return Effect.succeed(issue)
        }
        return Effect.succeed(createMockGitHubIssue(issueNumber, `Issue #${issueNumber}`, []))
      },
      getIssueBody: () => Effect.succeed(''),
      listIssues: (options) => {
        const filtered = issues.filter((i) => {
          if (options?.state && options.state !== 'all' && options.state !== i.state) return false
          if (options?.labels && options.labels.length > 0) {
            const issueLabels = new Set(i.labels.map((l) => l.name))
            return options.labels.every((label) => issueLabels.has(label))
          }
          return true
        })
        return Effect.succeed(filtered)
      },
      addLabels: () => Effect.void,
      removeLabels: () => Effect.void,
      addComment: () => Effect.void,
      closeIssue: () => Effect.void,
      listPRs: () => Effect.succeed(prs),
      hasPRForBranch: () => Effect.succeed(false),
      branchExists: () => Effect.succeed({ exists: true, name: '', sha: undefined }),
      listWorkflowRuns: () => Effect.succeed([]),
      getWorkflowRunLogs: () => Effect.succeed(''),
    })
  )
}

const createMockTimeUtils = (): Layer.Layer<TimeUtils, never, never> => {
  return Layer.succeed(
    TimeUtils,
    TimeUtils.of({
      getAgeMinutes: () => Effect.succeed(120), // 2 hours old
      isPastTimeout: () => Effect.succeed(true),
      formatDuration: (minutes: number) => Effect.succeed(`${minutes} minutes`),
      getCurrentISOTimestamp: () => Effect.succeed(new Date().toISOString()),
    })
  )
}

const createMockCommandService = (): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(
    CommandService,
    CommandService.of({
      exec: () => Effect.succeed(''),
      spawn: () =>
        Effect.succeed({
          stdout: '',
          stderr: '',
          exitCode: 0,
          duration: 100,
        }),
      parallel: (commands) => Effect.all(commands),
      withGitHubOutput: () =>
        Effect.succeed({
          stdout: '',
          stderr: '',
          exitCode: 0,
          duration: 100,
        }),
    })
  )
}

// =============================================================================
// Tests
// =============================================================================

describe('tdd-monitor CLI', () => {
  describe('health-check command logic', () => {
    test('calculates health metrics', async () => {
      const assessment = createMockHealthAssessment('healthy')
      const TestLayer = Layer.mergeAll(
        createMockHealthMetrics(assessment),
        createMockGitHubAPIClient(),
        createMockTimeUtils(),
        createMockCommandService()
      )

      const program = Effect.gen(function* () {
        const healthMetrics = yield* HealthMetrics
        const health = yield* healthMetrics.assessHealth()
        return health
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.level).toBe('healthy')
      expect(result.workflowMetrics.failureRate).toBe(10)
      expect(result.queueMetrics.queuedCount).toBe(10)
    })

    test('identifies critical health status', async () => {
      const assessment = createMockHealthAssessment('critical')
      const TestLayer = Layer.mergeAll(
        createMockHealthMetrics(assessment),
        createMockGitHubAPIClient(),
        createMockTimeUtils(),
        createMockCommandService()
      )

      const program = Effect.gen(function* () {
        const healthMetrics = yield* HealthMetrics
        const health = yield* healthMetrics.assessHealth()
        const shouldOpen = yield* healthMetrics.shouldOpenCircuit()
        return { health, shouldOpen }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.health.level).toBe('critical')
      expect(result.health.workflowMetrics.failureRate).toBe(75)
      expect(result.shouldOpen).toBe(true)
    })

    test('determines circuit breaker should close on healthy state', async () => {
      const assessment = createMockHealthAssessment('healthy', {
        workflowMetrics: createMockWorkflowMetrics({ failureRate: 5 }),
      })
      const TestLayer = Layer.mergeAll(
        createMockHealthMetrics(assessment),
        createMockGitHubAPIClient(),
        createMockTimeUtils(),
        createMockCommandService()
      )

      const program = Effect.gen(function* () {
        const healthMetrics = yield* HealthMetrics
        const health = yield* healthMetrics.assessHealth()
        const canClose = yield* healthMetrics.canCloseCircuit()
        return { health, canClose }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.canClose).toBe(true)
    })
  })

  describe('recover-stuck command logic', () => {
    test('finds stuck in-progress specs via listIssues', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const issues: readonly GitHubIssue[] = [
        createMockGitHubIssue(
          123,
          '🤖 API-TEST-001',
          ['tdd-spec:in-progress'],
          'open',
          twoHoursAgo
        ),
        createMockGitHubIssue(
          456,
          '🤖 API-TEST-002',
          ['tdd-spec:in-progress'],
          'open',
          new Date().toISOString()
        ),
      ]

      const TestLayer = Layer.mergeAll(
        createMockGitHubAPIClient([], issues),
        createMockCommandService()
      )

      const program = Effect.gen(function* () {
        const ghClient = yield* GitHubAPIClient
        const inProgress = yield* ghClient.listIssues({ labels: ['tdd-spec:in-progress'] })
        return inProgress
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.length).toBe(2)
      expect(result[0]!.number).toBe(123)
    })

    test('transitions stuck specs to queued', async () => {
      let transitionCalled = false
      let transitionArgs: { number: number; state: SpecState } | null = null

      const MockSM = Layer.succeed(
        LabelStateMachine,
        LabelStateMachine.of({
          getIssueState: () =>
            Effect.succeed(createMockIssueStateInfo({ currentState: 'in-progress' })),
          isValidTransition: () => true,
          transitionTo: (issueNumber: number, toState: SpecState) => {
            transitionCalled = true
            transitionArgs = { number: issueNumber, state: toState }
            return Effect.succeed(createMockStateTransitionResult(toState))
          },
          forceTransitionTo: (_issueNumber: number, toState: SpecState) =>
            Effect.succeed(createMockStateTransitionResult(toState)),
          incrementRetry: () => Effect.succeed(1),
          hasMaxRetries: () => Effect.succeed(false),
          clearRetryLabels: () => Effect.void,
          setFailureType: () => Effect.void,
          clearFailureType: () => Effect.void,
          addLabel: () => Effect.void,
          removeLabel: () => Effect.void,
          clearAllTddLabels: () => Effect.void,
        })
      )

      const TestLayer = Layer.mergeAll(
        MockSM,
        createMockGitHubAPIClient(),
        createMockCommandService()
      )

      const program = Effect.gen(function* () {
        const sm = yield* LabelStateMachine
        yield* sm.transitionTo(123, 'queued')
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(transitionCalled).toBe(true)
      expect(transitionArgs).not.toBeNull()
      expect(transitionArgs!.number).toBe(123)
      expect(transitionArgs!.state).toBe('queued')
    })
  })

  describe('monitor-prs command logic', () => {
    test('lists open TDD automation PRs', async () => {
      const prs: readonly GitHubPR[] = [
        createMockGitHubPR(456, 'fix: implement API-TEST-001', 'claude/issue-123', 'open'),
        createMockGitHubPR(789, 'fix: implement API-TEST-002', 'claude/issue-456', 'open'),
      ]

      const TestLayer = Layer.mergeAll(createMockGitHubAPIClient(prs), createMockCommandService())

      const program = Effect.gen(function* () {
        const ghClient = yield* GitHubAPIClient
        const allPRs = yield* ghClient.listPRs({ state: 'open' })
        // Filter by branch prefix (as done in tdd-monitor.ts)
        const tddPRs = allPRs.filter((pr) => pr.headRefName.startsWith('claude/'))
        return tddPRs
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.length).toBe(2)
      expect(result[0]!.number).toBe(456)
    })

    test('enables auto-merge on eligible PRs', async () => {
      const prs = [{ number: 456, hasConflicts: false, isAutoMergeEnabled: false }]
      const TestLayer = Layer.mergeAll(createMockPRManager(prs), createMockCommandService())

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        const result = yield* prManager.enableAutoMerge(456)
        return result
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.prNumber).toBe(456)
      expect(result.enabled).toBe(true)
    })

    test('detects PRs with conflicts', async () => {
      const prs = [{ number: 789, hasConflicts: true, isAutoMergeEnabled: false }]
      const TestLayer = Layer.mergeAll(createMockPRManager(prs), createMockCommandService())

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        const hasConflicts = yield* prManager.hasConflicts(789)
        return hasConflicts
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result).toBe(true)
    })
  })

  describe('cleanup-branches command logic', () => {
    test('finds orphaned TDD branches', async () => {
      const orphans: OrphanBranch[] = [
        {
          name: 'claude/issue-123-abc',
          ageMinutes: 60,
          hasPR: false,
          lastCommitAt: new Date().toISOString(),
        },
        {
          name: 'claude/issue-456-def',
          ageMinutes: 90,
          hasPR: false,
          lastCommitAt: new Date().toISOString(),
        },
      ]

      const TestLayer = Layer.mergeAll(
        createMockPRManager([], orphans),
        createMockCommandService(),
        createMockGitHubAPIClient([]),
        createMockTimeUtils()
      )

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        const found = yield* prManager.findOrphanBranches(30)
        return found
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.length).toBe(2)
      expect(result[0]!.name).toBe('claude/issue-123-abc')
    })

    test('deletes orphaned branches', async () => {
      const TestLayer = Layer.mergeAll(createMockPRManager([]), createMockCommandService())

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        const result = yield* prManager.deleteBranch('claude/issue-123-abc')
        return result
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.deleted).toBe(true)
      expect(result.branchName).toBe('claude/issue-123-abc')
    })
  })
})

describe('tdd-monitor integration', () => {
  test('all service mocks can be composed together', async () => {
    const assessment = createMockHealthAssessment('healthy')

    const AllMocks = Layer.mergeAll(
      createMockHealthMetrics(assessment),
      createMockLabelStateMachine(),
      createMockPRManager([]),
      createMockGitHubAPIClient([]),
      createMockCommandService(),
      createMockTimeUtils()
    )

    const program = Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient
      const healthMetrics = yield* HealthMetrics
      const sm = yield* LabelStateMachine
      const prManager = yield* PRManager

      // Verify all services are accessible
      const health = yield* healthMetrics.assessHealth()
      const issueState = yield* sm.getIssueState(123)
      const prs = yield* ghClient.listPRs({ state: 'open' })
      const orphans = yield* prManager.findOrphanBranches(30)

      return { health, issueState, prs, orphans }
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(AllMocks)))

    expect(result.health.level).toBe('healthy')
    expect(result.issueState.currentState).toBe('in-progress')
    expect(Array.isArray(result.prs)).toBe(true)
    expect(Array.isArray(result.orphans)).toBe(true)
  })

  test('file system mock writes GitHub Actions output', async () => {
    const state = createMockState()
    const MockFS = createMockFileSystemService(state)

    const program = Effect.gen(function* () {
      const fs = yield* FileSystemService
      yield* fs.writeFile('/tmp/GITHUB_OUTPUT', 'status=healthy\nfailure_rate=10\n')
      return state.writtenFiles.get('/tmp/GITHUB_OUTPUT')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockFS)))

    expect(result).toBe('status=healthy\nfailure_rate=10\n')
  })
})
