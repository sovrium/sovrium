/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CommandService } from '../../lib/effect'
import { GitHubAPIClient, type GitHubPR } from './github-api-client'
import {
  PRManager,
  PRManagerLive,
  PROperationError,
  BranchOperationError,
  // Pure helper functions
  extractLinkedIssuesFromBody,
  isTddBranch,
  extractIssueFromBranch,
  parseMergeableState,
  determineRecommendedAction,
  sortPRsByRecency,
  // Constants
  LINKED_ISSUE_REGEX,
  TDD_BRANCH_PREFIX,
  ORPHAN_BRANCH_AGE_MINUTES,
  TDD_PR_LABELS,
} from './pr-manager'

// =============================================================================
// Mock Helpers
// =============================================================================

interface MockCommandState {
  responses: Map<string, string>
}

const createMockCommandService = (
  state: MockCommandState
): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(
    CommandService,
    CommandService.of({
      exec: (command: string) => {
        // Find matching command response
        for (const [pattern, response] of state.responses.entries()) {
          if (command.includes(pattern)) {
            return Effect.succeed(response)
          }
        }
        return Effect.succeed('')
      },
      spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
      parallel: (commands) => Effect.all(commands, { concurrency: 'unbounded' }),
      withGitHubOutput: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
    })
  )
}

// Default command layer for tests that don't need command responses
const defaultCommandLayer = createMockCommandService({ responses: new Map() })

interface MockGitHubState {
  prs: ReadonlyArray<GitHubPR>
  branchExists: Map<string, boolean>
}

const createMockGitHubClient = (
  state: MockGitHubState
): Layer.Layer<GitHubAPIClient, never, never> => {
  return Layer.succeed(
    GitHubAPIClient,
    GitHubAPIClient.of({
      checkRateLimit: () =>
        Effect.succeed({ remaining: 5000, limit: 5000, resetTimestamp: 0, resetDate: new Date() }),
      ensureRateLimit: () => Effect.succeed(true),
      listIssues: () => Effect.succeed([]),
      getIssue: () =>
        Effect.succeed({
          number: 1,
          title: 'Test',
          state: 'open',
          body: null,
          labels: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          url: 'https://github.com/test/repo/issues/1',
        }),
      getIssueBody: () => Effect.succeed(''),
      addLabels: () => Effect.void,
      removeLabels: () => Effect.void,
      addComment: () => Effect.void,
      closeIssue: () => Effect.void,
      listPRs: (options?: { state?: string; head?: string; base?: string; limit?: number }) => {
        let filtered = state.prs
        if (options?.head) {
          filtered = filtered.filter((pr) => pr.headRefName === options.head)
        }
        if (options?.state && options.state !== 'all') {
          filtered = filtered.filter((pr) => pr.state === options.state)
        }
        return Effect.succeed(filtered)
      },
      hasPRForBranch: (branchName: string) => {
        const hasPR = state.prs.some((pr) => pr.headRefName === branchName)
        return Effect.succeed(hasPR)
      },
      branchExists: (branchName: string) => {
        const exists = state.branchExists.get(branchName) ?? false
        return Effect.succeed({ exists, name: branchName, sha: exists ? 'abc123' : undefined })
      },
      listWorkflowRuns: () => Effect.succeed([]),
      getWorkflowRunLogs: () => Effect.succeed(''),
    })
  )
}

// =============================================================================
// Test Data Helpers
// =============================================================================

const createTestPR = (overrides: Partial<GitHubPR> = {}): GitHubPR => ({
  number: 100,
  title: 'Test PR',
  state: 'open',
  headRefName: 'claude/issue-123-1704067200',
  baseRefName: 'main',
  url: 'https://github.com/test/repo/pull/100',
  isDraft: false,
  ...overrides,
})

// =============================================================================
// Pure Helper Function Tests
// =============================================================================

describe('pr-manager pure helpers', () => {
  describe('extractLinkedIssuesFromBody', () => {
    test('extracts "Closes #N" pattern', () => {
      const body = 'Closes #123'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([123])
    })

    test('extracts "Fixes #N" pattern', () => {
      const body = 'Fixes #456'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([456])
    })

    test('extracts "Resolves #N" pattern', () => {
      const body = 'Resolves #789'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([789])
    })

    test('extracts multiple linked issues', () => {
      const body = 'Closes #123, Fixes #456, and Resolves #789'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([123, 456, 789])
    })

    test('handles case-insensitive patterns', () => {
      const body = 'CLOSES #100, fixes #200, Resolves #300'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([100, 200, 300])
    })

    test('deduplicates repeated issue numbers', () => {
      const body = 'Closes #123, Also fixes #123'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([123])
    })

    test('returns empty array for body without linked issues', () => {
      const body = 'This is a regular PR with no linked issues'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([])
    })

    test('returns empty array for empty body', () => {
      const issues = extractLinkedIssuesFromBody('')
      expect(issues).toEqual([])
    })

    test('handles plural forms (close vs closes)', () => {
      const body = 'Close #100, Fix #200, Resolve #300'
      const issues = extractLinkedIssuesFromBody(body)
      expect(issues).toEqual([100, 200, 300])
    })
  })

  describe('isTddBranch', () => {
    test('returns true for valid TDD branch', () => {
      expect(isTddBranch('claude/issue-123-1704067200')).toBe(true)
    })

    test('returns true for TDD branch with simple format', () => {
      expect(isTddBranch('claude/issue-1-abc')).toBe(true)
    })

    test('returns false for main branch', () => {
      expect(isTddBranch('main')).toBe(false)
    })

    test('returns false for feature branch', () => {
      expect(isTddBranch('feature/add-login')).toBe(false)
    })

    test('returns false for similar but incorrect prefix', () => {
      expect(isTddBranch('claude-issue-123')).toBe(false)
    })
  })

  describe('extractIssueFromBranch', () => {
    test('extracts issue number from standard TDD branch', () => {
      expect(extractIssueFromBranch('claude/issue-123-1704067200')).toBe(123)
    })

    test('extracts issue number from simple TDD branch', () => {
      expect(extractIssueFromBranch('claude/issue-42-abc')).toBe(42)
    })

    test('extracts large issue numbers', () => {
      expect(extractIssueFromBranch('claude/issue-9999-timestamp')).toBe(9999)
    })

    test('returns null for non-TDD branch', () => {
      expect(extractIssueFromBranch('main')).toBe(null)
    })

    test('returns null for malformed TDD branch', () => {
      expect(extractIssueFromBranch('claude/issue-')).toBe(null)
    })

    test('returns null for branch without issue number', () => {
      expect(extractIssueFromBranch('claude/issue-abc-timestamp')).toBe(null)
    })
  })

  describe('parseMergeableState', () => {
    test('parses MERGEABLE state', () => {
      expect(parseMergeableState('MERGEABLE')).toBe('MERGEABLE')
    })

    test('parses CONFLICTING state', () => {
      expect(parseMergeableState('CONFLICTING')).toBe('CONFLICTING')
    })

    test('returns UNKNOWN for null', () => {
      expect(parseMergeableState(null)).toBe('UNKNOWN')
    })

    test('returns UNKNOWN for unrecognized state', () => {
      expect(parseMergeableState('UNKNOWN_STATE')).toBe('UNKNOWN')
    })

    test('returns UNKNOWN for empty string', () => {
      expect(parseMergeableState('')).toBe('UNKNOWN')
    })
  })

  describe('determineRecommendedAction', () => {
    test('returns proceed when no active PRs', () => {
      expect(determineRecommendedAction([])).toBe('proceed')
    })

    test('returns skip when one active PR exists', () => {
      const prs = [createTestPR({ number: 100 })]
      expect(determineRecommendedAction(prs)).toBe('skip')
    })

    test('returns close_duplicates when multiple active PRs exist', () => {
      const prs = [createTestPR({ number: 100 }), createTestPR({ number: 101 })]
      expect(determineRecommendedAction(prs)).toBe('close_duplicates')
    })
  })

  describe('sortPRsByRecency', () => {
    test('sorts PRs by timestamp (newest first)', () => {
      const prs = [
        createTestPR({ number: 1, headRefName: 'claude/issue-123-1704067200' }),
        createTestPR({ number: 2, headRefName: 'claude/issue-123-1704153600' }),
        createTestPR({ number: 3, headRefName: 'claude/issue-123-1704000000' }),
      ]

      const sorted = sortPRsByRecency(prs)

      expect(sorted[0]?.number).toBe(2) // 1704153600 (newest)
      expect(sorted[1]?.number).toBe(1) // 1704067200
      expect(sorted[2]?.number).toBe(3) // 1704000000 (oldest)
    })

    test('handles single PR', () => {
      const prs = [createTestPR({ number: 1 })]
      const sorted = sortPRsByRecency(prs)
      expect(sorted).toHaveLength(1)
      expect(sorted[0]?.number).toBe(1)
    })

    test('handles empty array', () => {
      const sorted = sortPRsByRecency([])
      expect(sorted).toEqual([])
    })

    test('does not mutate original array', () => {
      const prs = [
        createTestPR({ number: 1, headRefName: 'claude/issue-123-a' }),
        createTestPR({ number: 2, headRefName: 'claude/issue-123-z' }),
      ]
      const original = [...prs]

      sortPRsByRecency(prs)

      expect(prs[0]?.number).toBe(original[0]?.number)
      expect(prs[1]?.number).toBe(original[1]?.number)
    })
  })
})

// =============================================================================
// Constants Tests
// =============================================================================

describe('pr-manager constants', () => {
  test('LINKED_ISSUE_REGEX matches expected patterns', () => {
    const testCases = [
      { input: 'Closes #123', expected: true },
      { input: 'fixes #456', expected: true },
      { input: 'Resolves #789', expected: true },
      { input: 'Close #100', expected: true },
      { input: 'just mentions #123', expected: false },
    ]

    for (const { input, expected } of testCases) {
      LINKED_ISSUE_REGEX.lastIndex = 0 // Reset regex state
      expect(LINKED_ISSUE_REGEX.test(input)).toBe(expected)
    }
  })

  test('TDD_BRANCH_PREFIX is correct', () => {
    expect(TDD_BRANCH_PREFIX).toBe('claude/issue-')
  })

  test('ORPHAN_BRANCH_AGE_MINUTES has reasonable default', () => {
    expect(ORPHAN_BRANCH_AGE_MINUTES).toBe(30)
  })

  test('TDD_PR_LABELS are defined', () => {
    expect(TDD_PR_LABELS.automation).toBe('tdd-automation')
    expect(TDD_PR_LABELS.autoMerge).toBe('auto-merge')
  })
})

// =============================================================================
// Error Type Tests
// =============================================================================

describe('pr-manager errors', () => {
  describe('PROperationError', () => {
    test('creates error with operation and message', () => {
      const error = new PROperationError('getPRInfo', 'PR not found')
      expect(error._tag).toBe('PROperationError')
      expect(error.operation).toBe('getPRInfo')
      expect(error.message).toContain('PR not found')
      expect(error.message).toContain('getPRInfo')
      expect(error.name).toBe('PROperationError')
    })

    test('stores cause when provided', () => {
      const cause = new Error('Network error')
      const error = new PROperationError('enableAutoMerge', 'Failed', cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe('BranchOperationError', () => {
    test('creates error with operation, branch, and message', () => {
      const error = new BranchOperationError(
        'deleteBranch',
        'claude/issue-123-abc',
        'Branch not found'
      )
      expect(error._tag).toBe('BranchOperationError')
      expect(error.operation).toBe('deleteBranch')
      expect(error.branchName).toBe('claude/issue-123-abc')
      expect(error.message).toContain('Branch not found')
      expect(error.message).toContain('deleteBranch')
      expect(error.name).toBe('BranchOperationError')
    })
  })
})

// =============================================================================
// Service Method Tests
// =============================================================================

describe('PRManager service', () => {
  describe('extractLinkedIssues (service method)', () => {
    test('delegates to pure helper function', () => {
      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return prManager.extractLinkedIssues('Closes #123, Fixes #456')
      }).pipe(Effect.provide(PRManagerLive))

      const result = Effect.runSync(program)
      expect(result).toEqual([123, 456])
    })
  })

  describe('getPRInfo', () => {
    test('returns extended PR information', async () => {
      const mockPRResponse = JSON.stringify({
        number: 100,
        title: 'Test PR',
        state: 'open',
        headRefName: 'claude/issue-123-timestamp',
        baseRefName: 'main',
        url: 'https://github.com/test/repo/pull/100',
        isDraft: false,
        body: 'Closes #123',
        mergeable: 'MERGEABLE',
        autoMergeRequest: null,
      })

      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr view 100', mockPRResponse]]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.getPRInfo(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.number).toBe(100)
      expect(result.title).toBe('Test PR')
      expect(result.state).toBe('open')
      expect(result.linkedIssues).toEqual([123])
      expect(result.mergeable).toBe('MERGEABLE')
      expect(result.hasConflicts).toBe(false)
      expect(result.isAutoMergeEnabled).toBe(false)
    })

    test('detects conflicts from CONFLICTING state', async () => {
      const mockPRResponse = JSON.stringify({
        number: 100,
        title: 'Test PR',
        state: 'open',
        headRefName: 'claude/issue-123-timestamp',
        baseRefName: 'main',
        url: 'https://github.com/test/repo/pull/100',
        isDraft: false,
        body: '',
        mergeable: 'CONFLICTING',
        autoMergeRequest: null,
      })

      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr view 100', mockPRResponse]]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.getPRInfo(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.mergeable).toBe('CONFLICTING')
      expect(result.hasConflicts).toBe(true)
    })

    test('detects auto-merge enabled', async () => {
      const mockPRResponse = JSON.stringify({
        number: 100,
        title: 'Test PR',
        state: 'open',
        headRefName: 'claude/issue-123-timestamp',
        baseRefName: 'main',
        url: 'https://github.com/test/repo/pull/100',
        isDraft: false,
        body: '',
        mergeable: 'MERGEABLE',
        autoMergeRequest: { enabledAt: '2025-01-01T00:00:00Z' },
      })

      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr view 100', mockPRResponse]]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.getPRInfo(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.isAutoMergeEnabled).toBe(true)
    })
  })

  describe('findPRsForIssue', () => {
    test('finds PRs by branch name pattern', async () => {
      const mockPRs = [
        createTestPR({ number: 100, headRefName: 'claude/issue-123-timestamp1' }),
        createTestPR({ number: 101, headRefName: 'claude/issue-456-timestamp2' }),
        createTestPR({ number: 102, headRefName: 'claude/issue-123-timestamp3' }),
      ]

      const ghLayer = createMockGitHubClient({
        prs: mockPRs,
        branchExists: new Map(),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.findPRsForIssue(123)
      }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, defaultCommandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toHaveLength(2)
      expect(result.map((pr) => pr.number)).toContain(100)
      expect(result.map((pr) => pr.number)).toContain(102)
    })

    test('returns empty array when no PRs found', async () => {
      const ghLayer = createMockGitHubClient({
        prs: [],
        branchExists: new Map(),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.findPRsForIssue(999)
      }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, defaultCommandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toEqual([])
    })
  })

  describe('checkDuplicatePRs', () => {
    test('returns no duplicates when no PRs exist', async () => {
      const ghLayer = createMockGitHubClient({
        prs: [],
        branchExists: new Map(),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.checkDuplicatePRs(123)
      }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, defaultCommandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.issueNumber).toBe(123)
      expect(result.hasDuplicates).toBe(false)
      expect(result.activePRs).toEqual([])
      expect(result.recommendedAction).toBe('proceed')
    })

    test('returns skip when one PR exists', async () => {
      const mockPRs = [createTestPR({ number: 100, headRefName: 'claude/issue-123-timestamp' })]

      const ghLayer = createMockGitHubClient({
        prs: mockPRs,
        branchExists: new Map(),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.checkDuplicatePRs(123)
      }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, defaultCommandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.hasDuplicates).toBe(false)
      expect(result.activePRs).toHaveLength(1)
      expect(result.recommendedAction).toBe('skip')
    })

    test('returns duplicates when multiple PRs exist', async () => {
      const mockPRs = [
        createTestPR({ number: 100, headRefName: 'claude/issue-123-timestamp1' }),
        createTestPR({ number: 101, headRefName: 'claude/issue-123-timestamp2' }),
      ]

      const ghLayer = createMockGitHubClient({
        prs: mockPRs,
        branchExists: new Map(),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.checkDuplicatePRs(123)
      }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, defaultCommandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.hasDuplicates).toBe(true)
      expect(result.activePRs).toHaveLength(2)
      expect(result.recommendedAction).toBe('close_duplicates')
    })
  })

  describe('isSuperseded', () => {
    test('returns true for empty diff', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr diff 100', '']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.isSuperseded(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe(true)
    })

    test('returns false for non-empty diff', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr diff 100', 'diff --git a/file.ts b/file.ts\n+new line']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.isSuperseded(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe(false)
    })
  })

  describe('enableAutoMerge', () => {
    test('returns success when auto-merge enabled', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr merge 100', 'Auto-merge enabled']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.enableAutoMerge(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.prNumber).toBe(100)
      expect(result.enabled).toBe(true)
      expect(result.reason).toContain('successfully')
    })

    test('returns failure when auto-merge not allowed', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr merge 100', 'FAILED: auto-merge is not allowed']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.enableAutoMerge(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.prNumber).toBe(100)
      expect(result.enabled).toBe(false)
      expect(result.reason).toContain('not enabled')
    })
  })

  describe('hasConflicts', () => {
    test('returns true for CONFLICTING state', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr view 100 --json mergeable', 'CONFLICTING']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.hasConflicts(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe(true)
    })

    test('returns false for MERGEABLE state', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr view 100 --json mergeable', 'MERGEABLE']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.hasConflicts(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe(false)
    })
  })

  describe('getMergeableState', () => {
    test('parses MERGEABLE state', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr view 100 --json mergeable', 'MERGEABLE']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.getMergeableState(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe('MERGEABLE')
    })

    test('returns UNKNOWN for empty response', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['gh pr view 100 --json mergeable', '']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.getMergeableState(100)
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe('UNKNOWN')
    })
  })

  describe('deleteBranch', () => {
    test('returns success when branch deleted', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['git push origin --delete', 'Deleted branch']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.deleteBranch('claude/issue-123-timestamp')
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.branchName).toBe('claude/issue-123-timestamp')
      expect(result.deleted).toBe(true)
      expect(result.reason).toContain('successfully')
    })

    test('returns failure when branch not found', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([['git push origin --delete', 'FAILED: not found']]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.deleteBranch('claude/issue-123-timestamp')
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result.deleted).toBe(false)
      expect(result.reason).toContain('not found')
    })
  })

  describe('closePR', () => {
    test('returns true when PR closed successfully', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([
          ['gh pr comment 100', ''],
          ['gh pr close 100', 'Closed'],
        ]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.closePR(100, 'Superseded by newer PR')
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe(true)
    })

    test('returns false when PR close fails', async () => {
      const commandLayer = createMockCommandService({
        responses: new Map([
          ['gh pr comment 100', ''],
          ['gh pr close 100', 'FAILED'],
        ]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.closePR(100, 'Reason')
      }).pipe(Effect.provide(Layer.merge(PRManagerLive, commandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toBe(false)
    })
  })

  describe('closeDuplicatePRs', () => {
    test('closes older duplicate PRs keeping newest', async () => {
      const mockPRs = [
        createTestPR({ number: 100, headRefName: 'claude/issue-123-1704067200' }),
        createTestPR({ number: 101, headRefName: 'claude/issue-123-1704153600' }), // newer
        createTestPR({ number: 102, headRefName: 'claude/issue-123-1704000000' }), // oldest
      ]

      const ghLayer = createMockGitHubClient({
        prs: mockPRs,
        branchExists: new Map(),
      })

      const commandLayer = createMockCommandService({
        responses: new Map([
          ['gh pr comment', ''],
          ['gh pr close', 'Closed'],
        ]),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.closeDuplicatePRs(123)
      }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, commandLayer)))

      const result = await Effect.runPromise(program)

      // Should close PRs 100 and 102, keeping 101 (newest)
      expect(result).toHaveLength(2)
      expect(result).toContain(100)
      expect(result).toContain(102)
      expect(result).not.toContain(101)
    })

    test('returns empty array when no duplicates', async () => {
      const mockPRs = [createTestPR({ number: 100, headRefName: 'claude/issue-123-timestamp' })]

      const ghLayer = createMockGitHubClient({
        prs: mockPRs,
        branchExists: new Map(),
      })

      const program = Effect.gen(function* () {
        const prManager = yield* PRManager
        return yield* prManager.closeDuplicatePRs(123)
      }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, defaultCommandLayer)))

      const result = await Effect.runPromise(program)

      expect(result).toEqual([])
    })
  })
})

// =============================================================================
// Integration Tests (Service Composition)
// =============================================================================

describe('PRManager integration', () => {
  test('getPRCheckStatus combines isSuperseded and checkDuplicatePRs', async () => {
    const mockPRResponse = JSON.stringify({
      number: 100,
      title: 'Test PR',
      state: 'open',
      headRefName: 'claude/issue-123-timestamp',
      baseRefName: 'main',
      url: 'https://github.com/test/repo/pull/100',
      isDraft: false,
      body: 'Closes #123',
      mergeable: 'MERGEABLE',
      autoMergeRequest: null,
    })

    const mockPRs = [createTestPR({ number: 100, headRefName: 'claude/issue-123-timestamp' })]

    const ghLayer = createMockGitHubClient({
      prs: mockPRs,
      branchExists: new Map(),
    })

    const commandLayer = createMockCommandService({
      responses: new Map([
        ['gh pr diff 100', 'diff --git a/file.ts b/file.ts\n+new line'],
        ['gh pr view 100', mockPRResponse],
      ]),
    })

    const program = Effect.gen(function* () {
      const prManager = yield* PRManager
      return yield* prManager.getPRCheckStatus(100)
    }).pipe(Effect.provide(Layer.mergeAll(PRManagerLive, ghLayer, commandLayer)))

    const result = await Effect.runPromise(program)

    expect(result.prNumber).toBe(100)
    expect(result.isSuperseded).toBe(false)
    expect(result.hasDuplicates).toBe(false)
    expect(result.canProceed).toBe(true)
  })
})
