/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sync Branch CLI Entry Point
 *
 * CLI script called by claude-code.yml workflow to sync a TDD branch
 * with main before running Claude Code.
 *
 * Usage:
 *   BRANCH_NAME=tdd/app-001 bun run scripts/tdd-automation/workflows/claude-code/sync-branch.ts
 *
 * Output (JSON):
 *   { "synced": true, "wasOutOfSync": false }
 *   { "synced": true, "wasOutOfSync": true, "commitsBehind": 5, "rebased": true }
 *   { "synced": false, "hasConflicts": true, "conflictingFiles": [...] }
 */

import { Effect, Console } from 'effect'
import { TDD_LABELS } from '../../core/config'
import { LiveLayer } from '../../layers/live'
import { syncWithMain } from '../../programs/sync-with-main'
import { GitHubApi } from '../../services/github-api'

const main = Effect.gen(function* () {
  const branchName = process.env['BRANCH_NAME']

  if (!branchName) {
    yield* Console.error('::error::BRANCH_NAME environment variable not set')
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(
      JSON.stringify({
        synced: false,
        error: 'BRANCH_NAME not set',
      })
    )
    return
  }

  const result = yield* syncWithMain({ branch: branchName })

  // effect-disable-next-line preferSchemaOverJson
  yield* Console.log(
    JSON.stringify({
      synced: true,
      wasOutOfSync: result.wasOutOfSync,
      commitsBehind: result.commitsBehind,
      rebased: result.rebased,
      newHeadCommit: result.newHeadCommit,
    })
  )
}).pipe(
  Effect.catchTag('MergeConflict', (error) =>
    Effect.gen(function* () {
      const github = yield* GitHubApi
      const prNumberStr = process.env['PR_NUMBER']

      yield* Console.warn(`::warning::Merge conflict detected in ${error.branch}`)

      // Add conflict label if PR number is available
      if (prNumberStr) {
        const prNumber = parseInt(prNumberStr, 10)
        yield* github.addLabel(prNumber, TDD_LABELS.HAD_CONFLICT)
        yield* github.postComment(
          prNumber,
          `## Merge Conflict Detected

This branch has conflicts with main that cannot be automatically resolved.

**Conflicting files:**
${error.conflictingFiles.map((f) => `- \`${f}\``).join('\n')}

### Manual intervention required:

1. Resolve the conflicts locally
2. Push the resolved changes
3. Remove the \`${TDD_LABELS.HAD_CONFLICT}\` label

---

*This comment was posted by the TDD automation pipeline.*`
        )
      }

      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          synced: false,
          hasConflicts: true,
          conflictingFiles: error.conflictingFiles,
        })
      )
    })
  ),
  Effect.catchTag('GitOperationError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::Git error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          synced: false,
          error: `Git error: ${error.operation}`,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
