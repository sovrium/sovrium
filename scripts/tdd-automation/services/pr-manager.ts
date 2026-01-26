/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import { CommandService } from '../../lib/effect'
import { GitHubAPIClient, type GitHubPR } from './github-api-client'
import { TimeUtils } from './time-utils'

// =============================================================================
// Types
// =============================================================================

/**
 * Extended PR information with additional fields
 */
export interface PRInfo {
  readonly number: number
  readonly title: string
  readonly state: 'open' | 'closed' | 'merged'
  readonly headRefName: string
  readonly baseRefName: string
  readonly url: string
  readonly isDraft: boolean
  readonly linkedIssues: ReadonlyArray<number>
  readonly mergeable: MergeableState
  readonly hasConflicts: boolean
  readonly isAutoMergeEnabled: boolean
}

/**
 * PR mergeable states
 */
export type MergeableState = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'

/**
 * PR check status
 */
export interface PRCheckStatus {
  readonly prNumber: number
  readonly isSuperseded: boolean
  readonly supersededReason: string | null
  readonly hasDuplicates: boolean
  readonly duplicatePRs: ReadonlyArray<number>
  readonly canProceed: boolean
}

/**
 * Orphan branch information
 */
export interface OrphanBranch {
  readonly name: string
  readonly ageMinutes: number
  readonly hasPR: boolean
  readonly lastCommitAt: string | null
}

/**
 * Branch cleanup result
 */
export interface BranchCleanupResult {
  readonly branchName: string
  readonly deleted: boolean
  readonly reason: string
}

/**
 * Auto-merge result
 */
export interface AutoMergeResult {
  readonly prNumber: number
  readonly enabled: boolean
  readonly reason: string
}

/**
 * Duplicate PR detection result
 */
export interface DuplicatePRCheckResult {
  readonly issueNumber: number
  readonly hasDuplicates: boolean
  readonly activePRs: ReadonlyArray<GitHubPR>
  readonly recommendedAction: 'proceed' | 'close_duplicates' | 'skip'
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex to extract linked issue numbers from PR body
 * Matches: Closes #123, Fixes #456, Resolves #789, Close #100, Fix #200, Resolve #300
 */
export const LINKED_ISSUE_REGEX = /(?:close(?:s)?|fix(?:es)?|resolve(?:s)?)\s+#(\d+)/gi

/**
 * TDD automation branch prefix
 */
export const TDD_BRANCH_PREFIX = 'claude/issue-'

/**
 * Minimum age in minutes before a branch is considered orphaned
 */
export const ORPHAN_BRANCH_AGE_MINUTES = 30

/**
 * PR labels used by TDD automation
 */
export const TDD_PR_LABELS = {
  automation: 'tdd-automation',
  autoMerge: 'auto-merge',
} as const

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when PR operation fails
 */
export class PROperationError extends Error {
  readonly _tag = 'PROperationError' as const

  constructor(
    readonly operation: string,
    readonly details: string,
    override readonly cause?: unknown
  ) {
    super(`PR operation error in ${operation}: ${details}`)
    this.name = 'PROperationError'
  }
}

/**
 * Error when branch operation fails
 */
export class BranchOperationError extends Error {
  readonly _tag = 'BranchOperationError' as const

  constructor(
    readonly operation: string,
    readonly branchName: string,
    readonly details: string,
    override readonly cause?: unknown
  ) {
    super(`Branch operation error in ${operation} for '${branchName}': ${details}`)
    this.name = 'BranchOperationError'
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * PRManager service for managing PR lifecycle in TDD automation.
 *
 * Provides utilities for:
 * - Duplicate PR detection
 * - Auto-merge enablement
 * - Superseded PR detection (empty diff check)
 * - Orphaned branch detection and cleanup
 * - PR state checking (conflicts, mergeable status)
 * - Linked issue extraction
 */
export interface PRManager {
  // =========================================================================
  // PR Information
  // =========================================================================

  /**
   * Get extended PR information including linked issues and merge status.
   *
   * @param prNumber - PR number
   * @returns Extended PR information
   */
  readonly getPRInfo: (prNumber: number) => Effect.Effect<PRInfo, PROperationError, CommandService>

  /**
   * Extract linked issue numbers from PR body.
   *
   * @param prBody - PR body text
   * @returns Array of issue numbers
   */
  readonly extractLinkedIssues: (prBody: string) => ReadonlyArray<number>

  /**
   * Find PRs linked to a specific issue.
   *
   * @param issueNumber - Issue number to find PRs for
   * @returns Array of PRs linked to the issue
   */
  readonly findPRsForIssue: (
    issueNumber: number
  ) => Effect.Effect<ReadonlyArray<GitHubPR>, PROperationError, CommandService | GitHubAPIClient>

  // =========================================================================
  // Duplicate Detection
  // =========================================================================

  /**
   * Check for duplicate PRs for the same issue.
   *
   * @param issueNumber - Issue number to check
   * @returns Duplicate PR check result
   */
  readonly checkDuplicatePRs: (
    issueNumber: number
  ) => Effect.Effect<DuplicatePRCheckResult, PROperationError, CommandService | GitHubAPIClient>

  /**
   * Check if a PR is superseded (empty diff).
   *
   * @param prNumber - PR number to check
   * @returns true if PR has no meaningful changes
   */
  readonly isSuperseded: (
    prNumber: number
  ) => Effect.Effect<boolean, PROperationError, CommandService>

  /**
   * Get complete PR status check.
   *
   * @param prNumber - PR number to check
   * @returns Complete PR check status
   */
  readonly getPRCheckStatus: (
    prNumber: number
  ) => Effect.Effect<PRCheckStatus, PROperationError, CommandService | GitHubAPIClient>

  // =========================================================================
  // Auto-Merge
  // =========================================================================

  /**
   * Enable auto-merge on a PR.
   *
   * @param prNumber - PR number
   * @returns Auto-merge result
   */
  readonly enableAutoMerge: (
    prNumber: number
  ) => Effect.Effect<AutoMergeResult, PROperationError, CommandService>

  /**
   * Check if auto-merge is enabled on a PR.
   *
   * @param prNumber - PR number
   * @returns true if auto-merge is enabled
   */
  readonly hasAutoMergeEnabled: (
    prNumber: number
  ) => Effect.Effect<boolean, PROperationError, CommandService>

  // =========================================================================
  // Conflict Detection
  // =========================================================================

  /**
   * Check if a PR has merge conflicts.
   *
   * @param prNumber - PR number
   * @returns true if PR has conflicts
   */
  readonly hasConflicts: (
    prNumber: number
  ) => Effect.Effect<boolean, PROperationError, CommandService>

  /**
   * Get PR mergeable state.
   *
   * @param prNumber - PR number
   * @returns Mergeable state
   */
  readonly getMergeableState: (
    prNumber: number
  ) => Effect.Effect<MergeableState, PROperationError, CommandService>

  // =========================================================================
  // Branch Management
  // =========================================================================

  /**
   * Find orphaned TDD branches (branches with no associated PR).
   *
   * @param minAgeMinutes - Minimum age in minutes to consider a branch orphaned
   * @returns Array of orphan branches
   */
  readonly findOrphanBranches: (
    minAgeMinutes?: number
  ) => Effect.Effect<
    ReadonlyArray<OrphanBranch>,
    BranchOperationError,
    CommandService | GitHubAPIClient | TimeUtils
  >

  /**
   * Delete a remote branch.
   *
   * @param branchName - Branch name to delete
   * @returns Cleanup result
   */
  readonly deleteBranch: (
    branchName: string
  ) => Effect.Effect<BranchCleanupResult, BranchOperationError, CommandService>

  /**
   * Clean up orphaned TDD branches.
   *
   * @param minAgeMinutes - Minimum age in minutes
   * @returns Array of cleanup results
   */
  readonly cleanupOrphanBranches: (
    minAgeMinutes?: number
  ) => Effect.Effect<
    ReadonlyArray<BranchCleanupResult>,
    BranchOperationError,
    CommandService | GitHubAPIClient | TimeUtils
  >

  // =========================================================================
  // PR Actions
  // =========================================================================

  /**
   * Close a PR with a comment.
   *
   * @param prNumber - PR number
   * @param reason - Reason for closing
   * @returns true if closed successfully
   */
  readonly closePR: (
    prNumber: number,
    reason: string
  ) => Effect.Effect<boolean, PROperationError, CommandService>

  /**
   * Close duplicate PRs, keeping the most recent one.
   *
   * @param issueNumber - Issue number
   * @returns Array of closed PR numbers
   */
  readonly closeDuplicatePRs: (
    issueNumber: number
  ) => Effect.Effect<ReadonlyArray<number>, PROperationError, GitHubAPIClient | CommandService>
}

// =============================================================================
// Service Tag
// =============================================================================

export const PRManager = Context.GenericTag<PRManager>('PRManager')

// =============================================================================
// Pure Helper Functions
// =============================================================================

/**
 * Extract linked issue numbers from PR body text
 */
export const extractLinkedIssuesFromBody = (body: string): ReadonlyArray<number> => {
  const matches: number[] = []
  let match: RegExpExecArray | null

  // Reset regex state
  LINKED_ISSUE_REGEX.lastIndex = 0

  while ((match = LINKED_ISSUE_REGEX.exec(body)) !== null) {
    const issueNum = parseInt(match[1] ?? '', 10)
    if (!isNaN(issueNum) && !matches.includes(issueNum)) {
      matches.push(issueNum)
    }
  }

  return matches
}

/**
 * Check if a branch name is a TDD automation branch
 */
export const isTddBranch = (branchName: string): boolean => {
  return branchName.startsWith(TDD_BRANCH_PREFIX)
}

/**
 * Extract issue number from TDD branch name
 * Branch format: claude/issue-{number}-{timestamp}
 */
export const extractIssueFromBranch = (branchName: string): number | null => {
  const match = /^claude\/issue-(\d+)-/.exec(branchName)
  if (!match || !match[1]) {
    return null
  }
  return parseInt(match[1], 10)
}

/**
 * Parse mergeable state from GitHub API response
 */
export const parseMergeableState = (state: string | null): MergeableState => {
  if (state === 'MERGEABLE') return 'MERGEABLE'
  if (state === 'CONFLICTING') return 'CONFLICTING'
  return 'UNKNOWN'
}

/**
 * Determine recommended action for duplicate PRs
 */
export const determineRecommendedAction = (
  activePRs: ReadonlyArray<GitHubPR>
): 'proceed' | 'close_duplicates' | 'skip' => {
  if (activePRs.length === 0) return 'proceed'
  if (activePRs.length === 1) return 'skip' // Already has an active PR
  return 'close_duplicates' // Multiple PRs, need cleanup
}

/**
 * Sort PRs by creation date (newest first)
 * Assumes headRefName contains timestamp in format: claude/issue-{num}-{timestamp}
 */
export const sortPRsByRecency = (prs: ReadonlyArray<GitHubPR>): ReadonlyArray<GitHubPR> => {
  return [...prs].sort((a, b) => {
    // Extract timestamps from branch names
    const timestampA = a.headRefName.split('-').pop() ?? '0'
    const timestampB = b.headRefName.split('-').pop() ?? '0'
    // Sort descending (newest first)
    return timestampB.localeCompare(timestampA)
  })
}

// =============================================================================
// Service Implementation
// =============================================================================

const prManagerImpl: PRManager = {
  // =========================================================================
  // PR Information
  // =========================================================================

  getPRInfo: (prNumber) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const output = yield* cmd
        .exec(
          `gh pr view ${prNumber} --json number,title,state,headRefName,baseRefName,url,isDraft,body,mergeable,autoMergeRequest`,
          { throwOnError: false }
        )
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new PROperationError('getPRInfo', `Failed to get PR #${prNumber}`, error))
          )
        )

      const pr = yield* Effect.try({
        try: () =>
          JSON.parse(output) as {
            number: number
            title: string
            state: string
            headRefName: string
            baseRefName: string
            url: string
            isDraft: boolean
            body: string | null
            mergeable: string | null
            autoMergeRequest: { enabledAt: string } | null
          },
        catch: (error) => new PROperationError('getPRInfo', 'Failed to parse PR response', error),
      })

      const linkedIssues = extractLinkedIssuesFromBody(pr.body ?? '')
      const mergeableState = parseMergeableState(pr.mergeable)

      return {
        number: pr.number,
        title: pr.title,
        state: pr.state as 'open' | 'closed' | 'merged',
        headRefName: pr.headRefName,
        baseRefName: pr.baseRefName,
        url: pr.url,
        isDraft: pr.isDraft,
        linkedIssues,
        mergeable: mergeableState,
        hasConflicts: mergeableState === 'CONFLICTING',
        isAutoMergeEnabled: pr.autoMergeRequest !== null,
      }
    }),

  extractLinkedIssues: (prBody) => extractLinkedIssuesFromBody(prBody),

  findPRsForIssue: (issueNumber) =>
    Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      // Search for PRs that mention "Closes #N" or are on claude/issue-N-* branch
      const allPRs = yield* ghClient
        .listPRs({ state: 'open', limit: 100 })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new PROperationError(
                'findPRsForIssue',
                `Failed to list PRs for issue #${issueNumber}`,
                error
              )
            )
          )
        )

      // Filter PRs that are related to this issue
      const relatedPRs = allPRs.filter((pr) => {
        // Check if branch name matches
        const branchIssue = extractIssueFromBranch(pr.headRefName)
        if (branchIssue === issueNumber) return true

        // We can't check body here without additional API call
        // Branch name is the primary indicator for TDD PRs
        return false
      })

      return relatedPRs
    }),

  // =========================================================================
  // Duplicate Detection
  // =========================================================================

  checkDuplicatePRs: (issueNumber) =>
    Effect.gen(function* () {
      const activePRs = yield* prManagerImpl.findPRsForIssue(issueNumber)

      return {
        issueNumber,
        hasDuplicates: activePRs.length > 1,
        activePRs,
        recommendedAction: determineRecommendedAction(activePRs),
      }
    }),

  isSuperseded: (prNumber) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      // Check if PR has any meaningful diff
      const output = yield* cmd
        .exec(`gh pr diff ${prNumber} 2>/dev/null || echo ""`, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new PROperationError('isSuperseded', `Failed to get diff for PR #${prNumber}`, error)
            )
          )
        )

      // Empty diff means superseded
      return output.trim() === ''
    }),

  getPRCheckStatus: (prNumber) =>
    Effect.gen(function* () {
      const isSuperseded = yield* prManagerImpl.isSuperseded(prNumber)

      // Get PR info to find linked issue
      const prInfo = yield* prManagerImpl.getPRInfo(prNumber)

      // Check for duplicates using the first linked issue
      let hasDuplicates = false
      let duplicatePRs: ReadonlyArray<number> = []

      if (prInfo.linkedIssues.length > 0) {
        const issueNumber = prInfo.linkedIssues[0]
        if (issueNumber !== undefined) {
          const duplicateCheck = yield* prManagerImpl.checkDuplicatePRs(issueNumber)
          ;({ hasDuplicates } = duplicateCheck)
          duplicatePRs = duplicateCheck.activePRs
            .filter((pr) => pr.number !== prNumber)
            .map((pr) => pr.number)
        }
      }

      const canProceed = !isSuperseded && !hasDuplicates

      return {
        prNumber,
        isSuperseded,
        supersededReason: isSuperseded ? 'PR has no meaningful changes (empty diff)' : null,
        hasDuplicates,
        duplicatePRs,
        canProceed,
      }
    }),

  // =========================================================================
  // Auto-Merge
  // =========================================================================

  enableAutoMerge: (prNumber) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      // Try to enable auto-merge
      const result = yield* cmd
        .exec(`gh pr merge ${prNumber} --auto --squash 2>&1 || echo "FAILED"`, {
          throwOnError: false,
        })
        .pipe(Effect.catchAll(() => Effect.succeed('FAILED')))

      if (result.includes('FAILED') || result.includes('error')) {
        return {
          prNumber,
          enabled: false,
          reason: result.includes('auto-merge is not allowed')
            ? 'Auto-merge is not enabled for this repository'
            : `Failed to enable auto-merge: ${result}`,
        }
      }

      return {
        prNumber,
        enabled: true,
        reason: 'Auto-merge enabled successfully',
      }
    }),

  hasAutoMergeEnabled: (prNumber) =>
    Effect.gen(function* () {
      const prInfo = yield* prManagerImpl.getPRInfo(prNumber)
      return prInfo.isAutoMergeEnabled
    }),

  // =========================================================================
  // Conflict Detection
  // =========================================================================

  hasConflicts: (prNumber) =>
    Effect.gen(function* () {
      const mergeableState = yield* prManagerImpl.getMergeableState(prNumber)
      return mergeableState === 'CONFLICTING'
    }),

  getMergeableState: (prNumber) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const output = yield* cmd
        .exec(`gh pr view ${prNumber} --json mergeable --jq '.mergeable'`, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new PROperationError(
                'getMergeableState',
                `Failed to get mergeable state for PR #${prNumber}`,
                error
              )
            )
          )
        )

      return parseMergeableState(output.trim())
    }),

  // =========================================================================
  // Branch Management
  // =========================================================================

  findOrphanBranches: (minAgeMinutes = ORPHAN_BRANCH_AGE_MINUTES) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService
      const ghClient = yield* GitHubAPIClient
      const timeUtils = yield* TimeUtils

      // Get all remote TDD branches
      const output = yield* cmd
        .exec(
          `git for-each-ref --sort=-committerdate --format='%(refname:short)|%(committerdate:iso8601)' refs/remotes/origin/claude/issue-* 2>/dev/null || echo ""`,
          { throwOnError: false }
        )
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new BranchOperationError('findOrphanBranches', '*', String(error)))
          )
        )

      if (!output.trim()) {
        return []
      }

      const orphans: OrphanBranch[] = []

      for (const line of output.trim().split('\n')) {
        const [refWithOrigin, commitDate] = line.split('|')
        if (!refWithOrigin || !commitDate) continue

        // Remove "origin/" prefix to get branch name
        const branchName = refWithOrigin.replace(/^origin\//, '')
        if (!isTddBranch(branchName)) continue

        // Check age
        const ageMinutes = yield* timeUtils
          .getAgeMinutes(commitDate.trim())
          .pipe(Effect.catchAll(() => Effect.succeed(0)))

        if (ageMinutes < minAgeMinutes) continue

        // Check if branch has a PR
        const hasPR = yield* ghClient
          .hasPRForBranch(branchName)
          .pipe(Effect.catchAll(() => Effect.succeed(false)))

        if (!hasPR) {
          orphans.push({
            name: branchName,
            ageMinutes,
            hasPR: false,
            lastCommitAt: commitDate.trim(),
          })
        }
      }

      return orphans
    }),

  deleteBranch: (branchName) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const result = yield* cmd
        .exec(`git push origin --delete "${branchName}" 2>&1 || echo "FAILED"`, {
          throwOnError: false,
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new BranchOperationError('deleteBranch', branchName, 'Failed to delete branch', error)
            )
          )
        )

      if (result.includes('FAILED') || result.includes('error')) {
        return {
          branchName,
          deleted: false,
          reason: result.includes('not found')
            ? 'Branch not found'
            : `Failed to delete: ${result.slice(0, 100)}`,
        }
      }

      return {
        branchName,
        deleted: true,
        reason: 'Branch deleted successfully',
      }
    }),

  cleanupOrphanBranches: (minAgeMinutes = ORPHAN_BRANCH_AGE_MINUTES) =>
    Effect.gen(function* () {
      const orphans = yield* prManagerImpl.findOrphanBranches(minAgeMinutes)
      const results: BranchCleanupResult[] = []

      for (const orphan of orphans) {
        const result = yield* prManagerImpl.deleteBranch(orphan.name)
        results.push(result)
      }

      return results
    }),

  // =========================================================================
  // PR Actions
  // =========================================================================

  closePR: (prNumber, reason) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      // Add comment explaining why PR is being closed
      yield* cmd
        .exec(`gh pr comment ${prNumber} --body "${reason.replace(/"/g, '\\"')}"`, {
          throwOnError: false,
        })
        .pipe(Effect.catchAll(() => Effect.void))

      // Close the PR
      const result = yield* cmd
        .exec(`gh pr close ${prNumber} 2>&1 || echo "FAILED"`, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new PROperationError('closePR', `Failed to close PR #${prNumber}`, error))
          )
        )

      return !result.includes('FAILED')
    }),

  closeDuplicatePRs: (issueNumber) =>
    Effect.gen(function* () {
      const duplicateCheck = yield* prManagerImpl.checkDuplicatePRs(issueNumber)

      if (!duplicateCheck.hasDuplicates) {
        return []
      }

      // Sort PRs by recency and keep the newest one
      const sortedPRs = sortPRsByRecency(duplicateCheck.activePRs)
      const prsToClose = sortedPRs.slice(1) // Keep the first (newest), close the rest
      const closedPRs: number[] = []

      for (const pr of prsToClose) {
        const closed = yield* prManagerImpl.closePR(
          pr.number,
          `Closing duplicate PR. A more recent PR exists for issue #${issueNumber}.`
        )

        if (closed) {
          closedPRs.push(pr.number)
        }
      }

      return closedPRs
    }),
}

// =============================================================================
// Layer
// =============================================================================

export const PRManagerLive = Layer.succeed(PRManager, PRManager.of(prManagerImpl))
