/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  KPI_LABEL_ROW_CLASSES,
  KPI_TREND_GROUP_CLASSES,
  computeKpiCardClasses,
  computeKpiIconClasses,
  computeKpiLabelClasses,
  computeKpiTrendClasses,
  computeKpiValueClasses,
} from '@/presentation/design/kpi-default-classes'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import { KpiSparkline } from './kpi-sparkline'
import type { ReactElement } from 'react'

/**
 * Trend comparison configuration surfaced beneath the KPI value.
 */
export interface KpiTrendConfig {
  readonly comparisonPeriod?: string
  readonly direction?: 'up' | 'down' | 'flat'
  readonly changePercent: number
  readonly color?: 'green' | 'red' | 'yellow' | 'gray'
}

interface KpiCardProps {
  readonly label?: string
  readonly value: string
  readonly icon?: string
  /**
   * Server-resolved geometry for {@link KpiCardProps.icon}. Resolved in
   * `extractKpiProps` and serialized into `data-island-props`, so the island
   * draws the icon without bundling lucide's ~2,000-icon set — see
   * `@/presentation/utils/lucide-glyph`.
   */
  readonly iconNode?: unknown
  readonly trend?: KpiTrendConfig
  /** Conditional color name resolved from `thresholds` — applied to the value. */
  readonly thresholdColor?: string
  /** Sparkline series — when present, a mini line chart is rendered. */
  readonly sparklineSeries?: readonly number[]
}

/**
 * The icon box, in CSS pixels — the canvas `kpiCard` glyph.
 *
 * Set as `width`/`height` on the `<svg>` rather than as a Tailwind class
 * because lucide's `Icon` renderer writes those attributes itself; a class
 * competing with them would resolve unpredictably.
 */
const ICON_BOX = 16

/**
 * Canonical role-token text class for a resolved threshold color name.
 *
 * The semantic name (`red`/`green`/`yellow`) maps to the matching role token
 * (`error`/`success`/`warning`); `blue` is the brand `primary`, `gray` the
 * muted foreground. The rendered value also carries a `data-threshold`
 * attribute, which is the stable hook specs assert on.
 */
const THRESHOLD_COLOR_CLASS: Record<string, string> = {
  red: 'text-error-fg',
  green: 'text-success-fg',
  yellow: 'text-warning-fg',
  blue: 'text-primary',
  gray: 'text-foreground-muted',
}

const TREND_COLOR_CLASS: Record<NonNullable<KpiTrendConfig['color']>, string> = {
  green: 'text-success-fg',
  red: 'text-error-fg',
  yellow: 'text-warning-fg',
  gray: 'text-foreground-muted',
}

const TREND_DIRECTION_ARROW: Record<NonNullable<KpiTrendConfig['direction']>, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

/**
 * Renders the trend indicator (arrow + percentage change).
 *
 * The arrow and the percentage are wrapped as ONE group on the canvas' 2px
 * inner gap, inside the row's 4px outer gap — a glyph and the number it
 * modifies read as a single token, which they do not at the row's spacing.
 */
function KpiTrend({ trend }: { readonly trend: KpiTrendConfig }): ReactElement {
  const colorClass = TREND_COLOR_CLASS[trend.color ?? 'gray']
  const arrow = TREND_DIRECTION_ARROW[trend.direction ?? 'flat']

  return (
    <div
      data-role="kpi-trend"
      className={`${computeKpiTrendClasses()} ${colorClass}`}
    >
      <span className={KPI_TREND_GROUP_CLASSES}>
        <span aria-hidden="true">{arrow}</span>
        <span>{`${String(trend.changePercent)}%`}</span>
      </span>
    </div>
  )
}

/**
 * KPI card — renders the computed metric as a card with an optional label,
 * Lucide icon, and trend indicator.
 *
 * Carries `data-component="kpi"` so spec assertions on the canonical KPI
 * attribute resolve; the formatted value lives under `data-role="kpi-value"`.
 *
 * Every class comes from `kpi-default-classes.ts`, which the SSR skeleton in
 * `island-data-components.tsx` also reads — so the card chrome is identical
 * before and after hydration and the metric never reflows as the island mounts.
 */
export function KpiCard({
  label,
  value,
  icon,
  iconNode,
  trend,
  thresholdColor,
  sparklineSeries,
}: KpiCardProps): ReactElement {
  const valueColorClass = thresholdColor
    ? (THRESHOLD_COLOR_CLASS[thresholdColor] ?? 'text-foreground')
    : 'text-foreground'

  return (
    <div
      data-component="kpi"
      data-kpi-state="ready"
      className={computeKpiCardClasses()}
    >
      <div className={KPI_LABEL_ROW_CLASSES}>
        {iconNode !== undefined && (
          <span
            data-role="kpi-icon"
            className={computeKpiIconClasses()}
          >
            <LucideGlyph
              iconNode={iconNode}
              name={icon}
              width={ICON_BOX}
              height={ICON_BOX}
              aria-hidden="true"
            />
          </span>
        )}
        {label && (
          <span
            data-role="kpi-label"
            className={computeKpiLabelClasses()}
          >
            {label}
          </span>
        )}
      </div>
      <div
        data-role="kpi-value"
        {...(thresholdColor ? { 'data-threshold': thresholdColor } : {})}
        className={`${computeKpiValueClasses()} ${valueColorClass}`}
      >
        {value}
      </div>
      {trend && <KpiTrend trend={trend} />}
      {sparklineSeries && sparklineSeries.length > 0 && <KpiSparkline series={sparklineSeries} />}
    </div>
  )
}
