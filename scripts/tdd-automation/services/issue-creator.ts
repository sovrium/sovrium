/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Issue Creator Service
 *
 * Handles GitHub issue creation for spec items
 */

import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import { CommandService, logError, logWarn, skip, success } from '../../lib/effect'
import { specHasIssue } from './queue-operations'
import type { SpecItem } from './types'
import type { LoggerService } from '../../lib/effect'

/**
 * Create a minimal spec issue on GitHub
 *
 * @param spec - The spec item to create an issue for
 * @param skipExistenceCheck - Skip individual existence check (used when bulk deduplication is done)
 *
 * DUPLICATE PREVENTION:
 * - When skipExistenceCheck=false: Performs individual API check before creation
 * - When skipExistenceCheck=true: Relies on caller's bulk deduplication
 * - Race condition window: ~1-2 seconds between check and creation
 */
export const createSpecIssue = (
  spec: SpecItem,
  skipExistenceCheck = false
): Effect.Effect<number, never, CommandService | LoggerService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    // SAFETY CHECK: Verify issue doesn't exist (unless bulk deduplication was done)
    // Checks ALL states (open + closed) to prevent duplicates
    if (!skipExistenceCheck) {
      const hasIssue = yield* specHasIssue(spec.specId)
      if (hasIssue) {
        yield* skip(`Issue already exists for ${spec.specId}, skipping`)
        return -1
      }
    }

    const title = `🤖 ${spec.specId}: ${spec.description}`
    const bodyText = `## 🤖 ${spec.specId}: ${spec.description}

**File**: \`${spec.file}:${spec.line}\`
**Feature**: ${spec.feature}

### Implementation Instructions

This spec will be automatically picked up by the TDD queue processor and implemented by Claude Code.

**What happens automatically**:
1. Queue processor marks issue as in-progress
2. Queue processor posts @claude comment to trigger Claude Code workflow
3. Claude Code automatically creates branch with pattern \`claude/issue-{ISSUE_NUMBER}-{timestamp}\`
4. Removes \`.fixme()\` from test ${spec.specId}
5. Implements minimal code to pass test
6. Runs validation before pushing
7. Commits: \`fix: implement ${spec.specId}\`
8. Auto-merge to main if validation passes

**Validation runs automatically**: Spec test → Regression tests → Quality checks`

    // Write body to temp file to avoid shell escaping issues
    // Heredocs don't work reliably across all shell environments (especially in CI)
    const tempFile = join(tmpdir(), `gh-issue-body-${spec.specId}-${Date.now()}.md`)
    try {
      writeFileSync(tempFile, bodyText, 'utf-8')
    } catch (error) {
      yield* logError(`Failed to write temp file for ${spec.specId}: ${error}`)
      return -1
    }

    const output = yield* cmd
      .exec(
        `gh issue create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(tempFile)} --label "tdd-spec:queued,tdd-automation"`,
        { throwOnError: false }
      )
      .pipe(
        Effect.catchAll((error) => {
          return Effect.gen(function* () {
            yield* logError(`Failed to create issue for ${spec.specId}: ${error}`)
            return ''
          })
        })
      )

    // Clean up temp file
    try {
      unlinkSync(tempFile)
    } catch {
      // Ignore cleanup errors
    }

    // Extract issue number from URL (gh outputs the URL)
    const issueMatch = output.match(/\/issues\/(\d+)/)
    const issueNumber = issueMatch?.[1] ? parseInt(issueMatch[1], 10) : -1

    if (issueNumber > 0) {
      yield* success(`Created issue #${issueNumber} for ${spec.specId}`)
    } else if (output.trim()) {
      // Log unexpected output for debugging
      yield* logWarn(`Unexpected gh output for ${spec.specId}: ${output.slice(0, 100)}`)
    } else {
      yield* logWarn(`No output from gh issue create for ${spec.specId}`)
    }

    return issueNumber
  })
