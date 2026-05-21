/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { CommandService } from './CommandService'

export class GitError extends Data.TaggedError('GitError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export type ExecutionMode = 'ci' | 'local'

export interface GitService {
  readonly getMode: () => Effect.Effect<ExecutionMode, GitError>

  readonly getChangedFiles: (mode: ExecutionMode) => Effect.Effect<readonly string[], GitError>

  readonly getBaseBranch: () => Effect.Effect<string, GitError>

  readonly getCurrentBranch: () => Effect.Effect<string, GitError>
}

export const GitService = Context.GenericTag<GitService>('GitService')

export const GitServiceLive = Layer.effect(
  GitService,
  Effect.gen(function* () {
    const cmd = yield* CommandService

    const getBaseBranch = (): Effect.Effect<string, GitError> =>
      Effect.gen(function* () {
        const branches = yield* cmd
          .exec('git branch -r --list "origin/main" "origin/master"', { throwOnError: false })
          .pipe(Effect.catchAll(() => Effect.succeed('')))

        if (branches.includes('origin/main')) return 'main'
        if (branches.includes('origin/master')) return 'master'
        return 'main'
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
          const currentBranch = yield* getCurrentBranch()
          const mainBranch = yield* getBaseBranch()

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

          return [...new Set(allFiles)].filter((f) => f.length > 0)
        }

        const baseBranch = yield* getBaseBranch()

        yield* cmd
          .exec(`git fetch origin ${baseBranch}:${baseBranch} 2>/dev/null || true`, {
            throwOnError: false,
          })
          .pipe(Effect.catchAll(() => Effect.succeed('')))

        const mergeBase = yield* cmd
          .exec(`git merge-base HEAD origin/${baseBranch}`, { throwOnError: false })
          .pipe(
            Effect.map((s) => s.trim()),
            Effect.catchAll(() => Effect.succeed('HEAD~1'))
          )

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


export const getMode = () => GitService.pipe(Effect.flatMap((s) => s.getMode()))

export const getChangedFiles = (mode: ExecutionMode) =>
  GitService.pipe(Effect.flatMap((s) => s.getChangedFiles(mode)))

export const getBaseBranch = () => GitService.pipe(Effect.flatMap((s) => s.getBaseBranch()))

export const getCurrentBranch = () => GitService.pipe(Effect.flatMap((s) => s.getCurrentBranch()))
