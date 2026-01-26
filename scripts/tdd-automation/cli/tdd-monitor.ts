#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Monitor CLI
 *
 * Provides health monitoring and recovery operations for the TDD automation pipeline:
 * - health-check: Calculate queue health metrics, manage circuit breaker
 * - recover-stuck: Reset stuck in-progress specs
 * - monitor-prs: Check PR states, enable auto-merge
 * - cleanup-branches: Delete orphaned TDD branches
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  CommandServiceLive,
  FileSystemService,
  FileSystemServiceLive,
  LoggerServicePretty,
  logInfo,
  logError,
  success,
  skip,
} from '../../lib/effect'
import { GitHubAPIClient, GitHubAPIClientLive } from '../services/github-api-client'
import { HealthMetrics, HealthMetricsLive } from '../services/health-metrics'
import {
  LabelStateMachine,
  LabelStateMachineLive,
  STATE_LABELS,
} from '../services/label-state-machine'
import { PRManager, PRManagerLive, ORPHAN_BRANCH_AGE_MINUTES } from '../services/pr-manager'
import { TimeUtils, TimeUtilsLive } from '../services/time-utils'

// =============================================================================
// Commands
// =============================================================================

/**
 * Health Check Command
 *
 * Calculates queue health metrics and determines circuit breaker state.
 * Outputs metrics in GitHub Actions format.
 */
const commandHealthCheck = Effect.gen(function* () {
  const healthMetrics = yield* HealthMetrics
  const fs = yield* FileSystemService

  yield* logInfo('📊 Calculating TDD pipeline health...')

  const assessment = yield* healthMetrics.assessHealth()
  const { level, queueMetrics, workflowMetrics } = assessment

  yield* logInfo('')
  yield* logInfo(`📈 Health Metrics:`)
  yield* logInfo(`   Status: ${level}`)
  yield* logInfo(`   Failure Rate: ${workflowMetrics.failureRate}%`)
  yield* logInfo(`   Recent Failures: ${workflowMetrics.failedRuns}/${workflowMetrics.totalRuns}`)
  yield* logInfo(`   Issues in Retry: ${queueMetrics.retryCount}`)
  yield* logInfo(`   In Progress: ${queueMetrics.inProgressCount}`)
  yield* logInfo(`   Queue Size: ${queueMetrics.queuedCount}`)
  yield* logInfo(`   Completed: ${queueMetrics.completedCount}`)
  yield* logInfo('')

  // Determine circuit breaker action
  const shouldOpenCircuit = level === 'critical'
  const shouldCloseCircuit = level === 'healthy' && workflowMetrics.failureRate < 20

  if (shouldOpenCircuit) {
    yield* logError('🚨 Circuit breaker should OPEN - pipeline health critical')
  } else if (shouldCloseCircuit) {
    yield* success('✅ Health is acceptable')
  } else {
    yield* logInfo('⚠️  Health is degraded but within limits')
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `status=${level}
failure_rate=${workflowMetrics.failureRate}
should_open_circuit=${shouldOpenCircuit}
should_close_circuit=${shouldCloseCircuit}
queue_size=${queueMetrics.queuedCount}
in_progress=${queueMetrics.inProgressCount}
issues_in_retry=${queueMetrics.retryCount}
completed=${queueMetrics.completedCount}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return { assessment, shouldOpenCircuit, shouldCloseCircuit }
})

/**
 * Recover Stuck Command
 *
 * Finds and resets specs that have been in-progress too long.
 * Re-queues them for another attempt or marks as failed.
 */
const commandRecoverStuck = Effect.gen(function* () {
  const sm = yield* LabelStateMachine
  const ghClient = yield* GitHubAPIClient
  const timeUtils = yield* TimeUtils
  const fs = yield* FileSystemService

  const timeoutMinutes = parseInt(process.env.STUCK_TIMEOUT_MINUTES ?? '105', 10)
  const forceRecovery = process.argv.includes('--force')

  yield* logInfo(`🔍 Searching for stuck specs (>${timeoutMinutes} min)...`)
  if (forceRecovery) {
    yield* logInfo('   ⚠️  Force recovery enabled')
  }

  // Get in-progress specs using the state label
  const inProgressLabel = STATE_LABELS['in-progress']
  const inProgressIssues = yield* ghClient.listIssues({ labels: [inProgressLabel] })

  if (inProgressIssues.length === 0) {
    yield* skip('No in-progress specs found')
    return { recovered: 0, issues: [] }
  }

  yield* logInfo(`   Found ${inProgressIssues.length} in-progress specs`)

  const recovered: Array<{ number: number; specId: string; ageMinutes: number }> = []

  for (const issue of inProgressIssues) {
    // Check age
    const ageMinutes = yield* timeUtils
      .getAgeMinutes(issue.updatedAt)
      .pipe(Effect.catchAll(() => Effect.succeed(0)))

    if (!forceRecovery && ageMinutes < timeoutMinutes) {
      continue
    }

    yield* logInfo(
      `   🔄 Recovering #${issue.number}: ${issue.title} (${Math.round(ageMinutes)} min)`
    )

    // Re-queue the spec
    yield* sm.transitionTo(issue.number, 'queued').pipe(
      Effect.catchAll((error) => {
        return logError(`      Failed to recover: ${error}`)
      })
    )

    recovered.push({
      number: issue.number,
      specId: issue.title,
      ageMinutes: Math.round(ageMinutes),
    })
  }

  if (recovered.length === 0) {
    yield* skip('No stuck specs to recover')
  } else {
    yield* success(`Recovered ${recovered.length} stuck specs`)
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `recovered_count=${recovered.length}
recovered_issues=${recovered.map((r) => r.number).join(',')}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return { recovered: recovered.length, issues: recovered }
})

/**
 * Monitor PRs Command
 *
 * Checks open TDD automation PRs for:
 * - Auto-merge eligibility
 * - Merge conflicts
 * - Stale/stuck PRs
 */
const commandMonitorPRs = Effect.gen(function* () {
  const prManager = yield* PRManager
  const ghClient = yield* GitHubAPIClient
  const fs = yield* FileSystemService

  yield* logInfo('🔍 Monitoring TDD automation PRs...')

  // Get all open TDD automation PRs (filter by claude/ branch prefix)
  const allOpenPRs = yield* ghClient.listPRs({ state: 'open' })
  const openPRs = allOpenPRs.filter((pr) => pr.headRefName.startsWith('claude/'))

  if (openPRs.length === 0) {
    yield* skip('No open TDD automation PRs')
    return { processed: 0, autoMergeEnabled: 0, conflicts: 0 }
  }

  yield* logInfo(`   Found ${openPRs.length} open PRs`)

  let autoMergeEnabled = 0
  let conflicts = 0
  const processedPRs: Array<{ number: number; action: string }> = []

  for (const pr of openPRs) {
    const prInfo = yield* prManager
      .getPRInfo(pr.number)
      .pipe(Effect.catchAll(() => Effect.succeed(null)))

    if (!prInfo) {
      yield* logInfo(`   ⚠️  PR #${pr.number}: Could not get info`)
      continue
    }

    // Check for conflicts
    if (prInfo.hasConflicts) {
      yield* logInfo(`   ❌ PR #${pr.number}: Has merge conflicts`)
      conflicts++
      processedPRs.push({ number: pr.number, action: 'conflict_detected' })
      continue
    }

    // Enable auto-merge if not already enabled
    if (!prInfo.isAutoMergeEnabled) {
      const result = yield* prManager
        .enableAutoMerge(pr.number)
        .pipe(Effect.catchAll(() => Effect.succeed({ enabled: false, reason: 'error' })))

      if (result.enabled) {
        yield* logInfo(`   ✅ PR #${pr.number}: Auto-merge enabled`)
        autoMergeEnabled++
        processedPRs.push({ number: pr.number, action: 'auto_merge_enabled' })
      } else {
        yield* logInfo(`   ℹ️  PR #${pr.number}: ${result.reason}`)
        processedPRs.push({ number: pr.number, action: 'skipped' })
      }
    } else {
      yield* logInfo(`   ℹ️  PR #${pr.number}: Auto-merge already enabled`)
      processedPRs.push({ number: pr.number, action: 'already_enabled' })
    }
  }

  yield* logInfo('')
  yield* success(
    `Processed ${openPRs.length} PRs: ${autoMergeEnabled} auto-merge enabled, ${conflicts} conflicts`
  )

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `processed=${openPRs.length}
auto_merge_enabled=${autoMergeEnabled}
conflicts=${conflicts}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return { processed: openPRs.length, autoMergeEnabled, conflicts }
})

/**
 * Cleanup Branches Command
 *
 * Deletes orphaned TDD branches that:
 * - Are older than 30 minutes
 * - Have no associated PR
 */
const commandCleanupBranches = Effect.gen(function* () {
  const prManager = yield* PRManager
  const fs = yield* FileSystemService

  const minAgeMinutes = parseInt(
    process.env.ORPHAN_BRANCH_AGE_MINUTES ?? String(ORPHAN_BRANCH_AGE_MINUTES),
    10
  )

  yield* logInfo(`🔍 Searching for orphaned TDD branches (>${minAgeMinutes} min old)...`)

  const orphans = yield* prManager.findOrphanBranches(minAgeMinutes)

  if (orphans.length === 0) {
    yield* skip('No orphaned branches found')
    return { deleted: 0, branches: [] }
  }

  yield* logInfo(`   Found ${orphans.length} orphaned branches`)

  const deleted: string[] = []
  const failed: string[] = []

  for (const branch of orphans) {
    yield* logInfo(`   🗑️  Deleting: ${branch.name} (${Math.round(branch.ageMinutes)} min old)`)

    const result = yield* prManager
      .deleteBranch(branch.name)
      .pipe(Effect.catchAll(() => Effect.succeed({ deleted: false, reason: 'error' })))

    if (result.deleted) {
      deleted.push(branch.name)
    } else {
      failed.push(branch.name)
      yield* logInfo(`      Failed: ${result.reason}`)
    }
  }

  yield* logInfo('')
  if (deleted.length > 0) {
    yield* success(`Deleted ${deleted.length} orphaned branches`)
  }
  if (failed.length > 0) {
    yield* logError(`Failed to delete ${failed.length} branches`)
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `deleted_count=${deleted.length}
deleted_branches=${deleted.join(',')}
failed_count=${failed.length}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return { deleted: deleted.length, branches: deleted }
})

// =============================================================================
// Main CLI Entry Point
// =============================================================================

const main = Effect.gen(function* () {
  const command = process.argv[2]

  if (!command) {
    yield* logError('Usage: bun run cli/tdd-monitor.ts <command>')
    yield* logError('')
    yield* logError('Commands:')
    yield* logError('  health-check     - Calculate queue health metrics')
    yield* logError('  recover-stuck    - Reset stuck in-progress specs [--force]')
    yield* logError('  monitor-prs      - Check PR states, enable auto-merge')
    yield* logError('  cleanup-branches - Delete orphaned TDD branches')
    yield* logError('')
    process.exit(1)
  }

  switch (command) {
    case 'health-check':
      yield* commandHealthCheck
      break
    case 'recover-stuck':
      yield* commandRecoverStuck
      break
    case 'monitor-prs':
      yield* commandMonitorPRs
      break
    case 'cleanup-branches':
      yield* commandCleanupBranches
      break
    default:
      yield* logError(`Unknown command: ${command}`)
      yield* logError('')
      yield* logError('Run without arguments to see available commands.')
      process.exit(1)
  }
})

// =============================================================================
// Run with Dependencies
// =============================================================================

const MainLayer = Layer.mergeAll(
  FileSystemServiceLive,
  CommandServiceLive,
  LoggerServicePretty(),
  TimeUtilsLive,
  GitHubAPIClientLive,
  HealthMetricsLive,
  LabelStateMachineLive,
  PRManagerLive
)

Effect.runPromise(
  main.pipe(
    Effect.provide(MainLayer),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error('TDD Monitor error:', error)
        process.exit(1)
      })
    )
  )
)
