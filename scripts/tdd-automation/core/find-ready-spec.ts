/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Console } from 'effect'
import { ForgejoApi } from '../services/vcs-api'
import { getSpecPhase } from './schema-priority-calculator'
import { scanForFixmeSpecs } from './spec-scanner'
import type { ReadySpec } from './types'

const TDD_MAX_PHASE = Number(process.env['TDD_MAX_PHASE'] ?? '2')

function extractFilePrefix(specId: string): string | null {
  const match = specId.match(/^(.+)-(?:\d+|REGRESSION)$/i)
  if (match && match[1]) {
    return match[1].toUpperCase()
  }
  return null
}

export const findReadySpec = (blockedFiles?: readonly string[]) =>
  Effect.gen(function* () {
    const forgejoApi = yield* ForgejoApi

    yield* Console.error('🔍 Finding next ready spec for TDD automation...')
    yield* Console.error('')

    const openPRs = yield* forgejoApi.listTDDPRs()

    const activePRs = openPRs.filter((pr) => !pr.hasManualInterventionLabel)

    if (activePRs.length > 0) {
      const activePR = activePRs[0]!
      yield* Console.error(`⏳ Active TDD PR found: #${activePR.number} (${activePR.specId})`)
      yield* Console.error('   Serial processing: waiting for current PR to complete')
      return null as ReadySpec | null
    }

    yield* Console.error('📂 Scanning for .fixme() specs...')

    const scanResult = yield* scanForFixmeSpecs

    if (scanResult.specs.length === 0) {
      yield* Console.error('✅ No .fixme() specs found - all tests are passing!')
      return null as ReadySpec | null
    }

    yield* Console.error(`   Found ${scanResult.specs.length} .fixme() specs`)

    const specIdsWithPRs = new Set(openPRs.map((pr) => pr.specId))
    let availableSpecs = scanResult.specs.filter((spec) => !specIdsWithPRs.has(spec.specId))

    if (availableSpecs.length === 0) {
      yield* Console.error('⏳ All .fixme() specs have open PRs (pending or manual intervention)')
      return null as ReadySpec | null
    }

    yield* Console.error(`   ${availableSpecs.length} specs available (no existing PR)`)

    if (blockedFiles && blockedFiles.length > 0) {
      const blockedFilesSet = new Set(blockedFiles.map((f) => f.toUpperCase()))

      yield* Console.error(`🚫 Filtering specs from ${blockedFiles.length} blocked file(s):`)
      for (const filePrefix of blockedFiles) {
        yield* Console.error(`   - ${filePrefix}`)
      }

      const beforeBlockFilter = availableSpecs.length
      availableSpecs = availableSpecs.filter((spec) => {
        const filePrefix = extractFilePrefix(spec.specId)
        if (!filePrefix) return true
        return !blockedFilesSet.has(filePrefix)
      })

      const blockedCount = beforeBlockFilter - availableSpecs.length
      if (blockedCount > 0) {
        yield* Console.error(`   Filtered out ${blockedCount} spec(s) from blocked files`)
      }

      if (availableSpecs.length === 0) {
        yield* Console.error('⏳ All available specs are from blocked files (manual-intervention)')
        return null as ReadySpec | null
      }

      yield* Console.error(`   ${availableSpecs.length} specs available after file blocking`)
    }

    {
      const beforePhaseFilter = availableSpecs.length
      availableSpecs = availableSpecs.filter((spec) => {
        const phase = getSpecPhase(spec.specId)
        return phase <= TDD_MAX_PHASE
      })

      const phaseFilteredCount = beforePhaseFilter - availableSpecs.length
      if (phaseFilteredCount > 0) {
        yield* Console.error(
          `🚫 Filtered out ${phaseFilteredCount} spec(s) from Phase ${TDD_MAX_PHASE + 1}+ (TDD_MAX_PHASE=${TDD_MAX_PHASE})`
        )
      }

      if (availableSpecs.length === 0) {
        yield* Console.error(
          `⏳ All remaining specs are from Phase ${TDD_MAX_PHASE + 1}+ (excluded by TDD_MAX_PHASE=${TDD_MAX_PHASE})`
        )
        return null as ReadySpec | null
      }

      yield* Console.error(`   ${availableSpecs.length} specs available after phase filter`)
    }

    const nextSpec = availableSpecs[0]!

    yield* Console.error('')
    yield* Console.error('✅ Next spec to process:')
    yield* Console.error(`   Spec ID: ${nextSpec.specId}`)
    yield* Console.error(`   File: ${nextSpec.file}:${nextSpec.line}`)
    yield* Console.error(`   Description: ${nextSpec.description}`)
    yield* Console.error(`   Priority: ${nextSpec.priority}`)

    return {
      specId: nextSpec.specId,
      file: nextSpec.file,
      line: nextSpec.line,
      description: nextSpec.description,
      priority: nextSpec.priority,
    } as ReadySpec | null
  })
