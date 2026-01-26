/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CommandService, CommandFailedError } from '../../lib/effect'
import {
  BranchVerifier,
  BranchVerifierLive,
  CLAUDE_BRANCH_PREFIX,
  CLAUDE_BRANCH_REGEX,
  parseClaudeBranchIssueNumber,
  matchesClaudeBranchPattern,
  buildClaudeBranchPattern,
  parseGitLsRemoteOutput,
} from './branch-verifier'
import { GitHubAPIClient, type BranchCheckResult } from './github-api-client'

// =============================================================================
// Mock Helpers
// =============================================================================

/**
 * Create a mock CommandService that responds based on command patterns
 */
const createMockCommandService = (
  responses: Record<string, string | Error>
): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(
    CommandService,
    CommandService.of({
      exec: (command: string) => {
        for (const [pattern, response] of Object.entries(responses)) {
          if (command.includes(pattern)) {
            if (response instanceof Error) {
              return Effect.fail(
                new CommandFailedError({
                  command,
                  exitCode: 1,
                  stderr: response.message,
                  stdout: '',
                })
              )
            }
            return Effect.succeed(response)
          }
        }
        return Effect.succeed('')
      },
      spawn: () =>
        Effect.succeed({
          stdout: '',
          stderr: '',
          exitCode: 0,
          duration: 0,
        }),
      parallel: (commands) => Effect.all(commands),
      withGitHubOutput: () =>
        Effect.succeed({
          stdout: '',
          stderr: '',
          exitCode: 0,
          duration: 0,
        }),
    })
  )
}

/**
 * Create a mock GitHubAPIClient
 */
const createMockGitHubAPIClient = (options: {
  branchExists?: boolean
  issueState?: 'open' | 'closed'
  hasPR?: boolean
}): Layer.Layer<GitHubAPIClient, never, never> => {
  return Layer.succeed(
    GitHubAPIClient,
    GitHubAPIClient.of({
      checkRateLimit: () =>
        Effect.succeed({
          remaining: 5000,
          limit: 5000,
          resetTimestamp: Date.now() / 1000 + 3600,
          resetDate: new Date(Date.now() + 3_600_000),
        }),
      ensureRateLimit: () => Effect.succeed(true),
      listIssues: () => Effect.succeed([]),
      getIssue: (issueNumber) =>
        Effect.succeed({
          number: issueNumber,
          title: `Issue #${issueNumber}`,
          state: options.issueState ?? 'open',
          body: null,
          labels: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          url: `https://github.com/owner/repo/issues/${issueNumber}`,
        }),
      getIssueBody: () => Effect.succeed('Issue body'),
      addLabels: () => Effect.void,
      removeLabels: () => Effect.void,
      addComment: () => Effect.void,
      closeIssue: () => Effect.void,
      listPRs: () => Effect.succeed([]),
      hasPRForBranch: () => Effect.succeed(options.hasPR ?? false),
      branchExists: (name) =>
        Effect.succeed({
          exists: options.branchExists ?? false,
          name,
          sha: options.branchExists ? 'abc123' : undefined,
        } as BranchCheckResult),
      listWorkflowRuns: () => Effect.succeed([]),
      getWorkflowRunLogs: () => Effect.succeed(''),
    })
  )
}

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('parseClaudeBranchIssueNumber', () => {
  it('should parse issue number from valid Claude branch name', () => {
    expect(parseClaudeBranchIssueNumber('claude/issue-123-fix-bug')).toBe(123)
    expect(parseClaudeBranchIssueNumber('claude/issue-1-simple')).toBe(1)
    expect(parseClaudeBranchIssueNumber('claude/issue-99999-long-number')).toBe(99_999)
  })

  it('should return null for non-Claude branches', () => {
    expect(parseClaudeBranchIssueNumber('main')).toBeNull()
    expect(parseClaudeBranchIssueNumber('feature/my-feature')).toBeNull()
    expect(parseClaudeBranchIssueNumber('fix/issue-123')).toBeNull()
  })

  it('should return null for malformed Claude branches', () => {
    expect(parseClaudeBranchIssueNumber('claude/issue-')).toBeNull()
    expect(parseClaudeBranchIssueNumber('claude/issue-abc')).toBeNull()
    expect(parseClaudeBranchIssueNumber('claude/')).toBeNull()
  })
})

describe('matchesClaudeBranchPattern', () => {
  it('should match Claude branch pattern', () => {
    expect(matchesClaudeBranchPattern('claude/issue-123-fix')).toBe(true)
    expect(matchesClaudeBranchPattern('claude/issue-1-')).toBe(true)
    expect(matchesClaudeBranchPattern('claude/issue-99999-something')).toBe(true)
  })

  it('should not match non-Claude branches', () => {
    expect(matchesClaudeBranchPattern('main')).toBe(false)
    expect(matchesClaudeBranchPattern('feature/claude-branch')).toBe(false)
    expect(matchesClaudeBranchPattern('claudes/issue-123')).toBe(false)
  })
})

describe('buildClaudeBranchPattern', () => {
  it('should build correct pattern for issue number', () => {
    expect(buildClaudeBranchPattern(123)).toBe('claude/issue-123-')
    expect(buildClaudeBranchPattern(1)).toBe('claude/issue-1-')
    expect(buildClaudeBranchPattern(99_999)).toBe('claude/issue-99999-')
  })
})

describe('parseGitLsRemoteOutput', () => {
  it('should parse valid git ls-remote output', () => {
    const output = `abc123def456\trefs/heads/main
789abc012def\trefs/heads/feature/test`

    const result = parseGitLsRemoteOutput(output)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      sha: 'abc123def456',
      ref: 'refs/heads/main',
      name: 'main',
    })
    expect(result[1]).toEqual({
      sha: '789abc012def',
      ref: 'refs/heads/feature/test',
      name: 'feature/test',
    })
  })

  it('should return empty array for empty output', () => {
    expect(parseGitLsRemoteOutput('')).toEqual([])
    expect(parseGitLsRemoteOutput('   ')).toEqual([])
  })

  it('should filter out invalid lines', () => {
    const output = `abc123\trefs/heads/valid
invalid-line-without-tab
\trefs/heads/no-sha`

    const result = parseGitLsRemoteOutput(output)

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('valid')
  })
})

describe('Constants', () => {
  it('should have correct CLAUDE_BRANCH_PREFIX', () => {
    expect(CLAUDE_BRANCH_PREFIX).toBe('claude/issue-')
  })

  it('should have correct CLAUDE_BRANCH_REGEX', () => {
    const regex = CLAUDE_BRANCH_REGEX
    expect(regex.test('claude/issue-123-fix')).toBe(true)
    expect(regex.test('main')).toBe(false)
  })
})

// =============================================================================
// Service Tests
// =============================================================================

describe('BranchVerifier Service', () => {
  describe('verifyBranchExists', () => {
    it('should return exists=true when git ls-remote finds branch', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote --heads origin "refs/heads/main"': 'abc123def456\trefs/heads/main',
        'cut -f1': 'abc123def456',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.verifyBranchExists('main')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result.exists).toBe(true)
      expect(result.verificationMethod).toBe('git-ls-remote')
    })

    it('should fallback to API when git ls-remote fails', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': '', // git ls-remote returns empty
        'gh api repos/:owner/:repo/branches/main': 'main\nabc123',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.verifyBranchExists('main')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result.exists).toBe(true)
      expect(result.verificationMethod).toBe('github-api')
    })

    it('should return exists=false when branch not found', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': '',
        'gh api': '',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.verifyBranchExists('nonexistent-branch')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result.exists).toBe(false)
      expect(result.verificationMethod).toBe('none')
    })
  })

  describe('branchExistsViaGit', () => {
    it('should return true when branch exists', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': 'abc123\trefs/heads/main',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.branchExistsViaGit('main')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result).toBe(true)
    })

    it('should return false when branch does not exist', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': '',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.branchExistsViaGit('nonexistent')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result).toBe(false)
    })
  })

  describe('findClaudeBranches', () => {
    it('should find matching Claude branches for an issue', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote --heads origin "refs/heads/claude/issue-123-*"': `abc123\trefs/heads/claude/issue-123-fix-bug
def456\trefs/heads/claude/issue-123-retry-1`,
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.findClaudeBranches(123)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result.exists).toBe(true)
      expect(result.branches).toHaveLength(2)
      expect(result.branches).toContain('claude/issue-123-fix-bug')
      expect(result.branches).toContain('claude/issue-123-retry-1')
    })

    it('should return empty result when no branches found', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': '',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.findClaudeBranches(999)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result.exists).toBe(false)
      expect(result.branches).toHaveLength(0)
      expect(result.latestBranch).toBeNull()
    })

    it('should return the latest branch', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote --heads origin "refs/heads/claude/issue-123-*"': `abc123\trefs/heads/claude/issue-123-1737849600
def456\trefs/heads/claude/issue-123-1737849700`,
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.findClaudeBranches(123)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result.latestBranch).toBe('claude/issue-123-1737849700')
    })
  })

  describe('getClaudeBranchPattern', () => {
    it('should return correct pattern', async () => {
      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return verifier.getClaudeBranchPattern(123)
      })

      const result = await Effect.runPromise(Effect.provide(program, BranchVerifierLive))

      expect(result).toBe('claude/issue-123-')
    })
  })

  describe('extractIssueNumber', () => {
    it('should extract issue number from Claude branch', async () => {
      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return verifier.extractIssueNumber('claude/issue-456-fix')
      })

      const result = await Effect.runPromise(Effect.provide(program, BranchVerifierLive))

      expect(result).toBe(456)
    })

    it('should return null for non-Claude branches', async () => {
      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return verifier.extractIssueNumber('main')
      })

      const result = await Effect.runPromise(Effect.provide(program, BranchVerifierLive))

      expect(result).toBeNull()
    })
  })

  describe('isClaudeBranch', () => {
    it('should return true for Claude branches', async () => {
      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return verifier.isClaudeBranch('claude/issue-123-fix')
      })

      const result = await Effect.runPromise(Effect.provide(program, BranchVerifierLive))

      expect(result).toBe(true)
    })

    it('should return false for non-Claude branches', async () => {
      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return verifier.isClaudeBranch('feature/my-feature')
      })

      const result = await Effect.runPromise(Effect.provide(program, BranchVerifierLive))

      expect(result).toBe(false)
    })
  })

  describe('getBranchSha', () => {
    it('should return SHA for existing branch', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': 'abc123def456',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.getBranchSha('main')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result).toBe('abc123def456')
    })

    it('should return null for non-existing branch', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': '',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.getBranchSha('nonexistent')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(BranchVerifierLive, mockCmd))
      )

      expect(result).toBeNull()
    })
  })

  describe('isOrphanedBranch', () => {
    it('should detect orphaned branch when issue is closed', async () => {
      const mockCmd = createMockCommandService({})
      const mockGh = createMockGitHubAPIClient({
        issueState: 'closed',
        hasPR: false,
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.isOrphanedBranch('claude/issue-123-fix')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
      )

      expect(result.isOrphaned).toBe(true)
      expect(result.reason).toBe('issue-closed')
      expect(result.issueNumber).toBe(123)
    })

    it('should detect orphaned branch when PR is merged', async () => {
      const mockCmd = createMockCommandService({})
      const mockGh = createMockGitHubAPIClient({
        issueState: 'closed',
        hasPR: true,
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.isOrphanedBranch('claude/issue-123-fix')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
      )

      expect(result.isOrphaned).toBe(true)
      expect(result.reason).toBe('pr-merged')
    })

    it('should not consider branch orphaned when issue is open', async () => {
      const mockCmd = createMockCommandService({})
      const mockGh = createMockGitHubAPIClient({
        issueState: 'open',
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.isOrphanedBranch('claude/issue-123-fix')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
      )

      expect(result.isOrphaned).toBe(false)
      expect(result.reason).toBe('not-orphaned')
    })

    it('should not consider non-Claude branches as orphaned', async () => {
      const mockCmd = createMockCommandService({})
      const mockGh = createMockGitHubAPIClient({})

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.isOrphanedBranch('feature/my-feature')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
      )

      expect(result.isOrphaned).toBe(false)
      expect(result.reason).toBe('not-orphaned')
    })
  })

  describe('listOrphanedBranches', () => {
    it('should list all orphaned branches', async () => {
      const mockCmd = createMockCommandService({
        [`git ls-remote --heads origin "refs/heads/claude/issue-*"`]: `abc123\trefs/heads/claude/issue-100-fix
def456\trefs/heads/claude/issue-200-update`,
      })
      const mockGh = createMockGitHubAPIClient({
        issueState: 'closed',
        hasPR: false,
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.listOrphanedBranches()
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
      )

      expect(result).toHaveLength(2)
      expect(result).toContain('claude/issue-100-fix')
      expect(result).toContain('claude/issue-200-update')
    })

    it('should return empty array when no orphaned branches', async () => {
      const mockCmd = createMockCommandService({
        'git ls-remote': '',
      })
      const mockGh = createMockGitHubAPIClient({})

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.listOrphanedBranches()
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
      )

      expect(result).toHaveLength(0)
    })
  })

  describe('branchExistsViaAPI', () => {
    it('should check branch via GitHubAPIClient', async () => {
      const mockCmd = createMockCommandService({})
      const mockGh = createMockGitHubAPIClient({
        branchExists: true,
      })

      const program = Effect.gen(function* () {
        const verifier = yield* BranchVerifier
        return yield* verifier.branchExistsViaAPI('main')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
      )

      expect(result.exists).toBe(true)
      expect(result.name).toBe('main')
    })
  })
})

// =============================================================================
// Integration-Style Tests
// =============================================================================

describe('BranchVerifier Integration', () => {
  it('should verify Claude branch workflow', async () => {
    // Simulate finding a Claude branch and checking its status
    const mockCmd = createMockCommandService({
      'git ls-remote --heads origin "refs/heads/claude/issue-123-*"':
        'abc123\trefs/heads/claude/issue-123-1737849600',
      'git ls-remote --heads origin "refs/heads/claude/issue-123-1737849600"':
        'abc123\trefs/heads/claude/issue-123-1737849600',
      'cut -f1': 'abc123',
    })
    const mockGh = createMockGitHubAPIClient({
      issueState: 'open',
    })

    const program = Effect.gen(function* () {
      const verifier = yield* BranchVerifier

      // Find branches for issue
      const searchResult = yield* verifier.findClaudeBranches(123)
      if (!searchResult.exists || !searchResult.latestBranch) {
        return { found: false }
      }

      // Verify the latest branch exists
      const verifyResult = yield* verifier.verifyBranchExists(searchResult.latestBranch)

      // Check if orphaned
      const orphanResult = yield* verifier.isOrphanedBranch(searchResult.latestBranch)

      return {
        found: true,
        branchName: searchResult.latestBranch,
        branchExists: verifyResult.exists,
        isOrphaned: orphanResult.isOrphaned,
      }
    })

    const result = await Effect.runPromise(
      Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
    )

    expect(result.found).toBe(true)
    expect(result.branchName).toBe('claude/issue-123-1737849600')
    expect(result.branchExists).toBe(true)
    expect(result.isOrphaned).toBe(false)
  })

  it('should handle stuck spec detection scenario', async () => {
    // Simulate checking if Claude pushed a branch for a stuck in-progress spec
    const mockCmd = createMockCommandService({
      'git ls-remote --heads origin "refs/heads/claude/issue-456-*"': '', // No branch found
    })
    const mockGh = createMockGitHubAPIClient({
      issueState: 'open',
    })

    const program = Effect.gen(function* () {
      const verifier = yield* BranchVerifier

      // Check if Claude created a branch for this issue
      const searchResult = yield* verifier.findClaudeBranches(456)

      // If no branch exists, spec might be stuck (Claude didn't push)
      return {
        branchCreated: searchResult.exists,
        branches: searchResult.branches,
      }
    })

    const result = await Effect.runPromise(
      Effect.provide(program, Layer.mergeAll(BranchVerifierLive, mockCmd, mockGh))
    )

    expect(result.branchCreated).toBe(false)
    expect(result.branches).toHaveLength(0)
  })
})
