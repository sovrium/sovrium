/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { parseEcoAiMaxCarbonClass } from '@/domain/models/env/eco/eco-ai-max-carbon-class'
import { parseEcoAiProviderPrecedenceList } from '@/domain/models/env/eco/eco-ai-provider-list'
import { parseEcoIndexHeader } from '@/domain/models/env/eco/eco-index-header'
import {
  parseEcoMode,
  resolveActivatedSubKnobs,
  type EcoMode,
  type EcoSubKnob,
} from '@/domain/models/env/eco/eco-mode'
import { parseEcoRetentionPurgeDays } from '@/domain/models/env/eco/eco-retention-purge-days'
import type { EcoOverviewResponse } from '@/domain/models/api/admin/eco/overview'
import type { EcoIndexTrackerSnapshot } from '@/infrastructure/utils/eco-index-tracker'


export interface StorageConsumerInput {
  readonly type: 'table' | 'bucket'
  readonly name: string
  readonly bytes: number
  readonly retentionDays: number | null
}

export interface AiCarbonClassCountsInput {
  readonly A: number
  readonly B: number
  readonly C: number
  readonly D: number
  readonly E: number
  readonly F: number
  readonly G: number
}

const EMPTY_AI_COUNTS: AiCarbonClassCountsInput = {
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
  F: 0,
  G: 0,
}

export interface GetEcoOverviewInputs {
  readonly env: Readonly<Record<string, string | undefined>>
  readonly tracker: EcoIndexTrackerSnapshot
  readonly storageConsumers: readonly StorageConsumerInput[]
  readonly aiCarbonClassCounts?: AiCarbonClassCountsInput
}

const resolveEffectiveRetention = (
  perResource: number | null,
  globalDefault: number | undefined
): number | null => {
  if (perResource !== null && perResource > 0) return perResource
  if (globalDefault !== undefined && globalDefault > 0) return globalDefault
  return null
}

const computeRgesn = (
  env: Readonly<Record<string, string | undefined>>,
  mode: EcoMode
): Readonly<{
  passing: number
  total: 78
  byAxis: Readonly<{ frugality: number; transparency: number; durability: number }>
}> => {
  const frugality = [
    mode === 'strict' || mode === 'balanced',
    parseEcoIndexHeader(env) === 'on',
    env['ECO_PAGE_CACHE']?.trim().toLowerCase() !== 'off',
    env['ECO_IMAGE_FORMAT']?.trim().toLowerCase() !== 'png',
    env['ECO_LOW_DATA_DEFAULT']?.trim().toLowerCase() !== 'off',
  ].filter(Boolean).length

  const transparency = [
    parseEcoIndexHeader(env) === 'on',
    true,
    true,
  ].filter(Boolean).length

  const durability = [
    parseEcoRetentionPurgeDays(env) !== undefined,
    true,
  ].filter(Boolean).length

  return {
    passing: frugality + transparency + durability,
    total: 78,
    byAxis: { frugality, transparency, durability },
  }
}

export const buildEcoOverview = (inputs: GetEcoOverviewInputs): EcoOverviewResponse => {
  const { env, tracker, storageConsumers, aiCarbonClassCounts = EMPTY_AI_COUNTS } = inputs

  const ecoMode = parseEcoMode(env)
  const activatedSubKnobs: readonly EcoSubKnob[] = resolveActivatedSubKnobs(ecoMode)
  const indexHeaderMode = parseEcoIndexHeader(env)
  const globalRetention = parseEcoRetentionPurgeDays(env)

  const topStorageConsumers = storageConsumers
    .toSorted((a, b) => b.bytes - a.bytes)
    .slice(0, 3)
    .map((row) => ({
      type: row.type,
      name: row.name,
      bytes: row.bytes,
      retentionDays: resolveEffectiveRetention(row.retentionDays, globalRetention),
    }))

  return {
    ecoMode,
    activatedSubKnobs: [...activatedSubKnobs],
    ecoIndexHeader: {
      enabled: indexHeaderMode === 'on',
      currentGrade: tracker.currentGrade,
      graded: tracker.graded,
      since: tracker.since,
    },
    aiProviderMix: {
      precedence: [...parseEcoAiProviderPrecedenceList(env)],
      byCarbonClass: { ...aiCarbonClassCounts },
      maxCarbonClass: parseEcoAiMaxCarbonClass(env),
    },
    topStorageConsumers,
    rgesn: computeRgesn(env, ecoMode),
    telemetrySource: 'local',
  }
}
