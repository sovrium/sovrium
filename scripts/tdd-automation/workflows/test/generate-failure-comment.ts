#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate Failure Comment CLI Entry Point
 *
 * CLI script called by test.yml workflow to generate Claude Code trigger comments for test failures.
 * Reads context from environment variables and outputs comment to stdout.
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/test/generate-failure-comment.ts
 *
 * Environment Variables:
 *   SPEC_ID, TARGET_SPEC, NEW_ATTEMPT, MAX_ATTEMPTS, BRANCH, FAILURE_TYPE
 *
 * Output (Markdown):
 *   Complete failure comment markdown written to stdout
 */

import { Effect, Console } from 'effect'
import {
  generateFailureComment,
  parseFailureCommentContext,
} from '../../services/failure-comment-generator'

const main = Effect.gen(function* () {
  // Parse context from environment variables (GitHub Actions outputs)
  const context = yield* parseFailureCommentContext(process.env as Record<string, string>)

  // Generate failure comment
  const comment = yield* generateFailureComment(context)

  // Output comment to stdout (will be written to file by YAML)
  yield* Console.log(comment)
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::Failed to generate failure comment: ${error}`)
      return yield* error
    })
  )
)

await Effect.runPromise(main)
