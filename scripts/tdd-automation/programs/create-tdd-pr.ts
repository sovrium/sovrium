/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { TDD_CONFIG, TDD_LABELS, getTDDBranchName, formatTDDPRTitle } from '../core/config'
import { GitOperationError } from '../core/errors'
import { GitOperations } from '../services/git-operations'
import { ForgejoApi } from '../services/vcs-api'
import type { ReadySpec } from '../core/types'

export interface CreatePRResult {
  readonly prNumber: number
  readonly prUrl: string
  readonly branch: string
  readonly specId: string
}

export interface CreateTDDPROptions {
  readonly spec: ReadySpec
}

export const createTDDPR = (options: CreateTDDPROptions) =>
  Effect.gen(function* () {
    const { spec } = options
    const forgejo = yield* ForgejoApi
    const git = yield* GitOperations

    const branch = getTDDBranchName(spec.specId)
    const title = formatTDDPRTitle(spec.specId, 1, TDD_CONFIG.MAX_ATTEMPTS)

    yield* git.checkout(TDD_CONFIG.BASE_BRANCH)
    yield* git.fetch()

    const branchExists = yield* git.branchExists(branch)

    yield* git.deleteBranch(branch).pipe(Effect.catchAll(() => Effect.void))

    yield* git.createBranch(branch)

    yield* Effect.tryPromise({
      try: async () => {
        const file = Bun.file(spec.file)
        const content = await file.text()
        const lines = content.split('\n')

        const lineIndex = spec.line - 1
        const targetLine = lines[lineIndex]
        if (targetLine !== undefined) {
          lines[lineIndex] = targetLine.replace(/test\.fixme\s*\(/, 'test(')
        }

        await Bun.write(spec.file, lines.join('\n'))
      },
      catch: (error) =>
        new GitOperationError({
          operation: 'activateSpec',
          stderr: error instanceof Error ? error.message : String(error),
        }),
    })

    yield* git.stageFile(spec.file)
    yield* git.commit(`test: activate spec ${spec.specId}`)

    yield* git.push(branch, { force: branchExists })

    const prBody = `## TDD Automation

**Spec ID**: \`${spec.specId}\`
**File**: \`${spec.file}:${spec.line}\`
**Description**: ${spec.description}

---

This PR was created by the TDD automation pipeline.

### Instructions for Claude Code

1. The \`.fixme()\` marker has been removed — the test is now active and expected to fail
2. Implement the feature to make the activated test pass
3. Run \`bun test:e2e -- ${spec.file}\` to verify the implementation
4. Keep changes minimal and focused on the spec requirements

### Attempt Tracking

- Current attempt: 1/${TDD_CONFIG.MAX_ATTEMPTS}
- After ${TDD_CONFIG.MAX_ATTEMPTS} failed attempts, this PR will be labeled for manual intervention
`

    const pr = yield* forgejo.createPR({
      title,
      body: prBody,
      branch,
      base: TDD_CONFIG.BASE_BRANCH,
      labels: [TDD_LABELS.AUTOMATION],
    })


    return {
      prNumber: pr.number,
      prUrl: pr.url,
      branch,
      specId: spec.specId,
    } satisfies CreatePRResult
  })
