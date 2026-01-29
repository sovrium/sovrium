/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Code Probe Service Tests
 *
 * Unit tests for ClaudeCodeProbe service using test layer.
 */

import { test, expect } from 'bun:test'
import { Effect } from 'effect'
import { ClaudeCodeProbe, ClaudeCodeProbeTest } from './claude-code-probe'

test('ClaudeCodeProbeTest - exhausted credits', async () => {
  const program = Effect.gen(function* () {
    const probe = yield* ClaudeCodeProbe
    return yield* probe.probe()
  }).pipe(Effect.provide(ClaudeCodeProbeTest(true)))

  const result = await Effect.runPromise(program)

  expect(result.isExhausted).toBe(true)
  expect(result.totalCostUsd).toBe(0)
  expect(result.errorMessage).toBe('Credits exhausted')
  expect(result.rawJson).toContain('"is_error":true')
  expect(result.rawJson).toContain('"total_cost_usd":0')
})

test('ClaudeCodeProbeTest - credits available', async () => {
  const program = Effect.gen(function* () {
    const probe = yield* ClaudeCodeProbe
    return yield* probe.probe()
  }).pipe(Effect.provide(ClaudeCodeProbeTest(false)))

  const result = await Effect.runPromise(program)

  expect(result.isExhausted).toBe(false)
  expect(result.totalCostUsd).toBe(0)
  expect(result.errorMessage).toBeUndefined()
  expect(result.rawJson).toContain('"is_error":false')
})
