/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * GitHub API Service
 *
 * Effect service interface for GitHub API operations in TDD automation.
 * Uses gh CLI via Bun shell for most operations, with direct GitHub REST API
 * calls (fetch) for operations requiring complex query parameters (e.g., date filters).
 */

import { Context, Effect, Layer } from 'effect'
import { GitHubApiError } from '../core/errors'
import { parseTDDPRTitle } from '../core/parse-pr-title'
import { withRetry, DEFAULT_RETRY_CONFIG, type RetryConfig } from '../core/retry'
import { TDD_LABELS } from '../core/types'
import type { TDDPullRequest } from '../core/types'

/**
 * Workflow run metadata from GitHub API
 */
export interface WorkflowRun {
  readonly id: string
  readonly name: string
  readonly conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly htmlUrl: string
}

/**
 * PR details from GitHub API
 */
export interface PRDetails {
  readonly number: number
  readonly title: string
  readonly branch: string
  readonly state: 'open' | 'closed' | 'merged'
  readonly labels: readonly string[]
}

/**
 * GitHub API service interface
 */
export interface GitHubApiService {
  /**
   * List open PRs with tdd-automation label
   */
  readonly listTDDPRs: () => Effect.Effect<readonly TDDPullRequest[], GitHubApiError>

  /**
   * Get PR details
   */
  readonly getPR: (prNumber: number) => Effect.Effect<PRDetails, GitHubApiError>

  /**
   * Get workflow runs for cost calculation
   */
  readonly getWorkflowRuns: (params: {
    readonly workflow: string
    readonly createdAfter: Date
    readonly status: 'success' | 'failure' | 'all'
  }) => Effect.Effect<readonly WorkflowRun[], GitHubApiError>

  /**
   * Get workflow run logs for cost parsing
   */
  readonly getRunLogs: (runId: string) => Effect.Effect<string, GitHubApiError>

  /**
   * Create a new PR
   */
  readonly createPR: (params: {
    readonly title: string
    readonly body: string
    readonly branch: string
    readonly base: string
    readonly labels: readonly string[]
  }) => Effect.Effect<{ readonly number: number; readonly url: string }, GitHubApiError>

  /**
   * Update PR title
   */
  readonly updatePRTitle: (prNumber: number, title: string) => Effect.Effect<void, GitHubApiError>

  /**
   * Add label to PR
   */
  readonly addLabel: (prNumber: number, label: string) => Effect.Effect<void, GitHubApiError>

  /**
   * Post comment on PR
   */
  readonly postComment: (prNumber: number, body: string) => Effect.Effect<void, GitHubApiError>

  /**
   * Enable auto-merge for PR
   */
  readonly enableAutoMerge: (
    prNumber: number,
    mergeMethod: 'squash' | 'merge' | 'rebase'
  ) => Effect.Effect<void, GitHubApiError>
}

/**
 * GitHub API service Context.Tag for dependency injection
 */
export class GitHubApi extends Context.Tag('GitHubApi')<GitHubApi, GitHubApiService>() {}

/**
 * Live implementation using gh CLI via Bun shell and GitHub REST API
 */
export const GitHubApiLive = Layer.succeed(GitHubApi, {
  listTDDPRs: () =>
    Effect.tryPromise({
      try: async () => {
        const result =
          await Bun.$`gh pr list --label "${TDD_LABELS.AUTOMATION}" --state open --json number,title,headRefName,labels`.quiet()
        const prs = JSON.parse(result.stdout.toString()) as Array<{
          number: number
          title: string
          headRefName: string
          labels: Array<{ name: string }>
        }>

        return prs.map((pr) => {
          const parsed = parseTDDPRTitle(pr.title)
          return {
            number: pr.number,
            title: pr.title,
            branch: pr.headRefName,
            specId: parsed?.specId ?? '',
            attempt: parsed?.attempt ?? 0,
            maxAttempts: parsed?.maxAttempts ?? 5,
            labels: pr.labels.map((l) => l.name),
            hasManualInterventionLabel: pr.labels.some(
              (l) => l.name === TDD_LABELS.MANUAL_INTERVENTION
            ),
          } satisfies TDDPullRequest
        })
      },
      catch: (error) => new GitHubApiError({ operation: 'listTDDPRs', cause: error }),
    }),

  getPR: (prNumber) =>
    Effect.tryPromise({
      try: async () => {
        const result =
          await Bun.$`gh pr view ${prNumber} --json number,title,headRefName,state,labels`.quiet()
        const pr = JSON.parse(result.stdout.toString()) as {
          number: number
          title: string
          headRefName: string
          state: string
          labels: Array<{ name: string }>
        }

        return {
          number: pr.number,
          title: pr.title,
          branch: pr.headRefName,
          state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
          labels: pr.labels.map((l) => l.name),
        }
      },
      catch: (error) => new GitHubApiError({ operation: 'getPR', cause: error }),
    }),

  getWorkflowRuns: ({ workflow, createdAfter, status }) =>
    Effect.tryPromise({
      try: async () => {
        // Get repository from environment or default
        const repo = process.env.GITHUB_REPOSITORY ?? 'sovrium/sovrium'
        const [owner, repoName] = repo.split('/')

        // Get GitHub token from environment
        const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''

        // Build query parameters
        const params = new URLSearchParams({
          per_page: '100', // Max allowed by GitHub API
          created: `>=${createdAfter.toISOString()}`, // Filter by creation date
        })

        if (status !== 'all') {
          params.set('status', status)
        }

        // Use GitHub REST API to list workflow runs
        // Endpoint: GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
        const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflow}/runs?${params.toString()}`

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        })

        if (!response.ok) {
          throw new Error(
            `GitHub API request failed: ${response.status} ${response.statusText}`
          )
        }

        const data = (await response.json()) as {
          workflow_runs: Array<{
            id: number
            name: string
            conclusion: string | null
            created_at: string
            updated_at: string
            html_url: string
          }>
        }

        return data.workflow_runs.map((run) => ({
          id: String(run.id),
          name: run.name,
          conclusion: run.conclusion as WorkflowRun['conclusion'],
          createdAt: new Date(run.created_at),
          updatedAt: new Date(run.updated_at),
          htmlUrl: run.html_url,
        }))
      },
      catch: (error) => new GitHubApiError({ operation: 'getWorkflowRuns', cause: error }),
    }),

  getRunLogs: (runId) =>
    Effect.tryPromise({
      try: async () => {
        // Note: `gh run view --log` can fail silently in CI environments.
        // The GitHub API /actions/runs/{id}/logs returns a 302 redirect to a signed S3 URL.
        // We use native fetch() with redirect following to properly download the ZIP archive.

        const tempDir = `/tmp/gh_run_logs_${runId}_${Date.now()}`
        const zipFile = `${tempDir}/logs.zip`

        try {
          // Create temp directory
          await Bun.$`mkdir -p ${tempDir}`.quiet()

          // Get repository from environment or default
          const repo = process.env.GITHUB_REPOSITORY ?? 'sovrium/sovrium'

          // Get GitHub token from environment
          const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''

          // Use native fetch to properly handle 302 redirect and binary data
          // GitHub API returns 302 redirect to a signed S3 URL for logs
          const apiUrl = `https://api.github.com/repos/${repo}/actions/runs/${runId}/logs`
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            redirect: 'follow', // Follow the 302 redirect to S3
          })

          if (!response.ok) {
            // Return empty string on failure, cost tracker will use fallback
            return ''
          }

          // Write binary ZIP content to file
          const arrayBuffer = await response.arrayBuffer()
          await Bun.write(zipFile, arrayBuffer)

          // Check if download succeeded
          const zipExists = await Bun.file(zipFile).exists()
          const zipSize = zipExists ? await Bun.file(zipFile).size : 0
          if (!zipExists || zipSize === 0) {
            return '' // Return empty string, cost tracker will handle the error
          }

          // Extract ZIP (may contain multiple job/step log files)
          await Bun.$`unzip -q -o ${zipFile} -d ${tempDir}`.quiet()

          // Find all log/text files and concatenate
          const findResult =
            await Bun.$`find ${tempDir} -type f \( -name "*.txt" -o -name "*log*" \) 2>/dev/null`.quiet()
          const logFiles = findResult.stdout.toString().trim().split('\n').filter(Boolean)

          let allLogs = ''
          for (const file of logFiles) {
            if (file === zipFile) continue // Skip the zip file itself
            try {
              const content = await Bun.file(file).text()
              allLogs += content + '\n'
            } catch {
              // Skip files that can't be read
            }
          }

          return allLogs
        } finally {
          // Clean up temp directory
          await Bun.$`rm -rf ${tempDir}`.quiet()
        }
      },
      catch: (error) => new GitHubApiError({ operation: 'getRunLogs', cause: error }),
    }),

  createPR: ({ title, body, branch, base, labels }) =>
    Effect.tryPromise({
      try: async () => {
        const labelsArg = labels.length > 0 ? `--label "${labels.join(',')}"` : ''

        const result =
          await Bun.$`gh pr create --title "${title}" --body "${body}" --head "${branch}" --base "${base}" ${labelsArg} --json number,url`.quiet()
        const pr = JSON.parse(result.stdout.toString()) as { number: number; url: string }

        return { number: pr.number, url: pr.url }
      },
      catch: (error) => new GitHubApiError({ operation: 'createPR', cause: error }),
    }),

  updatePRTitle: (prNumber, title) =>
    Effect.tryPromise({
      try: async () => {
        await Bun.$`gh pr edit ${prNumber} --title "${title}"`.quiet()
      },
      catch: (error) => new GitHubApiError({ operation: 'updatePRTitle', cause: error }),
    }),

  addLabel: (prNumber, label) =>
    Effect.tryPromise({
      try: async () => {
        await Bun.$`gh pr edit ${prNumber} --add-label "${label}"`.quiet()
      },
      catch: (error) => new GitHubApiError({ operation: 'addLabel', cause: error }),
    }),

  postComment: (prNumber, body) =>
    Effect.tryPromise({
      try: async () => {
        // Use temp file to safely handle markdown with special characters
        const tempFile = `/tmp/pr_comment_${prNumber}_${Date.now()}.md`
        await Bun.write(tempFile, body)
        try {
          await Bun.$`gh pr comment ${prNumber} --body-file ${tempFile}`.quiet()
        } finally {
          // Clean up temp file
          await Bun.$`rm -f ${tempFile}`.quiet()
        }
      },
      catch: (error) => new GitHubApiError({ operation: 'postComment', cause: error }),
    }),

  enableAutoMerge: (prNumber, mergeMethod) =>
    Effect.tryPromise({
      try: async () => {
        await Bun.$`gh pr merge ${prNumber} --${mergeMethod} --auto`.quiet()
      },
      catch: (error) => new GitHubApiError({ operation: 'enableAutoMerge', cause: error }),
    }),
})

/**
 * Helper to wrap a GitHubApi operation with retry logic
 */
function wrapWithRetry<A>(
  effect: Effect.Effect<A, GitHubApiError>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<A, GitHubApiError> {
  return withRetry(effect, config)
}

/**
 * Live implementation with automatic retry for transient failures
 *
 * Uses DEFAULT_RETRY_CONFIG (3 attempts, exponential backoff, 1s initial delay)
 * for all operations to handle GitHub API rate limits and network issues.
 */
export const GitHubApiLiveWithRetry = Layer.succeed(GitHubApi, {
  listTDDPRs: () =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const result =
            await Bun.$`gh pr list --label "${TDD_LABELS.AUTOMATION}" --state open --json number,title,headRefName,labels`.quiet()
          const prs = JSON.parse(result.stdout.toString()) as Array<{
            number: number
            title: string
            headRefName: string
            labels: Array<{ name: string }>
          }>

          return prs.map((pr) => {
            const parsed = parseTDDPRTitle(pr.title)
            return {
              number: pr.number,
              title: pr.title,
              branch: pr.headRefName,
              specId: parsed?.specId ?? '',
              attempt: parsed?.attempt ?? 0,
              maxAttempts: parsed?.maxAttempts ?? 5,
              labels: pr.labels.map((l) => l.name),
              hasManualInterventionLabel: pr.labels.some(
                (l) => l.name === TDD_LABELS.MANUAL_INTERVENTION
              ),
            } satisfies TDDPullRequest
          })
        },
        catch: (error) => new GitHubApiError({ operation: 'listTDDPRs', cause: error }),
      })
    ),

  getPR: (prNumber) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const result =
            await Bun.$`gh pr view ${prNumber} --json number,title,headRefName,state,labels`.quiet()
          const pr = JSON.parse(result.stdout.toString()) as {
            number: number
            title: string
            headRefName: string
            state: string
            labels: Array<{ name: string }>
          }

          return {
            number: pr.number,
            title: pr.title,
            branch: pr.headRefName,
            state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
            labels: pr.labels.map((l) => l.name),
          }
        },
        catch: (error) => new GitHubApiError({ operation: 'getPR', cause: error }),
      })
    ),

  getWorkflowRuns: ({ workflow, createdAfter, status }) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          // Get repository from environment or default
          const repo = process.env.GITHUB_REPOSITORY ?? 'sovrium/sovrium'
          const [owner, repoName] = repo.split('/')

          // Get GitHub token from environment
          const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''

          // Build query parameters
          const params = new URLSearchParams({
            per_page: '100', // Max allowed by GitHub API
            created: `>=${createdAfter.toISOString()}`, // Filter by creation date
          })

          if (status !== 'all') {
            params.set('status', status)
          }

          // Use GitHub REST API to list workflow runs
          // Endpoint: GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
          const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflow}/runs?${params.toString()}`

          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          })

          if (!response.ok) {
            throw new Error(
              `GitHub API request failed: ${response.status} ${response.statusText}`
            )
          }

          const data = (await response.json()) as {
            workflow_runs: Array<{
              id: number
              name: string
              conclusion: string | null
              created_at: string
              updated_at: string
              html_url: string
            }>
          }

          return data.workflow_runs.map((run) => ({
            id: String(run.id),
            name: run.name,
            conclusion: run.conclusion as WorkflowRun['conclusion'],
            createdAt: new Date(run.created_at),
            updatedAt: new Date(run.updated_at),
            htmlUrl: run.html_url,
          }))
        },
        catch: (error) => new GitHubApiError({ operation: 'getWorkflowRuns', cause: error }),
      })
    ),

  getRunLogs: (runId) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          // Note: `gh run view --log` can fail silently in CI environments.
          // The GitHub API /actions/runs/{id}/logs returns a ZIP archive.
          // We download, extract, and concatenate all log files.

          const tempDir = `/tmp/gh_run_logs_${runId}_${Date.now()}`
          const zipFile = `${tempDir}/logs.zip`

          try {
            // Create temp directory
            await Bun.$`mkdir -p ${tempDir}`.quiet()

            // Get repository from environment or default
            const repo = process.env.GITHUB_REPOSITORY ?? 'sovrium/sovrium'

            // Download logs ZIP via GitHub API (follows 302 redirect automatically)
            // Download logs ZIP via GitHub API (follows 302 redirect automatically)
            await Bun.$`gh api repos/${repo}/actions/runs/${runId}/logs > ${zipFile}`.quiet()

            // Check if download succeeded
            const zipExists = await Bun.file(zipFile).exists()
            if (!zipExists) {
              return '' // Return empty string, cost tracker will handle the error
            }

            // Extract ZIP (may contain multiple job/step log files)
            await Bun.$`unzip -q -o ${zipFile} -d ${tempDir}`.quiet()

            // Find all log/text files and concatenate
            const findResult =
              await Bun.$`find ${tempDir} -type f \( -name "*.txt" -o -name "*log*" \) 2>/dev/null`.quiet()
            const logFiles = findResult.stdout.toString().trim().split('\n').filter(Boolean)

            let allLogs = ''
            for (const file of logFiles) {
              if (file === zipFile) continue // Skip the zip file itself
              try {
                const content = await Bun.file(file).text()
                allLogs += content + '\n'
              } catch {
                // Skip files that can't be read
              }
            }

            return allLogs
          } finally {
            // Clean up temp directory
            await Bun.$`rm -rf ${tempDir}`.quiet()
          }
        },
        catch: (error) => new GitHubApiError({ operation: 'getRunLogs', cause: error }),
      })
    ),

  createPR: ({ title, body, branch, base, labels }) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const labelsArg = labels.length > 0 ? `--label "${labels.join(',')}"` : ''

          const result =
            await Bun.$`gh pr create --title "${title}" --body "${body}" --head "${branch}" --base "${base}" ${labelsArg} --json number,url`.quiet()
          const pr = JSON.parse(result.stdout.toString()) as { number: number; url: string }

          return { number: pr.number, url: pr.url }
        },
        catch: (error) => new GitHubApiError({ operation: 'createPR', cause: error }),
      })
    ),

  updatePRTitle: (prNumber, title) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          await Bun.$`gh pr edit ${prNumber} --title "${title}"`.quiet()
        },
        catch: (error) => new GitHubApiError({ operation: 'updatePRTitle', cause: error }),
      })
    ),

  addLabel: (prNumber, label) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          await Bun.$`gh pr edit ${prNumber} --add-label "${label}"`.quiet()
        },
        catch: (error) => new GitHubApiError({ operation: 'addLabel', cause: error }),
      })
    ),

  postComment: (prNumber, body) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const tempFile = `/tmp/pr_comment_${prNumber}_${Date.now()}.md`
          await Bun.write(tempFile, body)
          try {
            await Bun.$`gh pr comment ${prNumber} --body-file ${tempFile}`.quiet()
          } finally {
            await Bun.$`rm -f ${tempFile}`.quiet()
          }
        },
        catch: (error) => new GitHubApiError({ operation: 'postComment', cause: error }),
      })
    ),

  enableAutoMerge: (prNumber, mergeMethod) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          await Bun.$`gh pr merge ${prNumber} --${mergeMethod} --auto`.quiet()
        },
        catch: (error) => new GitHubApiError({ operation: 'enableAutoMerge', cause: error }),
      })
    ),
})
