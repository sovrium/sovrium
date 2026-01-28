/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check Stuck PRs CLI Entry Point
 *
 * CLI script called by merge-watchdog.yml workflow to find TDD PRs
 * that are stuck (behind main with conflicts).
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/merge-watchdog/check-stuck-prs.ts
 *
 * Output (JSON):
 *   { "stuckPRs": [], "count": 0 }
 *   { "stuckPRs": [{ "number": 123, "specId": "APP-001", "reason": "conflicts" }], "count": 1 }
 */

import { Effect, Console } from 'effect'
import { TDD_LABELS } from '../../core/config'
import { LiveLayer } from '../../layers/live'
import { detectMergeConflicts } from '../../programs/detect-merge-conflicts'
import { GitHubApi } from '../../services/github-api'

interface StuckPR {
  readonly number: number
  readonly specId: string
  readonly branch: string
  readonly reason: 'conflicts' | 'behind_main' | 'manual_intervention'
  readonly commitsBehind?: number
  readonly conflictingFiles?: readonly string[]
}

const main = Effect.gen(function* () {
  const github = yield* GitHubApi

  // Get all TDD PRs
  const prs = yield* github.listTDDPRs()

  const stuckPRs: StuckPR[] = []

  for (const pr of prs) {
    // Check if marked for manual intervention
    if (pr.hasManualInterventionLabel) {
      stuckPRs.push({
        number: pr.number,
        specId: pr.specId,
        branch: pr.branch,
        reason: 'manual_intervention',
      })
      continue
    }

    // Check for conflicts with main
    const conflictResult = yield* detectMergeConflicts(pr.branch).pipe(
      Effect.catchAll(() =>
        Effect.succeed({
          branch: pr.branch,
          hasConflicts: false,
          conflictingFiles: [] as readonly string[],
          isBehindMain: false,
          commitsBehind: 0,
        })
      )
    )

    if (conflictResult.hasConflicts) {
      stuckPRs.push({
        number: pr.number,
        specId: pr.specId,
        branch: pr.branch,
        reason: 'conflicts',
        conflictingFiles: conflictResult.conflictingFiles,
        commitsBehind: conflictResult.commitsBehind,
      })

      // Add manual intervention label if not already present
      if (!pr.hasManualInterventionLabel) {
        yield* github.addLabel(pr.number, TDD_LABELS.MANUAL_INTERVENTION)
      }
    } else if (conflictResult.isBehindMain && conflictResult.commitsBehind > 10) {
      // Flag PRs significantly behind main (>10 commits)
      stuckPRs.push({
        number: pr.number,
        specId: pr.specId,
        branch: pr.branch,
        reason: 'behind_main',
        commitsBehind: conflictResult.commitsBehind,
      })
    }
  }

  // Log warnings for stuck PRs
  for (const stuck of stuckPRs) {
    yield* Console.warn(
      `::warning::Stuck TDD PR #${stuck.number} (${stuck.specId}): ${stuck.reason}`
    )
  }

  // @effect-diagnostics effect/preferSchemaOverJson:off
  yield* Console.log(
    JSON.stringify({
      stuckPRs,
      count: stuckPRs.length,
    })
  )
}).pipe(
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          stuckPRs: [],
          count: 0,
          error: `GitHub API error: ${error.operation}`,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
