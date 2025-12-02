/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { CommandService } from './CommandService'

/**
 * Git Error Types
 */
export class GitError extends Data.TaggedError('GitError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Execution mode for git change detection
 * - 'ci': Compare HEAD vs origin/main (for PR branches)
 * - 'local': Uncommitted changes only (for local development)
 */
export type ExecutionMode = 'ci' | 'local'

/**
 * Git Service Interface
 */
export interface GitService {
  /**
   * Auto-detect execution mode based on environment
   * - Returns 'ci' if GITHUB_ACTIONS=true and not on main branch
   * - Returns 'local' otherwise
   */
  readonly getMode: () => Effect.Effect<ExecutionMode, GitError>

  /**
   * Get list of changed files based on mode
   * - 'ci': Files changed between merge-base with main and HEAD
   * - 'local': Staged + unstaged + untracked files
   */
  readonly getChangedFiles: (mode: ExecutionMode) => Effect.Effect<readonly string[], GitError>

  /**
   * Detect the base branch name (main or master)
   */
  readonly getBaseBranch: () => Effect.Effect<string, GitError>

  /**
   * Get the current branch name
   */
  readonly getCurrentBranch: () => Effect.Effect<string, GitError>
}

/**
 * Git Service Tag (for dependency injection)
 */
export const GitService = Context.GenericTag<GitService>('GitService')

/**
 * Live Git Service Implementation
 */
export const GitServiceLive = Layer.effect(
  GitService,
  Effect.gen(function* () {
    const cmd = yield* CommandService

    const getBaseBranch = (): Effect.Effect<string, GitError> =>
      Effect.gen(function* () {
        // Try to detect main branch name from remote
        const branches = yield* cmd
          .exec('git branch -r --list "origin/main" "origin/master"', { throwOnError: false })
          .pipe(Effect.catchAll(() => Effect.succeed('')))

        if (branches.includes('origin/main')) return 'main'
        if (branches.includes('origin/master')) return 'master'
        return 'main' // Default to main
      })

    const getCurrentBranch = (): Effect.Effect<string, GitError> =>
      Effect.gen(function* () {
        const branch = yield* cmd
          .exec('git rev-parse --abbrev-ref HEAD', { throwOnError: false })
          .pipe(
            Effect.map((s) => s.trim()),
            Effect.catchAll(() => Effect.succeed('main'))
          )
        return branch
      })

    const getMode = (): Effect.Effect<ExecutionMode, GitError> =>
      Effect.gen(function* () {
        const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
        const isCI = process.env.CI === 'true'

        if (isGitHubActions || isCI) {
          // Check if we're on a feature branch (not main)
          const currentBranch = yield* getCurrentBranch()
          const mainBranch = yield* getBaseBranch()

          // If on main, use local mode to check uncommitted changes
          if (currentBranch === mainBranch) {
            return 'local' as ExecutionMode
          }
          return 'ci' as ExecutionMode
        }
        return 'local' as ExecutionMode
      })

    const getChangedFiles = (mode: ExecutionMode): Effect.Effect<readonly string[], GitError> =>
      Effect.gen(function* () {
        if (mode === 'local') {
          // Get all uncommitted changes: staged + unstaged + untracked
          const staged = yield* cmd
            .exec('git diff --name-only --cached', { throwOnError: false })
            .pipe(Effect.catchAll(() => Effect.succeed('')))

          const unstaged = yield* cmd
            .exec('git diff --name-only', { throwOnError: false })
            .pipe(Effect.catchAll(() => Effect.succeed('')))

          const untracked = yield* cmd
            .exec('git ls-files --others --exclude-standard', { throwOnError: false })
            .pipe(Effect.catchAll(() => Effect.succeed('')))

          const allFiles = [
            ...staged.split('\n'),
            ...unstaged.split('\n'),
            ...untracked.split('\n'),
          ]

          // Deduplicate and filter empty strings
          return [...new Set(allFiles)].filter((f) => f.length > 0)
        }

        // CI mode: Compare HEAD against merge-base with main
        const baseBranch = yield* getBaseBranch()

        // Fetch the base branch to ensure we have the latest
        yield* cmd
          .exec(`git fetch origin ${baseBranch}:${baseBranch} 2>/dev/null || true`, {
            throwOnError: false,
          })
          .pipe(Effect.catchAll(() => Effect.succeed('')))

        // Find the merge-base (common ancestor)
        const mergeBase = yield* cmd
          .exec(`git merge-base HEAD origin/${baseBranch}`, { throwOnError: false })
          .pipe(
            Effect.map((s) => s.trim()),
            Effect.catchAll(() => Effect.succeed('HEAD~1'))
          )

        // Get files changed since merge-base
        const diff = yield* cmd
          .exec(`git diff --name-only ${mergeBase}...HEAD`, { throwOnError: false })
          .pipe(Effect.catchAll(() => Effect.succeed('')))

        return diff.split('\n').filter((f) => f.length > 0)
      })

    return GitService.of({
      getMode,
      getChangedFiles,
      getBaseBranch,
      getCurrentBranch,
    })
  })
)

/**
 * Helper functions for common operations
 */

/**
 * Get execution mode (auto-detect CI vs local)
 */
export const getMode = () => GitService.pipe(Effect.flatMap((s) => s.getMode()))

/**
 * Get changed files based on execution mode
 */
export const getChangedFiles = (mode: ExecutionMode) =>
  GitService.pipe(Effect.flatMap((s) => s.getChangedFiles(mode)))

/**
 * Get base branch name (main or master)
 */
export const getBaseBranch = () => GitService.pipe(Effect.flatMap((s) => s.getBaseBranch()))

/**
 * Get current branch name
 */
export const getCurrentBranch = () => GitService.pipe(Effect.flatMap((s) => s.getCurrentBranch()))
