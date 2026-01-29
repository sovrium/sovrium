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
import { GitHubApiLive } from '../services/github-api'
import { GitOperationsLive } from '../services/git-operations'

/**
 * Production layer with all live service implementations
 *
 * Composed layers:
 * - GitHubApiLive: GitHub API operations via gh CLI
 * - CostTrackerLive: Cost parsing from workflow logs
 * - GitOperationsLive: Git operations via git CLI
 *
 * Note: Credit exhaustion detection is now handled by GitHub Actions workflow
 * (probe step in pr-creator.yml) and passed via PROBE_EXHAUSTED env var.
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
export const LiveLayer = Layer.mergeAll(GitHubApiLive, CostTrackerLive, GitOperationsLive)
