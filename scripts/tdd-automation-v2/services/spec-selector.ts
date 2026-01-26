/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import type { TDDState, SpecFileItem } from '../types'

/**
 * Priority Calculator Service
 *
 * Calculates priority score for spec files based on:
 * 1. Number of tests (fewer tests = higher priority for quick wins)
 * 2. Number of failures (fewer failures = higher priority for likely success)
 * 3. File path depth (shallower = higher priority, likely foundational)
 */
export class PriorityCalculator extends Context.Tag('PriorityCalculator')<
  PriorityCalculator,
  {
    readonly calculate: (spec: SpecFileItem) => number
  }
>() {}

export const PriorityCalculatorLive = Layer.succeed(PriorityCalculator, {
  calculate: (spec) => {
    let score = 50 // Base score

    // Factor 1: Test count (fewer tests = quicker to fix = higher priority)
    // Range: 1-10 tests → +20, 11-20 → +10, 21-50 → +0, 50+ → -10
    if (spec.testCount <= 10) {
      score += 20
    } else if (spec.testCount <= 20) {
      score += 10
    } else if (spec.testCount > 50) {
      score -= 10
    }

    // Factor 2: Failure history (fewer failures = higher chance of success)
    // 0 failures → +15, 1 failure → +5, 2 failures → -5
    if (spec.attempts === 0) {
      score += 15
    } else if (spec.attempts === 1) {
      score += 5
    } else if (spec.attempts === 2) {
      score -= 5
    }

    // Factor 3: Path depth (shallower = more foundational)
    // specs/api/tables.spec.ts (depth 2) → +10
    // specs/api/tables/create.spec.ts (depth 3) → +0
    // specs/api/tables/fields/validation.spec.ts (depth 4) → -10
    const pathParts = spec.filePath.split('/')
    const depth = pathParts.length
    if (depth <= 3) {
      score += 10
    } else if (depth >= 5) {
      score -= 10
    }

    // Factor 4: Error type from last attempt (if any)
    if (spec.errors.length > 0) {
      const lastError = spec.errors[spec.errors.length - 1]
      if (lastError.type === 'infrastructure') {
        // Infrastructure errors less likely to succeed immediately
        score -= 20
      } else if (lastError.type === 'regression') {
        // Regressions need architectural thinking
        score -= 10
      }
    }

    // Clamp to 0-100 range
    return Math.max(0, Math.min(100, score))
  },
})

/**
 * Spec Selector Service
 *
 * Selects next spec files to process based on:
 * - Eligibility (not at max retries, not in cooldown, file not locked)
 * - Priority score (calculated by PriorityCalculator)
 */
export class SpecSelector extends Context.Tag('SpecSelector')<
  SpecSelector,
  {
    readonly selectNext: (
      count: number,
      state: TDDState
    ) => Effect.Effect<SpecFileItem[], never, PriorityCalculator>
  }
>() {}

export const SpecSelectorLive = Layer.succeed(SpecSelector, {
  selectNext: (count, state) =>
    Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      // Filter eligible specs
      const eligible = state.queue.pending.filter((specFile) => {
        // 1. Skip if already attempted max times (3 strikes rule)
        if (specFile.attempts >= state.config.maxRetries) {
          return false
        }

        // 2. Skip if file is currently being processed (file-level locking)
        if (state.activeFiles.includes(specFile.filePath)) {
          return false
        }

        // 3. Skip if in cooldown (last attempt < configured delay ago)
        if (specFile.lastAttempt) {
          const lastAttemptTime = new Date(specFile.lastAttempt).getTime()
          const cooldownMs = state.config.retryDelayMinutes * 60 * 1000
          const timeSinceLastAttempt = Date.now() - lastAttemptTime

          if (timeSinceLastAttempt < cooldownMs) {
            return false
          }
        }

        return true
      })

      if (eligible.length === 0) {
        yield* Effect.log('No eligible specs to process')
        return []
      }

      // Calculate priorities for all eligible specs
      const withPriorities = eligible.map((specFile) => ({
        specFile,
        priority: calculator.calculate(specFile),
      }))

      // Sort by priority (descending - highest priority first)
      const sorted = withPriorities.sort((a, b) => b.priority - a.priority)

      // Take top N specs
      const selected = sorted.slice(0, count).map((item) => item.specFile)

      // Log selection
      yield* Effect.log(`Selected ${selected.length} specs (from ${eligible.length} eligible):`)
      for (const spec of selected) {
        const priority = withPriorities.find((w) => w.specFile.id === spec.id)?.priority
        yield* Effect.log(
          `  - ${spec.filePath} (priority: ${priority}, tests: ${spec.testCount}, attempts: ${spec.attempts})`
        )
      }

      return selected
    }),
})
