/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation Test Layer
 *
 * Test layer composition with mock service implementations.
 * Used for unit testing TDD automation programs.
 */

import { Layer, Effect } from 'effect'
import { CostTracker, type CostTrackerService } from '../services/cost-tracker'
import {
  GitOperations,
  type GitOperationsService,
  type BranchStatus,
  type ConflictInfo,
} from '../services/git-operations'
import { GitHubApi, type GitHubApiService, type WorkflowRun } from '../services/github-api'
import type { TDDPullRequest } from '../core/types'

/**
 * Create test layer with custom mock implementations
 *
 * @param options Mock implementations for services
 * @returns Composed test layer
 *
 * @example
 * ```typescript
 * const testLayer = createTestLayer({
 *   mockCost: 10,
 *   mockPRs: [],
 *   mockRuns: [{ id: '123', ... }]
 * })
 *
 * const result = await Effect.runPromise(
 *   checkCreditLimits.pipe(Effect.provide(testLayer))
 * )
 * ```
 */
export function createTestLayer(options: {
  readonly mockCost?: number
  readonly mockPRs?: readonly TDDPullRequest[]
  readonly mockRuns?: readonly WorkflowRun[]
  readonly mockLogs?: string
  readonly mockBranchStatus?: BranchStatus
  readonly mockConflictInfo?: ConflictInfo
}) {
  const {
    mockCost = 10,
    mockPRs = [],
    mockRuns = [],
    mockLogs = 'Total cost: $10.00',
    mockBranchStatus = {
      currentBranch: 'main',
      isAheadOfMain: false,
      isBehindMain: false,
      commitsBehind: 0,
      commitsAhead: 0,
    },
    mockConflictInfo = {
      hasConflicts: false,
      conflictingFiles: [],
    },
  } = options

  const GitHubApiTest = Layer.succeed(GitHubApi, {
    listTDDPRs: () => Effect.succeed(mockPRs),
    getPR: (prNumber) =>
      Effect.succeed({
        number: prNumber,
        title: '[TDD] Implement TEST-001 | Attempt 1/5',
        branch: 'tdd/test-001',
        state: 'open' as const,
        labels: ['tdd-automation'],
      }),
    getWorkflowRuns: () => Effect.succeed(mockRuns),
    getRunLogs: () => Effect.succeed(mockLogs),
    createPR: () => Effect.succeed({ number: 1, url: 'https://github.com/test/pr/1' }),
    updatePRTitle: () => Effect.void,
    addLabel: () => Effect.void,
    postComment: () => Effect.void,
    enableAutoMerge: () => Effect.void,
  } satisfies GitHubApiService)

  const CostTrackerTest = Layer.succeed(CostTracker, {
    parseCostFromLogs: () => Effect.succeed(mockCost),
  } satisfies CostTrackerService)

  const GitOperationsTest = Layer.succeed(GitOperations, {
    getCurrentBranch: () => Effect.succeed(mockBranchStatus.currentBranch),
    createBranch: () => Effect.void,
    checkout: () => Effect.void,
    branchExists: () => Effect.succeed(false),
    fetch: () => Effect.void,
    rebase: () => Effect.void,
    rebaseAbort: () => Effect.void,
    push: () => Effect.void,
    getBranchStatus: () => Effect.succeed(mockBranchStatus),
    checkConflicts: () => Effect.succeed(mockConflictInfo),
    commit: () => Effect.void,
    stageAll: () => Effect.void,
    getHeadCommit: () => Effect.succeed('abc123'),
  } satisfies GitOperationsService)

  return CostTrackerTest.pipe(
    Layer.provideMerge(GitHubApiTest),
    Layer.provideMerge(GitOperationsTest)
  )
}

/**
 * Default test layer with reasonable mock values
 *
 * - mockCost: $10 per run
 * - mockPRs: empty array
 * - mockRuns: empty array
 * - mockBranchStatus: in sync with main
 * - mockConflictInfo: no conflicts
 */
export const TestLayer = createTestLayer({})
