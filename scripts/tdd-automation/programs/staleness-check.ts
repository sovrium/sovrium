/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Staleness Check Program
 *
 * Effect program that determines if the current test run should trigger
 * Claude Code execution based on:
 * - Other pending test.yml runs (not stale)
 * - Active claude-code.yml runs (not stale)
 * - Staleness threshold (30 minutes)
 *
 * This prevents phantom runs from blocking TDD automation.
 */

import { Effect, Duration, pipe } from 'effect'
import { isOlderThan } from '../core/duration'
import { GitHubApiError } from '../core/errors'
import type { WorkflowRun } from '../services/github-api'

/**
 * Default staleness threshold (30 minutes)
 * Runs not updated in this time are considered stale/phantom
 */
export const DEFAULT_STALENESS_THRESHOLD = Duration.minutes(30)

/**
 * Configuration for staleness check
 */
export interface StalenessCheckConfig {
  /** Current workflow run ID to exclude from counts */
  readonly currentRunId: string
  /** Branch to check for test.yml runs */
  readonly branch: string
  /** When the current run started */
  readonly currentRunStartedAt: Date
  /** Staleness threshold (default: 30 minutes) */
  readonly stalenessThreshold?: Duration.Duration
  /** GitHub repository (owner/repo format) */
  readonly repository: string
}

/**
 * Result of staleness check
 */
export interface StalenessCheckResult {
  /** Whether Claude Code should be triggered */
  readonly shouldTrigger: boolean
  /** Reason for skipping (if shouldTrigger is false) */
  readonly skipReason?: 'pending_tests' | 'active_claude_run'
  /** Number of pending test.yml runs (non-stale) */
  readonly pendingTests: number
  /** Total active claude-code.yml runs (non-stale) */
  readonly activeClaude: number
  /** Claude Code runs started after current test */
  readonly newerClaudeRuns: number
}

/**
 * Filter runs by staleness threshold
 * Removes runs that haven't been updated within the threshold
 */
function filterNonStaleRuns(
  runs: readonly WorkflowRun[],
  threshold: Duration.Duration
): readonly WorkflowRun[] {
  return runs.filter((run) => {
    // Run is stale if updatedAt is older than threshold
    return !isOlderThan(run.updatedAt, threshold)
  })
}

/**
 * Filter runs to exclude the current run
 */
function excludeCurrentRun(
  runs: readonly WorkflowRun[],
  currentRunId: string
): readonly WorkflowRun[] {
  return runs.filter((run) => run.id !== currentRunId)
}

/**
 * Filter runs that started after a given time
 */
function filterNewerRuns(runs: readonly WorkflowRun[], afterTime: Date): readonly WorkflowRun[] {
  return runs.filter((run) => run.createdAt > afterTime)
}

/**
 * Filter runs by [TDD] display title prefix
 * Used for claude-code.yml runs which always report head_branch="main"
 */
function filterTddRuns(runs: readonly WorkflowRun[]): readonly WorkflowRun[] {
  return runs.filter((run) => run.displayTitle.startsWith('[TDD]'))
}

/**
 * Query workflow runs by status and branch using gh api
 * Used for test.yml which correctly reports the PR's branch
 */
const queryWorkflowRunsByStatusAndBranch = (params: {
  readonly workflow: string
  readonly status: 'queued' | 'in_progress'
  readonly branch: string
  readonly repository: string
}) =>
  Effect.tryPromise({
    try: async () => {
      const endpoint = `/repos/${params.repository}/actions/workflows/${params.workflow}/runs?status=${params.status}&branch=${encodeURIComponent(params.branch)}`

      const result = await Bun.$`gh api \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "${endpoint}"`.quiet()

      const data = JSON.parse(result.stdout.toString()) as {
        workflow_runs: Array<{
          id: number
          name: string
          display_title: string
          conclusion: string | null
          created_at: string
          updated_at: string
          html_url: string
        }>
      }

      return data.workflow_runs.map((run) => ({
        id: String(run.id),
        name: run.name,
        displayTitle: run.display_title,
        conclusion: run.conclusion as WorkflowRun['conclusion'],
        createdAt: new Date(run.created_at),
        updatedAt: new Date(run.updated_at),
        htmlUrl: run.html_url,
      }))
    },
    catch: (error) =>
      new GitHubApiError({
        operation: `queryWorkflowRuns:${params.workflow}:${params.status}`,
        cause: error,
      }),
  })

/**
 * Query workflow runs by status only (no branch filter)
 *
 * Used for claude-code.yml which is triggered by issue_comment events.
 * These events always report head_branch="main" regardless of the PR's
 * actual branch, so branch-based filtering would always return 0 results.
 *
 * Results are filtered by [TDD] display_title prefix instead, which is
 * safe because serial processing guarantees only 1 active TDD PR at a time.
 */
const queryWorkflowRunsByStatus = (params: {
  readonly workflow: string
  readonly status: 'queued' | 'in_progress'
  readonly repository: string
}) =>
  Effect.tryPromise({
    try: async () => {
      const endpoint = `/repos/${params.repository}/actions/workflows/${params.workflow}/runs?status=${params.status}`

      const result = await Bun.$`gh api \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "${endpoint}"`.quiet()

      const data = JSON.parse(result.stdout.toString()) as {
        workflow_runs: Array<{
          id: number
          name: string
          display_title: string
          conclusion: string | null
          created_at: string
          updated_at: string
          html_url: string
        }>
      }

      return data.workflow_runs.map((run) => ({
        id: String(run.id),
        name: run.name,
        displayTitle: run.display_title,
        conclusion: run.conclusion as WorkflowRun['conclusion'],
        createdAt: new Date(run.created_at),
        updatedAt: new Date(run.updated_at),
        htmlUrl: run.html_url,
      }))
    },
    catch: (error) =>
      new GitHubApiError({
        operation: `queryWorkflowRuns:${params.workflow}:${params.status}`,
        cause: error,
      }),
  })

/**
 * Main staleness check program
 *
 * Determines if Claude Code should be triggered based on:
 * 1. No other test.yml runs pending (we're the last one)
 * 2. No Claude Code runs started after current test failure
 *
 * @param config - Staleness check configuration
 * @returns StalenessCheckResult with trigger decision and metrics
 */
export const checkStaleness = (config: StalenessCheckConfig) =>
  Effect.gen(function* () {
    const threshold = config.stalenessThreshold ?? DEFAULT_STALENESS_THRESHOLD

    // Query test.yml runs (queued and in_progress) - filtered by branch
    // test.yml is triggered by pull_request events which correctly report the PR's branch
    const [queuedTests, inProgressTests] = yield* Effect.all([
      queryWorkflowRunsByStatusAndBranch({
        workflow: 'test.yml',
        status: 'queued',
        branch: config.branch,
        repository: config.repository,
      }),
      queryWorkflowRunsByStatusAndBranch({
        workflow: 'test.yml',
        status: 'in_progress',
        branch: config.branch,
        repository: config.repository,
      }),
    ])

    // Query claude-code.yml runs (queued and in_progress) - NO branch filter
    // claude-code.yml is triggered by issue_comment events which always report
    // head_branch="main". We filter by [TDD] display_title prefix instead.
    const [queuedClaude, inProgressClaude] = yield* Effect.all([
      queryWorkflowRunsByStatus({
        workflow: 'claude-code.yml',
        status: 'queued',
        repository: config.repository,
      }),
      queryWorkflowRunsByStatus({
        workflow: 'claude-code.yml',
        status: 'in_progress',
        repository: config.repository,
      }),
    ])

    // Filter out current run and stale runs from test.yml
    const nonStaleQueuedTests = pipe(
      queuedTests,
      (runs) => excludeCurrentRun(runs, config.currentRunId),
      (runs) => filterNonStaleRuns(runs, threshold)
    )

    const nonStaleInProgressTests = pipe(
      inProgressTests,
      (runs) => excludeCurrentRun(runs, config.currentRunId),
      (runs) => filterNonStaleRuns(runs, threshold)
    )

    // Filter Claude Code runs: remove stale, then filter by [TDD] title
    const nonStaleQueuedClaude = filterTddRuns(filterNonStaleRuns(queuedClaude, threshold))
    const nonStaleInProgressClaude = filterTddRuns(filterNonStaleRuns(inProgressClaude, threshold))

    // Combine Claude Code runs and filter for newer ones
    const allClaudeRuns = [...nonStaleQueuedClaude, ...nonStaleInProgressClaude]
    const newerClaudeRuns = filterNewerRuns(allClaudeRuns, config.currentRunStartedAt)

    // Calculate totals
    const pendingTests = nonStaleQueuedTests.length + nonStaleInProgressTests.length
    const activeClaude = allClaudeRuns.length
    const newerClaudeCount = newerClaudeRuns.length

    // Determine if should trigger
    if (pendingTests > 0) {
      return {
        shouldTrigger: false,
        skipReason: 'pending_tests' as const,
        pendingTests,
        activeClaude,
        newerClaudeRuns: newerClaudeCount,
      }
    }

    if (activeClaude > 0) {
      return {
        shouldTrigger: false,
        skipReason: 'active_claude_run' as const,
        pendingTests,
        activeClaude,
        newerClaudeRuns: newerClaudeCount,
      }
    }

    return {
      shouldTrigger: true,
      pendingTests,
      activeClaude,
      newerClaudeRuns: newerClaudeCount,
    } satisfies StalenessCheckResult
  })

/**
 * Create program with error recovery
 * Falls back to triggering on API errors (fail-open for automation)
 */
export const checkStalenessWithRecovery = (config: StalenessCheckConfig) =>
  pipe(
    checkStaleness(config),
    Effect.catchAll((error) =>
      Effect.succeed({
        shouldTrigger: true, // Fail-open: trigger on errors
        pendingTests: 0,
        activeClaude: 0,
        newerClaudeRuns: 0,
        error: error instanceof Error ? error.message : String(error),
      } as StalenessCheckResult & { error?: string })
    )
  )
