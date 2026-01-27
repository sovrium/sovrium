/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Detect Merge Conflicts Program
 *
 * Effect program that detects merge conflicts between a TDD branch and main.
 * Used by the merge-watchdog workflow.
 */

import { Effect } from 'effect'
import { TDD_CONFIG } from '../core/config'
import { GitOperations } from '../services/git-operations'

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  readonly branch: string
  readonly hasConflicts: boolean
  readonly conflictingFiles: readonly string[]
  readonly isBehindMain: boolean
  readonly commitsBehind: number
}

/**
 * Detect merge conflicts between a branch and main
 *
 * Performs a dry-run merge check without modifying any branches.
 *
 * @param branch Branch to check for conflicts
 * @returns ConflictDetectionResult with conflict details
 */
export const detectMergeConflicts = (branch: string) =>
  Effect.gen(function* () {
    const git = yield* GitOperations

    // Fetch latest
    yield* git.fetch()

    // Get branch status
    const status = yield* git.getBranchStatus(branch)

    // If not behind main, no conflicts possible
    if (!status.isBehindMain) {
      return {
        branch,
        hasConflicts: false,
        conflictingFiles: [],
        isBehindMain: false,
        commitsBehind: 0,
      } satisfies ConflictDetectionResult
    }

    // Check for conflicts
    const conflictInfo = yield* git.checkConflicts(branch, TDD_CONFIG.BASE_BRANCH)

    return {
      branch,
      hasConflicts: conflictInfo.hasConflicts,
      conflictingFiles: conflictInfo.conflictingFiles,
      isBehindMain: status.isBehindMain,
      commitsBehind: status.commitsBehind,
    } satisfies ConflictDetectionResult
  })

/**
 * Batch detect conflicts for multiple branches
 *
 * Efficiently checks multiple TDD branches for conflicts.
 *
 * @param branches Array of branch names to check
 * @returns Array of ConflictDetectionResult
 */
export const detectConflictsForBranches = (branches: readonly string[]) =>
  Effect.forEach(branches, detectMergeConflicts, { concurrency: 3 })
