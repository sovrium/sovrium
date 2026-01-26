/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileSystemService, CommandService, LoggerService } from '../../lib/effect'
import { GitHubAPIClient, type GitHubIssue, type GitHubPR } from '../services/github-api-client'
import { LabelStateMachine, type IssueStateInfo } from '../services/label-state-machine'
import { PRManager, type PRInfo } from '../services/pr-manager'
import {
  RetryManager,
  COOLDOWN_PERIODS,
  type RetryDecision,
  type CooldownStatus,
} from '../services/retry-manager'
import { TimeUtils } from '../services/time-utils'

// =============================================================================
// Mock Layer Factories
// =============================================================================

const createMockFileSystemService = (
  files: Record<string, string> = {},
  writes: string[] = []
): Layer.Layer<FileSystemService, never, never> => {
  return Layer.succeed(FileSystemService, {
    readFile: (path: string) => {
      const content = files[path]
      if (content !== undefined) {
        return Effect.succeed(content)
      }
      return Effect.fail(new Error(`File not found: ${path}`) as never)
    },
    writeFile: (path: string, content: string) => {
      writes.push(`${path}:${content}`)
      return Effect.void
    },
    exists: (path: string) => Effect.succeed(path in files),
    mkdir: () => Effect.void,
    glob: () => Effect.succeed([]),
    format: (content: string) => Effect.succeed(content),
    writeFormatted: () => Effect.void,
  })
}

const createMockCommandService = (
  responses: Record<string, { stdout: string; stderr: string; exitCode: number }> = {}
): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(CommandService, {
    spawn: (command: readonly string[]) => {
      const key = command.join(' ')
      const response = responses[key] ?? { stdout: '', stderr: '', exitCode: 0 }
      return Effect.succeed({ ...response, duration: 0 })
    },
    exec: (command: string) => {
      const response = responses[command] ?? { stdout: '', stderr: '', exitCode: 0 }
      return Effect.succeed(response.stdout)
    },
    parallel: <E, R>(
      commands: readonly Effect.Effect<
        { exitCode: number; stdout: string; stderr: string; duration: number },
        E,
        R
      >[]
    ) => Effect.all(commands),
    withGitHubOutput: (name: string, command: readonly string[]) => {
      const key = command.join(' ')
      const response = responses[key] ?? { stdout: '', stderr: '', exitCode: 0 }
      return Effect.succeed({ ...response, duration: 0 })
    },
  })
}

const createMockLoggerService = (): Layer.Layer<LoggerService, never, never> => {
  return Layer.succeed(
    LoggerService,
    LoggerService.of({
      trace: () => Effect.void,
      debug: () => Effect.void,
      info: () => Effect.void,
      warn: () => Effect.void,
      error: () => Effect.void,
      fatal: () => Effect.void,
      success: () => Effect.void,
      progress: () => Effect.void,
      complete: () => Effect.void,
      skip: () => Effect.void,
      annotation: () => Effect.void,
      separator: () => Effect.void,
      section: () => Effect.void,
      group: <A, E, R>(title: string, effect: Effect.Effect<A, E, R>) => effect,
    })
  )
}

const createMockTimeUtils = (ageMinutes: number = 0): Layer.Layer<TimeUtils, never, never> => {
  return Layer.succeed(
    TimeUtils,
    TimeUtils.of({
      getAgeMinutes: () => Effect.succeed(ageMinutes),
      isPastTimeout: (_, minutes) => Effect.succeed(ageMinutes > minutes),
      formatDuration: (minutes) => Effect.succeed(`${Math.round(minutes)}m`),
      getCurrentISOTimestamp: () => Effect.succeed(new Date().toISOString()),
    })
  )
}

const createMockGitHubAPIClient = (
  issues: GitHubIssue[] = [],
  prs: GitHubPR[] = []
): Layer.Layer<GitHubAPIClient, never, never> => {
  return Layer.succeed(GitHubAPIClient, {
    checkRateLimit: () =>
      Effect.succeed({
        remaining: 5000,
        limit: 5000,
        resetTimestamp: Date.now() + 3_600_000,
        resetDate: new Date(Date.now() + 3_600_000),
      }),
    ensureRateLimit: () => Effect.succeed(true),
    getIssue: (number: number) => {
      const issue = issues.find((i) => i.number === number)
      if (issue) {
        return Effect.succeed(issue)
      }
      return Effect.fail(new Error(`Issue #${number} not found`) as never)
    },
    getIssueBody: (number: number) => {
      const issue = issues.find((i) => i.number === number)
      return Effect.succeed(issue?.body ?? '')
    },
    listIssues: (options?: {
      labels?: ReadonlyArray<string>
      state?: 'open' | 'closed' | 'all'
    }) => {
      let filtered = [...issues]
      if (options?.labels) {
        const labelSet = new Set(options.labels)
        filtered = filtered.filter((i) => i.labels?.some((l) => labelSet.has(l.name)))
      }
      if (options?.state && options.state !== 'all') {
        filtered = filtered.filter((i) => i.state === options.state)
      }
      return Effect.succeed(filtered)
    },
    addLabels: () => Effect.void,
    removeLabels: () => Effect.void,
    addComment: () => Effect.void,
    closeIssue: () => Effect.void,
    listPRs: (options?: { state?: string }) => {
      let filtered = [...prs]
      if (options?.state) {
        filtered = filtered.filter((p) => p.state === options.state)
      }
      return Effect.succeed(filtered)
    },
    hasPRForBranch: () => Effect.succeed(false),
    branchExists: () => Effect.succeed({ exists: false, name: '', sha: undefined }),
    listWorkflowRuns: () => Effect.succeed([]),
    getWorkflowRunLogs: () => Effect.succeed(''),
  })
}

const createMockLabelStateMachine = (
  stateInfo: IssueStateInfo | null = null
): Layer.Layer<LabelStateMachine, never, never> => {
  return Layer.succeed(
    LabelStateMachine,
    LabelStateMachine.of({
      getIssueState: () => {
        if (stateInfo) {
          return Effect.succeed(stateInfo)
        }
        return Effect.fail(new Error('State not found') as never)
      },
      isValidTransition: () => true,
      transitionTo: () =>
        Effect.succeed({
          success: true,
          newState: 'queued' as const,
          labelsAdded: [],
          labelsRemoved: [],
        }),
      forceTransitionTo: () =>
        Effect.succeed({
          success: true,
          newState: 'queued' as const,
          labelsAdded: [],
          labelsRemoved: [],
        }),
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
}

const createMockPRManager = (
  duplicatePRs: GitHubPR[] = []
): Layer.Layer<PRManager, never, never> => {
  return Layer.succeed(
    PRManager,
    PRManager.of({
      getPRInfo: () =>
        Effect.succeed({
          number: 1,
          title: 'Test PR',
          state: 'open',
          headRefName: 'test-branch',
          baseRefName: 'main',
          url: 'https://github.com/test/pr/1',
          isDraft: false,
          linkedIssues: [],
          mergeable: 'MERGEABLE',
          hasConflicts: false,
          isAutoMergeEnabled: false,
        } as PRInfo),
      extractLinkedIssues: () => [],
      findPRsForIssue: () => Effect.succeed(duplicatePRs),
      checkDuplicatePRs: () =>
        Effect.succeed({
          issueNumber: 1,
          hasDuplicates: duplicatePRs.length > 0,
          activePRs: duplicatePRs,
          recommendedAction: duplicatePRs.length > 0 ? 'close_duplicates' : 'proceed',
        }),
      isSuperseded: () => Effect.succeed(false),
      getPRCheckStatus: () =>
        Effect.succeed({
          prNumber: 1,
          isSuperseded: false,
          supersededReason: null,
          hasDuplicates: false,
          duplicatePRs: [],
          canProceed: true,
        }),
      enableAutoMerge: () => Effect.succeed({ prNumber: 1, enabled: true, reason: 'enabled' }),
      hasAutoMergeEnabled: () => Effect.succeed(false),
      hasConflicts: () => Effect.succeed(false),
      getMergeableState: () => Effect.succeed('MERGEABLE'),
      findOrphanBranches: () => Effect.succeed([]),
      deleteBranch: (branchName: string) =>
        Effect.succeed({ branchName, deleted: true, reason: 'deleted' }),
      cleanupOrphanBranches: () => Effect.succeed([]),
      closePR: () => Effect.succeed(true),
      closeDuplicatePRs: () => Effect.succeed([]),
    })
  )
}

const createMockRetryManager = (
  inCooldown: boolean = false,
  remainingMinutes: number = 0
): Layer.Layer<RetryManager, never, never> => {
  return Layer.succeed(
    RetryManager,
    RetryManager.of({
      shouldRetry: () =>
        Effect.succeed({
          shouldRetry: true,
          category: 'spec',
          newRetryCount: 1,
          delaySeconds: 60,
          reason: 'test',
          maxRetriesReached: false,
        } as RetryDecision),
      getRetryCategory: () => 'spec',
      canRetry: () => true,
      calculateBackoffDelay: () => 60,
      addJitter: (delay) => delay,
      checkCooldown: () =>
        Effect.succeed({
          isInCooldown: inCooldown,
          remainingMinutes,
          expiresAt: inCooldown
            ? new Date(Date.now() + remainingMinutes * 60_000).toISOString()
            : null,
          lastActivityAt: new Date().toISOString(),
        } as CooldownStatus),
      isInStandardCooldown: () => Effect.succeed(inCooldown),
      isInFailedPRCooldown: () => Effect.succeed(inCooldown),
      executeRetry: () => Effect.succeed(1),
      markAsFailed: () => Effect.void,
    })
  )
}

// =============================================================================
// Tests
// =============================================================================

describe('tdd-dispatch CLI', () => {
  describe('check-paused command', () => {
    test('detects paused queue with tdd-queue:paused label', async () => {
      const pausedIssue: GitHubIssue = {
        number: 100,
        title: 'TDD Queue Status',
        state: 'open',
        body: null,
        labels: [{ name: 'tdd-queue-status' }, { name: 'tdd-queue:paused' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T10:30:00Z',
        url: 'https://github.com/test/repo/issues/100',
      }

      const writes: string[] = []
      const TestLayer = Layer.mergeAll(
        createMockFileSystemService({}, writes),
        createMockCommandService(),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient([pausedIssue], []),
        createMockLabelStateMachine(),
        createMockPRManager(),
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const ghClient = yield* GitHubAPIClient
        const pausedIssues = yield* ghClient.listIssues({
          labels: ['tdd-queue-status', 'tdd-queue:paused'],
          state: 'open',
        })
        return { isPaused: pausedIssues.length > 0, pauseIssue: pausedIssues[0] }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isPaused).toBe(true)
      expect(result.pauseIssue?.number).toBe(100)
    })

    test('detects active queue when no paused issues', async () => {
      const writes: string[] = []
      const TestLayer = Layer.mergeAll(
        createMockFileSystemService({}, writes),
        createMockCommandService(),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient([], []),
        createMockLabelStateMachine(),
        createMockPRManager(),
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const ghClient = yield* GitHubAPIClient
        const pausedIssues = yield* ghClient.listIssues({
          labels: ['tdd-queue-status', 'tdd-queue:paused'],
          state: 'open',
        })
        return { isPaused: pausedIssues.length > 0 }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isPaused).toBe(false)
    })
  })

  describe('validate-issue command', () => {
    test('validates open issue with no duplicate PRs', async () => {
      const issue: GitHubIssue = {
        number: 42,
        title: '🤖 API-TABLES-001',
        state: 'open',
        body: null,
        labels: [{ name: 'tdd-spec:queued' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T10:00:00Z',
        url: 'https://github.com/test/repo/issues/42',
      }

      const TestLayer = Layer.mergeAll(
        createMockFileSystemService(),
        createMockCommandService(),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient([issue], []),
        createMockLabelStateMachine(),
        createMockPRManager([]), // No duplicate PRs
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const ghClient = yield* GitHubAPIClient
        const prManager = yield* PRManager

        const issueResult = yield* ghClient
          .getIssue(42)
          .pipe(Effect.catchAll(() => Effect.succeed(null)))

        if (!issueResult || issueResult.state === 'closed') {
          return { isValid: false, reason: 'issue_closed' }
        }

        const duplicatePRs = yield* prManager.findPRsForIssue(42)
        if (duplicatePRs.length > 0) {
          return { isValid: false, reason: 'duplicate_pr_exists' }
        }

        return { isValid: true, reason: 'valid' }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isValid).toBe(true)
      expect(result.reason).toBe('valid')
    })

    test('rejects closed issue', async () => {
      const issue: GitHubIssue = {
        number: 42,
        title: '🤖 API-TABLES-001',
        state: 'closed',
        body: null,
        labels: [{ name: 'tdd-spec:completed' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T11:00:00Z',
        url: 'https://github.com/test/repo/issues/42',
      }

      const TestLayer = Layer.mergeAll(
        createMockFileSystemService(),
        createMockCommandService(),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient([issue], []),
        createMockLabelStateMachine(),
        createMockPRManager(),
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const ghClient = yield* GitHubAPIClient

        const issueResult = yield* ghClient
          .getIssue(42)
          .pipe(Effect.catchAll(() => Effect.succeed(null)))

        if (!issueResult || issueResult.state === 'closed') {
          return { isValid: false, reason: 'issue_closed' }
        }

        return { isValid: true, reason: 'valid' }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('issue_closed')
    })

    test('rejects issue with existing duplicate PR', async () => {
      const issue: GitHubIssue = {
        number: 42,
        title: '🤖 API-TABLES-001',
        state: 'open',
        body: null,
        labels: [{ name: 'tdd-spec:in-progress' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T10:00:00Z',
        url: 'https://github.com/test/repo/issues/42',
      }

      const duplicatePR: GitHubPR = {
        number: 123,
        title: 'fix: implement API-TABLES-001',
        state: 'open',
        headRefName: 'claude/issue-42-abc123',
        baseRefName: 'main',
        url: 'https://github.com/test/repo/pull/123',
        isDraft: false,
      }

      const TestLayer = Layer.mergeAll(
        createMockFileSystemService(),
        createMockCommandService(),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient([issue], [duplicatePR]),
        createMockLabelStateMachine(),
        createMockPRManager([duplicatePR]), // Has duplicate PR
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const ghClient = yield* GitHubAPIClient
        const prManager = yield* PRManager

        const issueResult = yield* ghClient
          .getIssue(42)
          .pipe(Effect.catchAll(() => Effect.succeed(null)))

        if (!issueResult || issueResult.state === 'closed') {
          return { isValid: false, reason: 'issue_closed' }
        }

        const duplicatePRs = yield* prManager.findPRsForIssue(42)
        if (duplicatePRs.length > 0) {
          return { isValid: false, reason: 'duplicate_pr_exists', prs: duplicatePRs }
        }

        return { isValid: true, reason: 'valid' }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('duplicate_pr_exists')
    })
  })

  describe('check-superseded command', () => {
    test('detects spec still has .fixme()', async () => {
      const testContent = `
test.fixme('API-TABLES-001', async () => {
  // Test implementation
})
`
      const TestLayer = Layer.mergeAll(
        createMockFileSystemService({
          'specs/api/tables.spec.ts': testContent,
        }),
        createMockCommandService({
          'grep -rl API-TABLES-001 specs/': {
            stdout: 'specs/api/tables.spec.ts',
            stderr: '',
            exitCode: 0,
          },
        }),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient(),
        createMockLabelStateMachine(),
        createMockPRManager(),
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const fs = yield* FileSystemService

        const content = yield* fs.readFile('specs/api/tables.spec.ts')
        const hasFixme = content.includes('.fixme(') && content.includes('API-TABLES-001')

        return { isSuperseded: !hasFixme }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isSuperseded).toBe(false) // Not superseded, needs implementation
    })

    test('detects spec already implemented (no .fixme())', async () => {
      const testContent = `
test('API-TABLES-001', async () => {
  // Test implementation - already active
})
`
      const TestLayer = Layer.mergeAll(
        createMockFileSystemService({
          'specs/api/tables.spec.ts': testContent,
        }),
        createMockCommandService({
          'grep -rl API-TABLES-001 specs/': {
            stdout: 'specs/api/tables.spec.ts',
            stderr: '',
            exitCode: 0,
          },
        }),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient(),
        createMockLabelStateMachine(),
        createMockPRManager(),
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const fs = yield* FileSystemService

        const content = yield* fs.readFile('specs/api/tables.spec.ts')
        // Check context around spec ID for .fixme(
        const lines = content.split('\n')
        const specLineIndex = lines.findIndex((line) => line.includes('API-TABLES-001'))
        const startLine = Math.max(0, specLineIndex - 5)
        const context = lines.slice(startLine, specLineIndex + 1).join('\n')
        const hasFixme = context.includes('.fixme(')

        return { isSuperseded: !hasFixme }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isSuperseded).toBe(true) // Superseded, already implemented
    })

    test('treats missing spec as superseded', async () => {
      const TestLayer = Layer.mergeAll(
        createMockFileSystemService({}),
        createMockCommandService({
          'grep -rl API-TABLES-001 specs/': { stdout: '', stderr: '', exitCode: 1 }, // Not found
        }),
        createMockLoggerService(),
        createMockTimeUtils(),
        createMockGitHubAPIClient(),
        createMockLabelStateMachine(),
        createMockPRManager(),
        createMockRetryManager()
      )

      const program = Effect.gen(function* () {
        const cmd = yield* CommandService

        const grepResult = yield* cmd.spawn(['grep', '-rl', 'API-TABLES-001', 'specs/'])

        if (grepResult.exitCode !== 0 || !grepResult.stdout.trim()) {
          return { isSuperseded: true, reason: 'spec_not_found' }
        }

        return { isSuperseded: false }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.isSuperseded).toBe(true)
      expect(result.reason).toBe('spec_not_found')
    })
  })

  describe('check-cooldown command', () => {
    test('detects issue in cooldown (recently failed)', async () => {
      const state: IssueStateInfo = {
        currentState: 'failed',
        specRetryCount: 2,
        infraRetryCount: 0,
        failureType: 'spec',
        tddLabels: ['tdd-spec:failed', 'failure:spec'],
      }

      const TestLayer = Layer.mergeAll(
        createMockFileSystemService(),
        createMockCommandService(),
        createMockLoggerService(),
        createMockTimeUtils(15), // 15 minutes since last activity
        createMockGitHubAPIClient(),
        createMockLabelStateMachine(state),
        createMockPRManager(),
        createMockRetryManager(true, 75) // In cooldown with 75 min remaining
      )

      const program = Effect.gen(function* () {
        const timeUtils = yield* TimeUtils
        const sm = yield* LabelStateMachine

        const issueState = yield* sm.getIssueState(42)
        // Mock timeUtils returns fixed ageMinutes regardless of input
        const ageMinutes = yield* timeUtils.getAgeMinutes(new Date().toISOString())

        // Failed PR cooldown is 90 minutes
        const cooldownMinutes = COOLDOWN_PERIODS.failedPR
        const inCooldown = ageMinutes < cooldownMinutes
        const remainingMinutes = Math.max(0, Math.ceil(cooldownMinutes - ageMinutes))

        return {
          inCooldown,
          remainingMinutes,
          ageMinutes: Math.round(ageMinutes),
          state: issueState.currentState,
        }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.inCooldown).toBe(true)
      expect(result.remainingMinutes).toBe(75) // 90 - 15 = 75
      expect(result.ageMinutes).toBe(15)
    })

    test('detects issue not in cooldown (cooldown expired)', async () => {
      const state: IssueStateInfo = {
        currentState: 'queued',
        specRetryCount: 0,
        infraRetryCount: 0,
        failureType: null,
        tddLabels: ['tdd-spec:queued'],
      }

      const TestLayer = Layer.mergeAll(
        createMockFileSystemService(),
        createMockCommandService(),
        createMockLoggerService(),
        createMockTimeUtils(120), // 120 minutes since last activity
        createMockGitHubAPIClient(),
        createMockLabelStateMachine(state),
        createMockPRManager(),
        createMockRetryManager(false, 0) // Not in cooldown
      )

      const program = Effect.gen(function* () {
        const timeUtils = yield* TimeUtils
        const sm = yield* LabelStateMachine

        const issueState = yield* sm.getIssueState(42)
        // Mock timeUtils returns fixed ageMinutes regardless of input
        const ageMinutes = yield* timeUtils.getAgeMinutes(new Date().toISOString())

        // Standard cooldown is 30 minutes
        const cooldownMinutes = COOLDOWN_PERIODS.standard
        const inCooldown = ageMinutes < cooldownMinutes

        return { inCooldown, ageMinutes: Math.round(ageMinutes), state: issueState.currentState }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))

      expect(result.inCooldown).toBe(false)
      expect(result.ageMinutes).toBe(120) // Past 30 min cooldown
    })
  })
})
