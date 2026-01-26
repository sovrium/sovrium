/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import { CommandService } from '../../lib/effect'
import { GitHubAPIClient, type BranchCheckResult } from './github-api-client'

// =============================================================================
// Types
// =============================================================================

/**
 * Result of branch verification with multiple methods
 */
export interface BranchVerificationResult {
  /** Whether the branch exists (combined result) */
  readonly exists: boolean

  /** The branch name found (if exists) */
  readonly branchName: string | null

  /** Commit SHA of the branch head (if available) */
  readonly commitSha: string | null

  /** Which method successfully found the branch */
  readonly verificationMethod: 'git-ls-remote' | 'github-api' | 'none'

  /** Whether the methods agree (for debugging) */
  readonly consistent: boolean
}

/**
 * Result of finding Claude-created branches for an issue
 */
export interface ClaudeBranchSearchResult {
  /** Whether any Claude branch exists for this issue */
  readonly exists: boolean

  /** List of matching branch names */
  readonly branches: ReadonlyArray<string>

  /** The most recent branch (by naming convention) */
  readonly latestBranch: string | null
}

/**
 * Orphaned branch detection result
 */
export interface OrphanedBranchResult {
  /** Whether the branch is orphaned (exists but issue is closed/merged) */
  readonly isOrphaned: boolean

  /** Reason for orphan status */
  readonly reason: 'issue-closed' | 'pr-merged' | 'no-associated-issue' | 'not-orphaned'

  /** Associated issue number (if found) */
  readonly issueNumber: number | null
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when branch verification fails
 */
export class BranchVerificationError extends Error {
  readonly _tag = 'BranchVerificationError' as const

  constructor(
    readonly operation: string,
    override readonly message: string,
    override readonly cause?: unknown
  ) {
    super(`Branch verification error in ${operation}: ${message}`)
    this.name = 'BranchVerificationError'
  }
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Claude-created branch pattern prefix
 */
export const CLAUDE_BRANCH_PREFIX = 'claude/issue-'

/**
 * Regular expression to extract issue number from Claude branch name
 */
export const CLAUDE_BRANCH_REGEX = /^claude\/issue-(\d+)-/

// =============================================================================
// Service Interface
// =============================================================================

/**
 * BranchVerifier service for verifying git branch existence and state.
 *
 * Provides multiple verification methods for reliability:
 * - git ls-remote (primary, most reliable)
 * - GitHub API (fallback)
 *
 * Also provides utilities for:
 * - Finding Claude-created branches for issues
 * - Detecting orphaned branches
 * - Extracting issue numbers from branch names
 */
export interface BranchVerifier {
  // =========================================================================
  // Branch Existence
  // =========================================================================

  /**
   * Verify if a branch exists using multiple methods.
   * Uses git ls-remote as primary, GitHub API as fallback.
   *
   * @param branchName - Full branch name to check
   * @returns Verification result with details
   */
  readonly verifyBranchExists: (
    branchName: string
  ) => Effect.Effect<BranchVerificationResult, BranchVerificationError, CommandService>

  /**
   * Quick branch existence check using git ls-remote only.
   * Faster but may fail in some environments.
   *
   * @param branchName - Full branch name to check
   * @returns true if branch exists
   */
  readonly branchExistsViaGit: (
    branchName: string
  ) => Effect.Effect<boolean, BranchVerificationError, CommandService>

  /**
   * Branch existence check using GitHub API.
   * More reliable but requires API rate limit.
   *
   * @param branchName - Full branch name to check
   * @returns Branch check result with SHA
   */
  readonly branchExistsViaAPI: (
    branchName: string
  ) => Effect.Effect<BranchCheckResult, BranchVerificationError, CommandService | GitHubAPIClient>

  // =========================================================================
  // Claude Branch Operations
  // =========================================================================

  /**
   * Find Claude-created branches for an issue.
   * Searches for branches matching pattern: claude/issue-{number}-*
   *
   * @param issueNumber - Issue number to search for
   * @returns Search result with matching branches
   */
  readonly findClaudeBranches: (
    issueNumber: number
  ) => Effect.Effect<ClaudeBranchSearchResult, BranchVerificationError, CommandService>

  /**
   * Get the expected Claude branch pattern for an issue.
   *
   * @param issueNumber - Issue number
   * @returns Branch pattern prefix (e.g., "claude/issue-123-")
   */
  readonly getClaudeBranchPattern: (issueNumber: number) => string

  /**
   * Extract issue number from a Claude branch name.
   *
   * @param branchName - Branch name (e.g., "claude/issue-123-fix-bug")
   * @returns Issue number or null if not a Claude branch
   */
  readonly extractIssueNumber: (branchName: string) => number | null

  // =========================================================================
  // Orphaned Branch Detection
  // =========================================================================

  /**
   * Check if a branch is orphaned (exists but issue is closed/merged).
   *
   * @param branchName - Branch name to check
   * @returns Orphan detection result
   */
  readonly isOrphanedBranch: (
    branchName: string
  ) => Effect.Effect<
    OrphanedBranchResult,
    BranchVerificationError,
    CommandService | GitHubAPIClient
  >

  /**
   * List all orphaned Claude branches.
   * Useful for cleanup operations.
   *
   * @returns Array of orphaned branch names
   */
  readonly listOrphanedBranches: () => Effect.Effect<
    ReadonlyArray<string>,
    BranchVerificationError,
    CommandService | GitHubAPIClient
  >

  // =========================================================================
  // Branch Utilities
  // =========================================================================

  /**
   * Get the commit SHA of a branch head.
   *
   * @param branchName - Branch name
   * @returns Commit SHA or null if branch doesn't exist
   */
  readonly getBranchSha: (
    branchName: string
  ) => Effect.Effect<string | null, BranchVerificationError, CommandService>

  /**
   * Check if a branch is a Claude-created branch.
   *
   * @param branchName - Branch name to check
   * @returns true if matches Claude branch pattern
   */
  readonly isClaudeBranch: (branchName: string) => boolean
}

// =============================================================================
// Service Tag
// =============================================================================

export const BranchVerifier = Context.GenericTag<BranchVerifier>('BranchVerifier')

// =============================================================================
// Pure Helper Functions
// =============================================================================

/**
 * Parse issue number from Claude branch name
 */
export const parseClaudeBranchIssueNumber = (branchName: string): number | null => {
  const match = CLAUDE_BRANCH_REGEX.exec(branchName)
  if (!match || !match[1]) {
    return null
  }
  const parsed = parseInt(match[1], 10)
  return isNaN(parsed) ? null : parsed
}

/**
 * Check if a branch name matches Claude branch pattern
 */
export const matchesClaudeBranchPattern = (branchName: string): boolean => {
  return branchName.startsWith(CLAUDE_BRANCH_PREFIX)
}

/**
 * Build Claude branch pattern for an issue
 */
export const buildClaudeBranchPattern = (issueNumber: number): string => {
  return `${CLAUDE_BRANCH_PREFIX}${issueNumber}-`
}

/**
 * Parse git ls-remote output to extract branch info
 */
export const parseGitLsRemoteOutput = (
  output: string
): ReadonlyArray<{ sha: string; ref: string; name: string }> => {
  if (!output.trim()) {
    return []
  }

  return output
    .trim()
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [sha, ref] = line.split('\t')
      const name = ref?.replace('refs/heads/', '') ?? ''
      return { sha: sha ?? '', ref: ref ?? '', name }
    })
    .filter((entry) => entry.sha && entry.name)
}

// =============================================================================
// Service Implementation
// =============================================================================

const branchVerifierImpl: BranchVerifier = {
  // =========================================================================
  // Branch Existence
  // =========================================================================

  verifyBranchExists: (branchName) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      // Try git ls-remote first (most reliable)
      const gitResult = yield* branchVerifierImpl.branchExistsViaGit(branchName).pipe(
        Effect.map((exists) => ({ exists, method: 'git-ls-remote' as const })),
        Effect.catchAll(() => Effect.succeed({ exists: false, method: 'none' as const }))
      )

      let commitSha: string | null = null

      if (gitResult.exists) {
        // Get commit SHA
        const sha = yield* branchVerifierImpl
          .getBranchSha(branchName)
          .pipe(Effect.catchAll(() => Effect.succeed(null)))
        commitSha = sha
      }

      // If git ls-remote succeeded, return result
      if (gitResult.exists) {
        return {
          exists: true,
          branchName,
          commitSha,
          verificationMethod: 'git-ls-remote' as const,
          consistent: true,
        }
      }

      // Fallback to GitHub API
      const apiResult = yield* cmd
        .exec(
          `gh api repos/:owner/:repo/branches/${encodeURIComponent(branchName)} --jq '.name,.commit.sha' 2>/dev/null || echo ""`,
          { throwOnError: false }
        )
        .pipe(Effect.catchAll(() => Effect.succeed('')))

      const apiTrimmed = apiResult.trim()
      if (apiTrimmed) {
        const lines = apiTrimmed.split('\n')
        const apiName = lines[0] ?? null
        const apiSha = lines[1] ?? null

        return {
          exists: true,
          branchName: apiName ?? branchName,
          commitSha: apiSha,
          verificationMethod: 'github-api' as const,
          consistent: true,
        }
      }

      // Neither method found the branch
      return {
        exists: false,
        branchName: null,
        commitSha: null,
        verificationMethod: 'none' as const,
        consistent: true,
      }
    }),

  branchExistsViaGit: (branchName) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      // Use git ls-remote to check branch existence
      // This is the most reliable method and works without local clone
      const output = yield* cmd
        .exec(`git ls-remote --heads origin "refs/heads/${branchName}" 2>/dev/null || echo ""`, {
          throwOnError: false,
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new BranchVerificationError(
                'branchExistsViaGit',
                `Failed to check branch ${branchName}`,
                error
              )
            )
          )
        )

      // If output contains the branch name, it exists
      return output.trim().includes(branchName)
    }),

  branchExistsViaAPI: (branchName) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      return yield* ghClient
        .branchExists(branchName)
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new BranchVerificationError(
                'branchExistsViaAPI',
                `Failed to check branch ${branchName} via API`,
                error
              )
            )
          )
        )
    }),

  // =========================================================================
  // Claude Branch Operations
  // =========================================================================

  findClaudeBranches: (issueNumber) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const pattern = buildClaudeBranchPattern(issueNumber)

      // Use git ls-remote to find matching branches
      const output = yield* cmd
        .exec(`git ls-remote --heads origin "refs/heads/${pattern}*" 2>/dev/null || echo ""`, {
          throwOnError: false,
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new BranchVerificationError(
                'findClaudeBranches',
                `Failed to find branches for issue #${issueNumber}`,
                error
              )
            )
          )
        )

      const entries = parseGitLsRemoteOutput(output)
      const branches = entries.map((e) => e.name)

      // Sort branches to find the latest (by timestamp suffix)
      const sortedBranches = [...branches].sort().reverse()
      const latestBranch = sortedBranches[0] ?? null

      return {
        exists: branches.length > 0,
        branches,
        latestBranch,
      }
    }),

  getClaudeBranchPattern: (issueNumber) => buildClaudeBranchPattern(issueNumber),

  extractIssueNumber: (branchName) => parseClaudeBranchIssueNumber(branchName),

  // =========================================================================
  // Orphaned Branch Detection
  // =========================================================================

  isOrphanedBranch: (branchName) =>
    Effect.gen(function* () {
      // Check if it's a Claude branch
      if (!matchesClaudeBranchPattern(branchName)) {
        return {
          isOrphaned: false,
          reason: 'not-orphaned' as const,
          issueNumber: null,
        }
      }

      // Extract issue number
      const issueNumber = parseClaudeBranchIssueNumber(branchName)
      if (!issueNumber) {
        return {
          isOrphaned: true,
          reason: 'no-associated-issue' as const,
          issueNumber: null,
        }
      }

      // Check issue state
      const ghClient = yield* GitHubAPIClient

      const issue = yield* ghClient.getIssue(issueNumber).pipe(
        Effect.catchAll(() =>
          Effect.succeed({
            state: 'closed' as const,
            number: issueNumber,
            title: '',
            body: null,
            labels: [],
            createdAt: '',
            updatedAt: '',
            url: '',
          })
        )
      )

      if (issue.state === 'closed') {
        // Check if there's a merged PR for this branch
        const hasPR = yield* ghClient
          .hasPRForBranch(branchName)
          .pipe(Effect.catchAll(() => Effect.succeed(false)))

        return {
          isOrphaned: true,
          reason: hasPR ? ('pr-merged' as const) : ('issue-closed' as const),
          issueNumber,
        }
      }

      return {
        isOrphaned: false,
        reason: 'not-orphaned' as const,
        issueNumber,
      }
    }),

  listOrphanedBranches: () =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      // Get all Claude branches
      const output = yield* cmd
        .exec(
          `git ls-remote --heads origin "refs/heads/${CLAUDE_BRANCH_PREFIX}*" 2>/dev/null || echo ""`,
          { throwOnError: false }
        )
        .pipe(Effect.catchAll(() => Effect.succeed('')))

      const entries = parseGitLsRemoteOutput(output)
      const orphanedBranches: string[] = []

      // Check each branch for orphan status
      for (const entry of entries) {
        const result = yield* branchVerifierImpl.isOrphanedBranch(entry.name).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              isOrphaned: false,
              reason: 'not-orphaned' as const,
              issueNumber: null,
            })
          )
        )

        if (result.isOrphaned) {
          orphanedBranches.push(entry.name)
        }
      }

      return orphanedBranches
    }),

  // =========================================================================
  // Branch Utilities
  // =========================================================================

  getBranchSha: (branchName) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const output = yield* cmd
        .exec(`git ls-remote --heads origin "refs/heads/${branchName}" 2>/dev/null | cut -f1`, {
          throwOnError: false,
        })
        .pipe(Effect.catchAll(() => Effect.succeed('')))

      const sha = output.trim()
      return sha || null
    }),

  isClaudeBranch: (branchName) => matchesClaudeBranchPattern(branchName),
}

// =============================================================================
// Layer
// =============================================================================

export const BranchVerifierLive = Layer.succeed(
  BranchVerifier,
  BranchVerifier.of(branchVerifierImpl)
)
