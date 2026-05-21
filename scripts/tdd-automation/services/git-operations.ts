/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Context, Effect, Layer } from 'effect'
import { GitOperationError } from '../core/errors'

export interface GitResult {
  readonly success: boolean
  readonly output: string
}

export interface BranchStatus {
  readonly currentBranch: string
  readonly isAheadOfMain: boolean
  readonly isBehindMain: boolean
  readonly commitsBehind: number
  readonly commitsAhead: number
}

export interface ConflictInfo {
  readonly hasConflicts: boolean
  readonly conflictingFiles: readonly string[]
}

export interface GitOperationsService {
  readonly getCurrentBranch: () => Effect.Effect<string, GitOperationError>

  readonly createBranch: (branchName: string) => Effect.Effect<void, GitOperationError>

  readonly checkout: (branchName: string) => Effect.Effect<void, GitOperationError>

  readonly branchExists: (branchName: string) => Effect.Effect<boolean, GitOperationError>

  readonly fetch: () => Effect.Effect<void, GitOperationError>

  readonly rebase: (targetBranch: string) => Effect.Effect<void, GitOperationError>

  readonly rebaseAbort: () => Effect.Effect<void, GitOperationError>

  readonly push: (
    branchName: string,
    options?: { readonly force?: boolean }
  ) => Effect.Effect<void, GitOperationError>

  readonly getBranchStatus: (branchName: string) => Effect.Effect<BranchStatus, GitOperationError>

  readonly checkConflicts: (
    sourceBranch: string,
    targetBranch: string
  ) => Effect.Effect<ConflictInfo, GitOperationError>

  readonly commit: (message: string) => Effect.Effect<void, GitOperationError>

  readonly stageFile: (filePath: string) => Effect.Effect<void, GitOperationError>

  readonly deleteBranch: (branchName: string) => Effect.Effect<void, GitOperationError>

  readonly getHeadCommit: () => Effect.Effect<string, GitOperationError>
}

export class GitOperations extends Context.Tag('GitOperations')<
  GitOperations,
  GitOperationsService
>() {}

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

export const GitOperationsLive = Layer.succeed(GitOperations, {
  getCurrentBranch: () => execGit(['rev-parse', '--abbrev-ref', 'HEAD'], 'getCurrentBranch'),

  createBranch: (branchName) =>
    execGit(['checkout', '-b', branchName], 'createBranch').pipe(Effect.asVoid),

  checkout: (branchName) => execGit(['checkout', branchName], 'checkout').pipe(Effect.asVoid),

  branchExists: (branchName) =>
    Effect.gen(function* () {
      const localResult = yield* execGit(['branch', '--list', branchName], 'branchExists').pipe(
        Effect.either
      )

      if (localResult._tag === 'Right' && localResult.right.trim() !== '') {
        return true
      }

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
      yield* execGit(['fetch', 'origin'], 'fetch')

      const currentBranch = yield* execGit(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        'getCurrentBranch'
      )

      const behindResult = yield* execGit(
        ['rev-list', '--count', `${branchName}..origin/main`],
        'getBranchStatus'
      ).pipe(Effect.either)

      const commitsBehind =
        behindResult._tag === 'Right' ? parseInt(behindResult.right, 10) || 0 : 0

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
      const result = yield* execGit(
        ['merge-tree', `origin/${targetBranch}`, sourceBranch, `origin/${targetBranch}`],
        'checkConflicts'
      ).pipe(Effect.either)

      if (result._tag === 'Left') {
        const mergeResult = yield* execGit(
          ['merge', '--no-commit', '--no-ff', `origin/${targetBranch}`],
          'checkConflicts'
        ).pipe(Effect.either)

        yield* execGit(['merge', '--abort'], 'checkConflicts').pipe(
          Effect.catchAll(() => Effect.succeed(''))
        )

        if (mergeResult._tag === 'Left') {
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

  stageFile: (filePath) => execGit(['add', filePath], 'stageFile').pipe(Effect.asVoid),

  deleteBranch: (branchName) =>
    execGit(['branch', '-D', branchName], 'deleteBranch').pipe(Effect.asVoid),

  getHeadCommit: () => execGit(['rev-parse', 'HEAD'], 'getHeadCommit'),
})
