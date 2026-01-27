/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Create PR CLI Entry Point
 *
 * CLI script called by pr-creator.yml workflow to create a new TDD PR.
 * Requires spec information passed via environment variable.
 *
 * Usage:
 *   SPEC_JSON='{"specId":"APP-001","file":"...","line":10,...}' \
 *   bun run scripts/tdd-automation/workflows/pr-creator/create-pr.ts
 *
 * Output (JSON):
 *   { "success": true, "prNumber": 123, "prUrl": "...", "branch": "tdd/app-001" }
 *   { "success": false, "error": "..." }
 */

import { Effect, Console, Data } from 'effect'
import { LiveLayer } from '../../layers/live'
import { createTDDPR } from '../../programs/create-tdd-pr'
import type { ReadySpec } from '../../core/types'

/**
 * Error: Failed to parse SPEC_JSON environment variable
 */
class JSONParseError extends Data.TaggedError('JSONParseError')<{
  readonly cause: unknown
}> {}

const main = Effect.gen(function* () {
  // Get spec from environment
  const specJson = process.env['SPEC_JSON']
  if (!specJson) {
    yield* Console.error('::error::SPEC_JSON environment variable not set')
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(
      JSON.stringify({
        success: false,
        error: 'SPEC_JSON environment variable not set',
      })
    )
    return
  }

  const specResult = yield* Effect.try({
    try: () => JSON.parse(specJson) as ReadySpec,
    catch: (error) => new JSONParseError({ cause: error }),
  }).pipe(Effect.either)

  if (specResult._tag === 'Left') {
    yield* Console.error('::error::Failed to parse SPEC_JSON')
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(
      JSON.stringify({
        success: false,
        error: 'Failed to parse SPEC_JSON',
      })
    )
    return
  }

  const spec = specResult.right

  const result = yield* createTDDPR({ spec })

  // effect-disable-next-line preferSchemaOverJson
  yield* Console.log(
    JSON.stringify({
      success: true,
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      branch: result.branch,
      specId: result.specId,
    })
  )
}).pipe(
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          success: false,
          error: `GitHub API error: ${error.operation} - ${error.message}`,
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
          success: false,
          error: `Git error: ${error.operation} - ${error.message}`,
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
