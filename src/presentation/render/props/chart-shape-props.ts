/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { chartFillWindow } from '@/domain/models/app/pages/components/component-types/data/chart/fill-empty-service'
import { renderNow } from '../page/render-clock'
import type { ComponentOfType } from '@/domain/models/app/pages/components'

/**
 * What a chart declares about its own drawing — a fixed plot `height`, the
 * `chartVariant`, the `barColor` rules — and the window `fillEmpty` fills,
 * resolved at this render's "now" so the island never reads a clock of its own.
 * Every key is absent unless the chart declares it.
 */
export const chartShapeProps = (component: ComponentOfType<'chart'>): Record<string, unknown> => ({
  height: component.height,
  chartVariant: component.chartVariant,
  barColor: component.barColor,
  fillWindow: chartFillWindow(component, renderNow()),
})
