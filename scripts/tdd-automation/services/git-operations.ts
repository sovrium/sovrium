/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Git Operations Service
 *
 * Effect service for Git operations using the git CLI.
 * Handles branch management, rebasing, and conflict detection.
 */

import { Context, Effect, Layer } from 'effect'
import { GitOperationError } from '../core/errors'

/**
 * Result of a git operation
 */
export interface GitResult {
  readonly success: boolean
  readonly output: string
}

/**
 * Branch status information
 */
export interface BranchStatus {
  readonly currentBranch: string
  readonly isAheadOfMain: boolean
  readonly isBehindMain: boolean
  readonly commitsBehind: number
  readonly commitsAhead: number
}

/**
 * Merge conflict information
 */
export interface ConflictInfo {
  readonly hasConflicts: boolean
  readonly conflictingFiles: readonly string[]
}

/**
 * Git Operations Service interface
 */
export interface GitOperationsService {
  /**
   * Get current branch name
   */
  readonly getCurrentBranch: () => Effect.Effect<string, GitOperationError>

  /**
   * Create and checkout a new branch
   */
  readonly createBranch: (branchName: string) => Effect.Effect<void, GitOperationError>

  /**
   * Checkout an existing branch
   */
  readonly checkout: (branchName: string) => Effect.Effect<void, GitOperationError>

  /**
   * Check if a branch exists (local or remote)
   */
  readonly branchExists: (branchName: string) => Effect.Effect<boolean, GitOperationError>

  /**
   * Fetch from remote
   */
  readonly fetch: () => Effect.Effect<void, GitOperationError>

  /**
   * Rebase current branch onto target branch
   */
  readonly rebase: (targetBranch: string) => Effect.Effect<void, GitOperationError>

  /**
   * Abort an in-progress rebase
   */
  readonly rebaseAbort: () => Effect.Effect<void, GitOperationError>

  /**
   * Push branch to remote (with optional force)
   */
  readonly push: (
    branchName: string,
    options?: { readonly force?: boolean }
  ) => Effect.Effect<void, GitOperationError>

  /**
   * Get branch status relative to main
   */
  readonly getBranchStatus: (branchName: string) => Effect.Effect<BranchStatus, GitOperationError>

  /**
   * Check for merge conflicts with target branch
   */
  readonly checkConflicts: (
    sourceBranch: string,
    targetBranch: string
  ) => Effect.Effect<ConflictInfo, GitOperationError>

  /**
   * Create a commit with message
   */
  readonly commit: (message: string) => Effect.Effect<void, GitOperationError>

  /**
   * Stage all changes
   */
  readonly stageAll: () => Effect.Effect<void, GitOperationError>

  /**
   * Get the commit hash of HEAD
   */
  readonly getHeadCommit: () => Effect.Effect<string, GitOperationError>
}

/**
 * Git Operations Service Tag
 */
export class GitOperations extends Context.Tag('GitOperations')<
  GitOperations,
  GitOperationsService
>() {}

/**
 * Execute a git command and return the result
 */
const execGit = (args: string[], operation: string): Effect.Effect<string, GitOperationError> =>
  Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(['git', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        throw new Error(stderr || stdout || `Git command failed with exit code ${exitCode}`)
      }

      return stdout.trim()
    },
    catch: (error) =>
      new GitOperationError({
        operation,
        stderr: error instanceof Error ? error.message : String(error),
      }),
  })

/**
 * Live implementation of Git Operations Service
 */
export const GitOperationsLive = Layer.succeed(GitOperations, {
  getCurrentBranch: () => execGit(['rev-parse', '--abbrev-ref', 'HEAD'], 'getCurrentBranch'),

  createBranch: (branchName) =>
    execGit(['checkout', '-b', branchName], 'createBranch').pipe(Effect.asVoid),

  checkout: (branchName) => execGit(['checkout', branchName], 'checkout').pipe(Effect.asVoid),

  branchExists: (branchName) =>
    Effect.gen(function* () {
      // Check local branches
      const localResult = yield* execGit(['branch', '--list', branchName], 'branchExists').pipe(
        Effect.either
      )

      if (localResult._tag === 'Right' && localResult.right.trim() !== '') {
        return true
      }

      // Check remote branches
      const remoteResult = yield* execGit(
        ['ls-remote', '--heads', 'origin', branchName],
        'branchExists'
      ).pipe(Effect.either)

      return remoteResult._tag === 'Right' && remoteResult.right.trim() !== ''
    }),

  fetch: () => execGit(['fetch', 'origin'], 'fetch').pipe(Effect.asVoid),

  rebase: (targetBranch) =>
    execGit(['rebase', `origin/${targetBranch}`], 'rebase').pipe(Effect.asVoid),

  rebaseAbort: () => execGit(['rebase', '--abort'], 'rebaseAbort').pipe(Effect.asVoid),

  push: (branchName, options) =>
    execGit(
      options?.force
        ? ['push', '--force-with-lease', 'origin', branchName]
        : ['push', 'origin', branchName],
      'push'
    ).pipe(Effect.asVoid),

  getBranchStatus: (branchName) =>
    Effect.gen(function* () {
      // Fetch first to get latest remote state
      yield* execGit(['fetch', 'origin'], 'fetch')

      const currentBranch = yield* execGit(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        'getCurrentBranch'
      )

      // Get commits behind main
      const behindResult = yield* execGit(
        ['rev-list', '--count', `${branchName}..origin/main`],
        'getBranchStatus'
      ).pipe(Effect.either)

      const commitsBehind =
        behindResult._tag === 'Right' ? parseInt(behindResult.right, 10) || 0 : 0

      // Get commits ahead of main
      const aheadResult = yield* execGit(
        ['rev-list', '--count', `origin/main..${branchName}`],
        'getBranchStatus'
      ).pipe(Effect.either)

      const commitsAhead = aheadResult._tag === 'Right' ? parseInt(aheadResult.right, 10) || 0 : 0

      return {
        currentBranch,
        isAheadOfMain: commitsAhead > 0,
        isBehindMain: commitsBehind > 0,
        commitsBehind,
        commitsAhead,
      } satisfies BranchStatus
    }),

  checkConflicts: (sourceBranch, targetBranch) =>
    Effect.gen(function* () {
      // Try a dry-run merge to detect conflicts
      const result = yield* execGit(
        ['merge-tree', `origin/${targetBranch}`, sourceBranch, `origin/${targetBranch}`],
        'checkConflicts'
      ).pipe(Effect.either)

      if (result._tag === 'Left') {
        // If merge-tree fails, check with merge --no-commit
        const mergeResult = yield* execGit(
          ['merge', '--no-commit', '--no-ff', `origin/${targetBranch}`],
          'checkConflicts'
        ).pipe(Effect.either)

        // Abort the merge regardless of outcome
        yield* execGit(['merge', '--abort'], 'checkConflicts').pipe(
          Effect.catchAll(() => Effect.succeed(''))
        )

        if (mergeResult._tag === 'Left') {
          // Parse conflict files from error stderr
          const conflictMatch = mergeResult.left.stderr.match(/CONFLICT.*?: (.+)/g)
          const conflictingFiles = conflictMatch
            ? conflictMatch.map((m) => m.replace(/CONFLICT.*?: /, ''))
            : []

          return {
            hasConflicts: true,
            conflictingFiles,
          } satisfies ConflictInfo
        }
      }

      return {
        hasConflicts: false,
        conflictingFiles: [],
      } satisfies ConflictInfo
    }),

  commit: (message) => execGit(['commit', '-m', message], 'commit').pipe(Effect.asVoid),

  stageAll: () => execGit(['add', '-A'], 'stageAll').pipe(Effect.asVoid),

  getHeadCommit: () => execGit(['rev-parse', 'HEAD'], 'getHeadCommit'),
})
