/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import { CommandService } from '../../lib/effect'

// =============================================================================
// Types
// =============================================================================

/**
 * GitHub API rate limit information
 */
export interface RateLimitInfo {
  readonly remaining: number
  readonly limit: number
  readonly resetTimestamp: number
  readonly resetDate: Date
}

/**
 * GitHub Issue (minimal representation)
 */
export interface GitHubIssue {
  readonly number: number
  readonly title: string
  readonly state: 'open' | 'closed'
  readonly body: string | null
  readonly labels: ReadonlyArray<{ name: string }>
  readonly createdAt: string
  readonly updatedAt: string
  readonly url: string
}

/**
 * GitHub PR (minimal representation)
 */
export interface GitHubPR {
  readonly number: number
  readonly title: string
  readonly state: 'open' | 'closed' | 'merged'
  readonly headRefName: string
  readonly baseRefName: string
  readonly url: string
  readonly isDraft: boolean
}

/**
 * GitHub Workflow Run
 */
export interface GitHubWorkflowRun {
  readonly id: number
  readonly name: string
  readonly status: 'queued' | 'in_progress' | 'completed'
  readonly conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  readonly headBranch: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly url: string
}

/**
 * Branch existence check result
 */
export interface BranchCheckResult {
  readonly exists: boolean
  readonly name: string
  readonly sha?: string
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when GitHub API call fails
 */
export class GitHubAPIError extends Error {
  readonly _tag = 'GitHubAPIError' as const

  constructor(
    readonly operation: string,
    override readonly message: string,
    override readonly cause?: unknown
  ) {
    super(`GitHub API error in ${operation}: ${message}`)
    this.name = 'GitHubAPIError'
  }
}

/**
 * Error when rate limit is exhausted
 */
export class RateLimitExhaustedError extends Error {
  readonly _tag = 'RateLimitExhaustedError' as const

  constructor(readonly resetDate: Date) {
    super(`GitHub API rate limit exhausted. Resets at ${resetDate.toISOString()}`)
    this.name = 'RateLimitExhaustedError'
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * GitHubAPIClient service for interacting with GitHub API via gh CLI.
 *
 * Provides type-safe wrappers around common GitHub CLI operations:
 * - Rate limit checking
 * - Issue operations (list, view, edit, comment, close)
 * - PR operations (list, check)
 * - Branch operations (check existence)
 * - Workflow run operations (list, view logs)
 */
export interface GitHubAPIClient {
  // =========================================================================
  // Rate Limit
  // =========================================================================

  /**
   * Check GitHub API rate limit status
   */
  readonly checkRateLimit: () => Effect.Effect<RateLimitInfo, GitHubAPIError, CommandService>

  /**
   * Ensure sufficient rate limit capacity
   * @param minRemaining - Minimum requests that should remain (default: 10)
   */
  readonly ensureRateLimit: (
    minRemaining?: number
  ) => Effect.Effect<boolean, GitHubAPIError | RateLimitExhaustedError, CommandService>

  // =========================================================================
  // Issue Operations
  // =========================================================================

  /**
   * List issues with optional filters
   */
  readonly listIssues: (options: {
    labels?: ReadonlyArray<string>
    state?: 'open' | 'closed' | 'all'
    search?: string
    limit?: number
  }) => Effect.Effect<ReadonlyArray<GitHubIssue>, GitHubAPIError, CommandService>

  /**
   * Get a single issue by number
   */
  readonly getIssue: (
    issueNumber: number
  ) => Effect.Effect<GitHubIssue, GitHubAPIError, CommandService>

  /**
   * Get issue body content
   */
  readonly getIssueBody: (
    issueNumber: number
  ) => Effect.Effect<string, GitHubAPIError, CommandService>

  /**
   * Add labels to an issue
   */
  readonly addLabels: (
    issueNumber: number,
    labels: ReadonlyArray<string>
  ) => Effect.Effect<void, GitHubAPIError, CommandService>

  /**
   * Remove labels from an issue
   */
  readonly removeLabels: (
    issueNumber: number,
    labels: ReadonlyArray<string>
  ) => Effect.Effect<void, GitHubAPIError, CommandService>

  /**
   * Add a comment to an issue
   */
  readonly addComment: (
    issueNumber: number,
    body: string
  ) => Effect.Effect<void, GitHubAPIError, CommandService>

  /**
   * Close an issue
   */
  readonly closeIssue: (
    issueNumber: number,
    reason?: 'completed' | 'not_planned'
  ) => Effect.Effect<void, GitHubAPIError, CommandService>

  // =========================================================================
  // PR Operations
  // =========================================================================

  /**
   * List pull requests with optional filters
   */
  readonly listPRs: (options?: {
    state?: 'open' | 'closed' | 'merged' | 'all'
    head?: string
    base?: string
    limit?: number
  }) => Effect.Effect<ReadonlyArray<GitHubPR>, GitHubAPIError, CommandService>

  /**
   * Check if a PR exists for a branch
   */
  readonly hasPRForBranch: (
    branchName: string
  ) => Effect.Effect<boolean, GitHubAPIError, CommandService>

  // =========================================================================
  // Branch Operations
  // =========================================================================

  /**
   * Check if a branch exists
   */
  readonly branchExists: (
    branchName: string
  ) => Effect.Effect<BranchCheckResult, GitHubAPIError, CommandService>

  // =========================================================================
  // Workflow Operations
  // =========================================================================

  /**
   * List recent workflow runs
   */
  readonly listWorkflowRuns: (options?: {
    workflow?: string
    branch?: string
    status?: 'queued' | 'in_progress' | 'completed'
    limit?: number
  }) => Effect.Effect<ReadonlyArray<GitHubWorkflowRun>, GitHubAPIError, CommandService>

  /**
   * Get workflow run logs
   */
  readonly getWorkflowRunLogs: (
    runId: number
  ) => Effect.Effect<string, GitHubAPIError, CommandService>
}

// =============================================================================
// Service Tag
// =============================================================================

export const GitHubAPIClient = Context.GenericTag<GitHubAPIClient>('GitHubAPIClient')

// =============================================================================
// Pure Helper Functions
// =============================================================================

/**
 * Escape special characters for shell command strings
 */
export const escapeForShell = (str: string): string => {
  // Replace single quotes with escaped version and wrap in single quotes
  return `'${str.replace(/'/g, "'\\''")}'`
}

/**
 * Build gh issue list command with options
 */
export const buildIssueListCommand = (options: {
  labels?: ReadonlyArray<string>
  state?: 'open' | 'closed' | 'all'
  search?: string
  limit?: number
}): string => {
  const parts = ['gh issue list']

  if (options.labels && options.labels.length > 0) {
    parts.push(`--label "${options.labels.join(',')}"`)
  }

  if (options.state) {
    parts.push(`--state ${options.state}`)
  }

  if (options.search) {
    parts.push(`--search "${options.search}"`)
  }

  parts.push('--json number,title,state,body,labels,createdAt,updatedAt,url')
  parts.push(`--limit ${options.limit ?? 100}`)

  return parts.join(' ')
}

/**
 * Parse JSON safely with Effect
 */
export const parseJSON = <T>(
  input: string,
  operation: string
): Effect.Effect<T, GitHubAPIError, never> =>
  Effect.try({
    try: () => JSON.parse(input) as T,
    catch: (error) =>
      new GitHubAPIError(operation, `Failed to parse JSON response: ${String(error)}`),
  })

// =============================================================================
// Service Implementation
// =============================================================================

const gitHubAPIClientImpl: GitHubAPIClient = {
  // =========================================================================
  // Rate Limit
  // =========================================================================

  checkRateLimit: () =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const output = yield* cmd
        .exec('gh api rate_limit --jq ".rate.remaining,.rate.limit,.rate.reset"', {
          throwOnError: false,
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new GitHubAPIError('checkRateLimit', 'Failed to fetch rate limit', error))
          )
        )

      const lines = output.trim().split('\n')
      if (lines.length < 3) {
        return yield* Effect.fail(
          new GitHubAPIError('checkRateLimit', 'Invalid rate limit response format')
        )
      }

      const remaining = parseInt(lines[0] ?? '0', 10)
      const limit = parseInt(lines[1] ?? '0', 10)
      const resetTimestamp = parseInt(lines[2] ?? '0', 10)
      const resetDate = new Date(resetTimestamp * 1000)

      return { remaining, limit, resetTimestamp, resetDate }
    }),

  ensureRateLimit: (minRemaining = 10) =>
    Effect.gen(function* () {
      const rateLimit = yield* gitHubAPIClientImpl.checkRateLimit()

      if (rateLimit.remaining < minRemaining) {
        return yield* Effect.fail(new RateLimitExhaustedError(rateLimit.resetDate))
      }

      return true
    }),

  // =========================================================================
  // Issue Operations
  // =========================================================================

  listIssues: (options) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const command = buildIssueListCommand(options)

      const output = yield* cmd
        .exec(command, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new GitHubAPIError('listIssues', 'Failed to list issues', error))
          )
        )

      if (!output.trim()) {
        return []
      }

      const issues = yield* parseJSON<
        Array<{
          number: number
          title: string
          state: string
          body: string | null
          labels: Array<{ name: string }>
          createdAt: string
          updatedAt: string
          url: string
        }>
      >(output, 'listIssues')

      return issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state as 'open' | 'closed',
        body: issue.body,
        labels: issue.labels,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        url: issue.url,
      }))
    }),

  getIssue: (issueNumber) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const output = yield* cmd
        .exec(
          `gh issue view ${issueNumber} --json number,title,state,body,labels,createdAt,updatedAt,url`,
          { throwOnError: false }
        )
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new GitHubAPIError('getIssue', `Failed to get issue #${issueNumber}`, error)
            )
          )
        )

      const issue = yield* parseJSON<{
        number: number
        title: string
        state: string
        body: string | null
        labels: Array<{ name: string }>
        createdAt: string
        updatedAt: string
        url: string
      }>(output, 'getIssue')

      return {
        number: issue.number,
        title: issue.title,
        state: issue.state as 'open' | 'closed',
        body: issue.body,
        labels: issue.labels,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        url: issue.url,
      }
    }),

  getIssueBody: (issueNumber) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const output = yield* cmd
        .exec(`gh issue view ${issueNumber} --json body --jq '.body'`, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new GitHubAPIError(
                'getIssueBody',
                `Failed to get body for issue #${issueNumber}`,
                error
              )
            )
          )
        )

      return output.trim()
    }),

  addLabels: (issueNumber, labels) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      for (const label of labels) {
        yield* cmd
          .exec(`gh issue edit ${issueNumber} --add-label "${label}"`, { throwOnError: false })
          .pipe(Effect.catchAll(() => Effect.void))
      }
    }),

  removeLabels: (issueNumber, labels) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      for (const label of labels) {
        yield* cmd
          .exec(`gh issue edit ${issueNumber} --remove-label "${label}"`, { throwOnError: false })
          .pipe(Effect.catchAll(() => Effect.void))
      }
    }),

  addComment: (issueNumber, body) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const escapedBody = escapeForShell(body)

      yield* cmd
        .exec(`gh issue comment ${issueNumber} --body ${escapedBody}`, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new GitHubAPIError(
                'addComment',
                `Failed to add comment to issue #${issueNumber}`,
                error
              )
            )
          )
        )
    }),

  closeIssue: (issueNumber, reason = 'completed') =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      yield* cmd
        .exec(`gh issue close ${issueNumber} --reason ${reason}`, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new GitHubAPIError('closeIssue', `Failed to close issue #${issueNumber}`, error)
            )
          )
        )
    }),

  // =========================================================================
  // PR Operations
  // =========================================================================

  listPRs: (options = {}) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const parts = ['gh pr list']

      if (options.state) {
        parts.push(`--state ${options.state}`)
      }

      if (options.head) {
        parts.push(`--head "${options.head}"`)
      }

      if (options.base) {
        parts.push(`--base "${options.base}"`)
      }

      parts.push('--json number,title,state,headRefName,baseRefName,url,isDraft')
      parts.push(`--limit ${options.limit ?? 100}`)

      const command = parts.join(' ')

      const output = yield* cmd
        .exec(command, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(new GitHubAPIError('listPRs', 'Failed to list PRs', error))
          )
        )

      if (!output.trim()) {
        return []
      }

      const prs = yield* parseJSON<
        Array<{
          number: number
          title: string
          state: string
          headRefName: string
          baseRefName: string
          url: string
          isDraft: boolean
        }>
      >(output, 'listPRs')

      return prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state as 'open' | 'closed' | 'merged',
        headRefName: pr.headRefName,
        baseRefName: pr.baseRefName,
        url: pr.url,
        isDraft: pr.isDraft,
      }))
    }),

  hasPRForBranch: (branchName) =>
    Effect.gen(function* () {
      const prs = yield* gitHubAPIClientImpl.listPRs({
        head: branchName,
        state: 'all',
        limit: 1,
      })

      return prs.length > 0
    }),

  // =========================================================================
  // Branch Operations
  // =========================================================================

  branchExists: (branchName) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      // Use gh api to check branch existence (more reliable than git commands)
      const output = yield* cmd
        .exec(
          `gh api repos/:owner/:repo/branches/${encodeURIComponent(branchName)} --jq '.name,.commit.sha' 2>/dev/null || echo ""`,
          { throwOnError: false }
        )
        .pipe(Effect.catchAll(() => Effect.succeed('')))

      const trimmed = output.trim()
      if (!trimmed) {
        return { exists: false, name: branchName }
      }

      const lines = trimmed.split('\n')
      const name = lines[0] ?? branchName
      const sha = lines[1]

      return { exists: true, name, sha }
    }),

  // =========================================================================
  // Workflow Operations
  // =========================================================================

  listWorkflowRuns: (options = {}) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const parts = ['gh run list']

      if (options.workflow) {
        parts.push(`--workflow "${options.workflow}"`)
      }

      if (options.branch) {
        parts.push(`--branch "${options.branch}"`)
      }

      if (options.status) {
        parts.push(`--status ${options.status}`)
      }

      parts.push('--json databaseId,name,status,conclusion,headBranch,createdAt,updatedAt,url')
      parts.push(`--limit ${options.limit ?? 20}`)

      const command = parts.join(' ')

      const output = yield* cmd
        .exec(command, { throwOnError: false })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new GitHubAPIError('listWorkflowRuns', 'Failed to list workflow runs', error)
            )
          )
        )

      if (!output.trim()) {
        return []
      }

      const runs = yield* parseJSON<
        Array<{
          databaseId: number
          name: string
          status: string
          conclusion: string | null
          headBranch: string
          createdAt: string
          updatedAt: string
          url: string
        }>
      >(output, 'listWorkflowRuns')

      return runs.map((run) => ({
        id: run.databaseId,
        name: run.name,
        status: run.status as 'queued' | 'in_progress' | 'completed',
        conclusion: run.conclusion as 'success' | 'failure' | 'cancelled' | 'skipped' | null,
        headBranch: run.headBranch,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        url: run.url,
      }))
    }),

  getWorkflowRunLogs: (runId) =>
    Effect.gen(function* () {
      const cmd = yield* CommandService

      const output = yield* cmd
        .exec(`gh run view ${runId} --log 2>/dev/null || echo ""`, {
          throwOnError: false,
          timeout: 60_000, // 60 second timeout for large logs
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new GitHubAPIError(
                'getWorkflowRunLogs',
                `Failed to get logs for run #${runId}`,
                error
              )
            )
          )
        )

      return output
    }),
}

// =============================================================================
// Layer
// =============================================================================

export const GitHubAPIClientLive = Layer.succeed(
  GitHubAPIClient,
  GitHubAPIClient.of(gitHubAPIClientImpl)
)
