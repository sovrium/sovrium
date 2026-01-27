/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sync With Main Program
 *
 * Effect program that synchronizes a TDD branch with main.
 * Handles rebasing and conflict detection.
 */

import { Effect } from 'effect'
import { TDD_CONFIG } from '../core/config'
import { MergeConflict } from '../core/errors'
import { GitOperations } from '../services/git-operations'

/**
 * Result of sync operation
 */
export interface SyncResult {
  readonly wasOutOfSync: boolean
  readonly commitsBehind: number
  readonly rebased: boolean
  readonly newHeadCommit: string
}

/**
 * Sync options
 */
export interface SyncOptions {
  /** Branch to sync */
  readonly branch: string
  /** Force push after rebase (default: true) */
  readonly forcePush?: boolean
}

/**
 * Sync a TDD branch with main
 *
 * Steps:
 * 1. Fetch latest from remote
 * 2. Check if branch is behind main
 * 3. If behind, rebase onto main
 * 4. Push changes (force if rebased)
 *
 * @param options SyncOptions
 * @returns SyncResult with sync status
 * @throws MergeConflict if rebase fails due to conflicts
 */
export const syncWithMain = (options: SyncOptions) =>
  Effect.gen(function* () {
    const { branch, forcePush = true } = options
    const git = yield* GitOperations

    // Fetch latest
    yield* git.fetch()

    // Get branch status
    const status = yield* git.getBranchStatus(branch)

    if (!status.isBehindMain) {
      // Already in sync
      const headCommit = yield* git.getHeadCommit()
      return {
        wasOutOfSync: false,
        commitsBehind: 0,
        rebased: false,
        newHeadCommit: headCommit,
      } satisfies SyncResult
    }

    // Checkout the branch
    yield* git.checkout(branch)

    // Try to rebase onto main
    const rebaseResult = yield* git.rebase(TDD_CONFIG.BASE_BRANCH).pipe(Effect.either)

    if (rebaseResult._tag === 'Left') {
      // Rebase failed - likely due to conflicts
      // Abort the rebase
      yield* git.rebaseAbort().pipe(Effect.catchAll(() => Effect.void))

      // Check for actual conflicts
      const conflictInfo = yield* git.checkConflicts(branch, TDD_CONFIG.BASE_BRANCH)

      return yield* new MergeConflict({
        branch,
        conflictingFiles: [...conflictInfo.conflictingFiles],
      })
    }

    // Push the rebased branch
    if (forcePush) {
      yield* git.push(branch, { force: true })
    }

    const newHeadCommit = yield* git.getHeadCommit()

    return {
      wasOutOfSync: true,
      commitsBehind: status.commitsBehind,
      rebased: true,
      newHeadCommit,
    } satisfies SyncResult
  })

/**
 * Check if a branch needs syncing with main
 *
 * Lightweight check that doesn't modify anything.
 *
 * @param branch Branch to check
 * @returns true if branch is behind main
 */
export const needsSync = (branch: string) =>
  Effect.gen(function* () {
    const git = yield* GitOperations
    yield* git.fetch()
    const status = yield* git.getBranchStatus(branch)
    return status.isBehindMain
  })
