/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer } from 'effect'
import type { TDDState, SpecQueueItem } from '../types'

/**
 * Priority Calculator Service
 *
 * Calculates priority score for individual spec IDs based on:
 * 1. File path depth (shallower = higher priority, likely foundational)
 * 2. Spec ID position within file (earlier = higher priority)
 * 3. Number of failures (fewer failures = higher priority for likely success)
 * 4. Error type from last attempt (infrastructure/regression lower priority)
 */
export class PriorityCalculator extends Context.Tag('PriorityCalculator')<
  PriorityCalculator,
  {
    readonly calculate: (spec: SpecQueueItem) => number
  }
>() {}

export const PriorityCalculatorLive = Layer.succeed(PriorityCalculator, {
  calculate: (spec) => {
    let score = 50 // Base score

    // Factor 1: Path depth (shallower = more foundational)
    // specs/api/tables.spec.ts (depth 2) → +15
    // specs/api/tables/create.spec.ts (depth 3) → +0
    // specs/api/tables/fields/validation.spec.ts (depth 4) → -15
    const pathParts = spec.filePath.split('/')
    const depth = pathParts.length
    if (depth <= 3) {
      score += 15
    } else if (depth >= 5) {
      score -= 15
    }

    // Factor 2: Use spec's pre-calculated priority from extractor
    // This reflects position within file (earlier specs = higher priority)
    score += (spec.priority - 50) * 0.5 // Dampen effect to 50% weight

    // Factor 3: Failure history (fewer failures = higher chance of success)
    // 0 failures → +20, 1 failure → +10, 2 failures → -10
    switch (spec.attempts) {
      case 0: {
        score += 20

        break
      }
      case 1: {
        score += 10

        break
      }
      case 2: {
        score -= 10

        break
      }
      // No default
    }

    // Factor 4: Error type from last attempt (if any)
    if (spec.errors.length > 0) {
      const lastError = spec.errors.at(-1)
      if (lastError?.type === 'infrastructure') {
        // Infrastructure errors less likely to succeed immediately
        score -= 25
      } else if (lastError?.type === 'regression') {
        // Regressions need architectural thinking
        score -= 15
      }
    }

    // Clamp to 0-100 range
    return Math.max(0, Math.min(100, score))
  },
})

/**
 * Spec Selector Service
 *
 * Selects next spec IDs to process based on:
 * - Eligibility (not at max retries, not in cooldown, file not locked, spec not active)
 * - File-grouping priority (all specs in fileA before fileB)
 * - Priority score within same file (calculated by PriorityCalculator)
 *
 * Key behavior:
 * - Groups specs by file path
 * - Processes all specs from fileA before moving to fileB
 * - Within same file, sorts by priority score
 * - Respects file-level locking (workers can't process same file concurrently)
 */
export class SpecSelector extends Context.Tag('SpecSelector')<
  SpecSelector,
  {
    readonly selectNext: (
      count: number,
      state: TDDState
    ) => Effect.Effect<SpecQueueItem[], never, PriorityCalculator>
  }
>() {}

export const SpecSelectorLive = Layer.succeed(SpecSelector, {
  selectNext: (count, state) =>
    Effect.gen(function* () {
      const calculator = yield* PriorityCalculator

      // Filter eligible specs
      const eligible = state.queue.pending.filter((spec) => {
        // 1. Skip if already attempted max times (3 strikes rule)
        if (spec.attempts >= state.config.maxRetries) {
          return false
        }

        // 2. Skip if file is currently being processed (file-level locking)
        if (state.activeFiles.includes(spec.filePath)) {
          return false
        }

        // 3. Skip if spec is currently active (spec-level tracking)
        if (state.activeSpecs.includes(spec.specId)) {
          return false
        }

        // 4. Skip if in cooldown (last attempt < configured delay ago)
        if (spec.lastAttempt) {
          const lastAttemptTime = new Date(spec.lastAttempt).getTime()
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

      // Group specs by file path
      const specsByFile = new Map<string, SpecQueueItem[]>()
      for (const spec of eligible) {
        const fileSpecs = specsByFile.get(spec.filePath) ?? []
        fileSpecs.push(spec)
        specsByFile.set(spec.filePath, fileSpecs)
      }

      // Sort files by the highest priority spec in each file
      // This ensures we complete all specs in fileA before moving to fileB
      const filesByPriority = Array.from(specsByFile.entries())
        .map(([filePath, specs]) => {
          // Calculate priority for each spec in this file
          const specsWithPriority = specs.map((spec) => ({
            spec,
            priority: calculator.calculate(spec),
          }))

          // Sort specs within file by priority (highest first)
          specsWithPriority.sort((a, b) => b.priority - a.priority)

          // File priority is the highest spec priority in that file
          const filePriority = specsWithPriority[0]?.priority ?? 0

          return {
            filePath,
            specs: specsWithPriority,
            priority: filePriority,
          }
        })
        .sort((a, b) => b.priority - a.priority) // Sort files by priority (highest first)

      // Select specs respecting file-grouping priority
      const selected: SpecQueueItem[] = []
      let remaining = count

      for (const { filePath, specs } of filesByPriority) {
        if (remaining === 0) break

        // Take specs from this file (up to remaining count)
        const toTake = Math.min(remaining, specs.length)
        const selectedFromFile = specs.slice(0, toTake).map((item) => item.spec)

        selected.push(...selectedFromFile)
        remaining -= toTake

        yield* Effect.log(
          `Selected ${selectedFromFile.length} spec(s) from ${filePath} (priority: ${specs[0]?.priority})`
        )
      }

      // Log detailed selection
      yield* Effect.log(
        `Selected ${selected.length} specs total (from ${eligible.length} eligible):`
      )
      for (const spec of selected) {
        const priority = calculator.calculate(spec)
        yield* Effect.log(
          `  - ${spec.specId} in ${spec.filePath} (priority: ${priority}, attempts: ${spec.attempts})`
        )
      }

      return selected
    }),
})
