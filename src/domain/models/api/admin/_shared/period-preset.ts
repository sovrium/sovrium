/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'

export const periodPresetSchema = z
  .enum(['24h', '7d', '30d'])
  .default('24h')
  .describe(
    'Time window for the overview rollup. 24h returns 1h-bucket series; 7d and 30d return 1d-bucket series. Default: 24h.'
  )

export type PeriodPreset = z.infer<typeof periodPresetSchema>

export const seriesIntervalSchema = z
  .enum(['1h', '1d'])
  .describe('Bucket interval for the overview series rollup. Derived from the period preset.')

export type SeriesInterval = z.infer<typeof seriesIntervalSchema>

export interface PeriodWindow {
  readonly from: string
  readonly to: string
  readonly interval: '1h' | '1d'
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const PRESET_TO_WINDOW: Readonly<
  Record<PeriodPreset, { readonly offsetMs: number; readonly interval: '1h' | '1d' }>
> = {
  '24h': { offsetMs: 24 * HOUR_MS, interval: '1h' },
  '7d': { offsetMs: 7 * DAY_MS, interval: '1d' },
  '30d': { offsetMs: 30 * DAY_MS, interval: '1d' },
}

export function resolvePeriodWindow(
  preset: 'default' | PeriodPreset = 'default',
  now: Date = new Date()
): PeriodWindow {
  const resolved: PeriodPreset = preset === 'default' ? '24h' : preset
  const { offsetMs, interval } = PRESET_TO_WINDOW[resolved]
  const from = new Date(now.getTime() - offsetMs)

  return {
    from: from.toISOString(),
    to: now.toISOString(),
    interval,
  }
}
