/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find Next Spec CLI Entry Point
 *
 * CLI script called by pr-creator.yml workflow to find the next spec to implement.
 * Respects priority ordering: APP > MIG > STATIC > API > ADMIN
 *
 * Usage:
 *   bun run scripts/tdd-automation/workflows/pr-creator/find-next-spec.ts
 *
 * Output (JSON):
 *   { "found": true, "spec": { "specId": "APP-001", "file": "...", "line": 10, ... } }
 *   { "found": false, "spec": null }
 */

import { Effect, Console, Layer } from 'effect'
import { FileSystemServiceLive, LoggerServiceLive } from '../../../lib/effect'
import { findReadySpec } from '../../core/find-ready-spec'
import { LiveLayer } from '../../layers/live'

const main = Effect.gen(function* () {
  const result = yield* findReadySpec

  if (result) {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(
      JSON.stringify({
        found: true,
        spec: result,
      })
    )
  } else {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    yield* Console.log(
      JSON.stringify({
        found: false,
        spec: null,
      })
    )
  }
}).pipe(
  Effect.catchTag('GitHubApiError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::GitHub API error: ${error.operation}`)
      // @effect-diagnostics effect/preferSchemaOverJson:off
      yield* Console.log(
        JSON.stringify({
          found: false,
          spec: null,
          error: `GitHub API error: ${error.operation}`,
        })
      )
    })
  ),
  Effect.provide(
    LiveLayer.pipe(
      Layer.provideMerge(FileSystemServiceLive),
      Layer.provideMerge(LoggerServiceLive())
    )
  )
)

Effect.runPromise(main)
