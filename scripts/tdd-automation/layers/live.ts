/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation Live Layer
 *
 * Production layer composition with all live service implementations.
 * Provides dependency injection for TDD automation programs.
 */

import { Layer } from 'effect'
import { CostTrackerLive } from '../services/cost-tracker'
import { ClaudeCodeProbeLive } from '../services/claude-code-probe'
import { GitOperationsLive } from '../services/git-operations'
import { GitHubApiLive } from '../services/github-api'

/**
 * Production layer with all live service implementations
 *
 * Composed layers:
 * - GitHubApiLive: GitHub API operations via gh CLI
 * - CostTrackerLive: Cost parsing from workflow logs
 * - ClaudeCodeProbeLive: Claude Code API credit exhaustion detection
 * - GitOperationsLive: Git operations via git CLI
 *
 * Usage:
 * ```typescript
 * import { LiveLayer } from '../layers/live'
 *
 * const result = await Effect.runPromise(
 *   checkCreditLimits.pipe(Effect.provide(LiveLayer))
 * )
 * ```
 */
export const LiveLayer = Layer.mergeAll(
  GitHubApiLive,
  CostTrackerLive,
  ClaudeCodeProbeLive,
  GitOperationsLive
)
