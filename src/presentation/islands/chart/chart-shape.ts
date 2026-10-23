/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How much of a chart is drawn around its marks, read once by the island and
 * reached by every canvas through context: a fixed plot `height`, the `strip`
 * variant (the marks alone) and the `barColor` rules painting a bar by its
 * record. Context rather than props because the canvases sit four bindings
 * deep and every one of them would otherwise thread three more arguments.
 */

import { createContext, useContext } from 'react'
import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-match-service'
import { CHART_TONE_FILL, CHART_TONE_STYLE } from '@/presentation/design/chart-default-classes'
import type { FieldCondition } from '@/domain/models/app/tables/condition-operators'

/** One `barColor` rule: the bars whose record matches `when` take `tone`. */
export interface ChartBarColorRule {
  readonly when: FieldCondition
  readonly tone: keyof typeof CHART_TONE_FILL
}

/** The shape a chart declares; every key absent draws the chart as it always was. */
export interface ChartShape {
  readonly height?: number
  readonly strip?: boolean
  readonly barColor?: readonly ChartBarColorRule[]
}

/** No key declared: the chart as it always was. */
export const NO_SHAPE: ChartShape = {}

/** The shape of the chart below, provided by `ShapedChartCanvas`. */
export const ChartShapeContext = createContext<ChartShape>(NO_SHAPE)

/** The shape of the chart being drawn. */
export const useChartShape = (): ChartShape => useContext(ChartShapeContext)

/** A matched bar's paint, and the variable it declares to resolve it. */
export interface ChartBarPaint {
  readonly fill: string
  readonly fillStyle?: Readonly<Record<string, string>>
}

/** The paint of the first rule `record` matches, or `undefined` to keep the series colour. */
export function barPaintOf(
  rules: readonly ChartBarColorRule[] | undefined,
  record: Readonly<Record<string, unknown>> | undefined
): ChartBarPaint | undefined {
  if (rules === undefined || record === undefined) return undefined
  const rule = rules.find((candidate) => satisfiesFieldCondition(candidate.when, record))
  if (rule === undefined) return undefined
  const fillStyle = CHART_TONE_STYLE[rule.tone]
  return { fill: CHART_TONE_FILL[rule.tone], ...(fillStyle === undefined ? {} : { fillStyle }) }
}
