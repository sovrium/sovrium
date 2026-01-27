/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Create TDD PR Program
 *
 * Effect program that creates a new TDD automation PR for a spec.
 * Handles branch creation, initial commit, and PR setup.
 */

import { Effect } from 'effect'
import { TDD_CONFIG, TDD_LABELS, getTDDBranchName, formatTDDPRTitle } from '../core/config'
import { GitOperations } from '../services/git-operations'
import { GitHubApi } from '../services/github-api'
import type { ReadySpec } from '../core/types'

/**
 * Result of creating a TDD PR
 */
export interface CreatePRResult {
  readonly prNumber: number
  readonly prUrl: string
  readonly branch: string
  readonly specId: string
}

/**
 * Create TDD PR options
 */
export interface CreateTDDPROptions {
  /** The spec to implement */
  readonly spec: ReadySpec
  /** Whether to enable auto-merge (default: true) */
  readonly enableAutoMerge?: boolean
}

/**
 * Create a new TDD PR for a spec
 *
 * Steps:
 * 1. Create branch from main: tdd/<spec-id>
 * 2. Create PR with title: [TDD] Implement <spec-id> | Attempt 1/5
 * 3. Add tdd-automation label
 * 4. Enable auto-merge (optional)
 *
 * @param options CreateTDDPROptions
 * @returns CreatePRResult with PR details
 */
export const createTDDPR = (options: CreateTDDPROptions) =>
  Effect.gen(function* () {
    const { spec, enableAutoMerge = true } = options
    const github = yield* GitHubApi
    const git = yield* GitOperations

    const branch = getTDDBranchName(spec.specId)
    const title = formatTDDPRTitle(spec.specId, 1, TDD_CONFIG.MAX_ATTEMPTS)

    // Ensure we're on main and up to date
    yield* git.checkout(TDD_CONFIG.BASE_BRANCH)
    yield* git.fetch()

    // Check if branch already exists
    const branchExists = yield* git.branchExists(branch)
    if (branchExists) {
      // Checkout existing branch and reset to main
      yield* git.checkout(branch)
      yield* git.rebase(TDD_CONFIG.BASE_BRANCH)
    } else {
      // Create new branch
      yield* git.createBranch(branch)
    }

    // Push branch to remote
    yield* git.push(branch, { force: branchExists })

    // Create PR
    const prBody = `## TDD Automation

**Spec ID**: \`${spec.specId}\`
**File**: \`${spec.file}:${spec.line}\`
**Description**: ${spec.description}

---

This PR was created by the TDD automation pipeline.

### Instructions for Claude Code

1. Implement the feature to make the \`test.fixme()\` test pass
2. Run \`bun test:e2e:spec\` to verify the implementation
3. Keep changes minimal and focused on the spec requirements

### Attempt Tracking

- Current attempt: 1/${TDD_CONFIG.MAX_ATTEMPTS}
- After ${TDD_CONFIG.MAX_ATTEMPTS} failed attempts, this PR will be labeled for manual intervention
`

    const pr = yield* github.createPR({
      title,
      body: prBody,
      branch,
      base: TDD_CONFIG.BASE_BRANCH,
      labels: [],
    })

    // Add TDD automation label
    yield* github.addLabel(pr.number, TDD_LABELS.AUTOMATION)

    // Enable auto-merge if requested
    if (enableAutoMerge) {
      yield* github.enableAutoMerge(pr.number, 'squash')
    }

    return {
      prNumber: pr.number,
      prUrl: pr.url,
      branch,
      specId: spec.specId,
    } satisfies CreatePRResult
  })
