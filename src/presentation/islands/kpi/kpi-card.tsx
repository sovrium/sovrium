/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeBadgeClasses } from '@/presentation/design/badge-default-classes'
import {
  KPI_ACTION_CLASSES,
  KPI_FOOTER_CLASSES,
  KPI_HEADER_CLASSES,
  KPI_STACK_CLASSES,
  computeKpiIconClasses,
  computeKpiLabelClasses,
  computeKpiValueClasses,
} from '@/presentation/design/kpi-default-classes'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import { useNamedHostAttributes } from '../hooks/use-named-host-attributes'
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
  /** The value's classes (recipe, size, author part), resolved server-side. */
  readonly valueClassName?: string
  /** The `tone`'s ink; a matching threshold's ink replaces it. */
  readonly toneClassName?: string
  /** A line under the value — a ratio's two counts, as `3 / 8`. */
  readonly caption?: string
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
 * The theme ink for a resolved threshold color name.
 *
 * `red` is shadcn/ui's `destructive` and `gray` its muted foreground; `green`
 * and `yellow`, which shadcn has no token for, are the theme's success and
 * warning inks, and `blue` the brand `primary`. Every one is a theme role, so
 * it follows the app's colours and dark mode. The rendered value also carries
 * a `data-threshold` attribute, which is the stable hook specs assert on.
 */
const THRESHOLD_COLOR_CLASS: Record<string, string> = {
  red: 'text-destructive',
  green: 'text-success-fg',
  yellow: 'text-warning-fg',
  blue: 'text-primary',
  gray: 'text-muted-foreground',
}

/** The value's ink: a matching threshold's, else the tone's; none inherits the card foreground. */
const valueInk = (thresholdColor: string | undefined, toneClassName: string | undefined): string =>
  thresholdColor === undefined
    ? (toneClassName ?? '')
    : (THRESHOLD_COLOR_CLASS[thresholdColor] ?? '')

/** The trend arrow's ink, from the trend's `color`. */
const TREND_COLOR_CLASS: Record<NonNullable<KpiTrendConfig['color']>, string> = {
  green: THRESHOLD_COLOR_CLASS['green'] ?? '',
  red: THRESHOLD_COLOR_CLASS['red'] ?? '',
  yellow: THRESHOLD_COLOR_CLASS['yellow'] ?? '',
  gray: THRESHOLD_COLOR_CLASS['gray'] ?? '',
}

/** lucide's TrendingUp, TrendingDown and MoveRight geometry. */
const TREND_GLYPH: Record<NonNullable<KpiTrendConfig['direction']>, unknown> = {
  up: [
    ['path', { d: 'M22 7 13.5 15.5 8.5 10.5 2 17' }],
    ['path', { d: 'M16 7h6v6' }],
  ],
  down: [
    ['path', { d: 'M22 17 13.5 8.5 8.5 13.5 2 7' }],
    ['path', { d: 'M16 17h6v-6' }],
  ],
  flat: [
    ['path', { d: 'M18 8l4 4-4 4' }],
    ['path', { d: 'M2 12h20' }],
  ],
}

/**
 * The trend: an outline badge in the card action, its direction carried by
 * the arrow glyph, which the trend's `color` paints — the colour adds to the
 * arrow, it never replaces it.
 */
function KpiTrend({ trend }: { readonly trend: KpiTrendConfig }): ReactElement {
  return (
    <div
      data-slot="card-action"
      className={KPI_ACTION_CLASSES}
    >
      <span
        data-slot="badge"
        data-variant="outline"
        data-role="kpi-trend"
        className={computeBadgeClasses({ variant: 'outline' })}
      >
        <LucideGlyph
          iconNode={TREND_GLYPH[trend.direction ?? 'flat']}
          className={TREND_COLOR_CLASS[trend.color ?? 'gray']}
          aria-hidden="true"
        />
        {`${String(trend.changePercent)}%`}
      </span>
    </div>
  )
}

/** The label — the card description, the optional icon before it. */
function KpiLabel({
  label,
  icon,
  iconNode,
}: Pick<KpiCardProps, 'label' | 'icon' | 'iconNode'>): ReactElement {
  return (
    <div
      data-slot="card-description"
      data-role="kpi-label"
      className={computeKpiLabelClasses()}
    >
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
      {label}
    </div>
  )
}

/**
 * KPI card — renders the computed metric as a card with an optional label,
 * Lucide icon, and trend indicator.
 *
 * The card is not the element that names the KPI — the island host is — so
 * its state is written there ({@link useNamedHostAttributes}); the formatted
 * value lives under `data-role="kpi-value"`.
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
  valueClassName,
  toneClassName,
  caption,
}: KpiCardProps): ReactElement {
  return (
    <div
      ref={useNamedHostAttributes<HTMLDivElement>('kpi', { 'data-kpi-state': 'ready' })}
      className={KPI_STACK_CLASSES}
    >
      <div
        data-slot="card-header"
        className={KPI_HEADER_CLASSES}
      >
        {(label || iconNode !== undefined) && (
          <KpiLabel
            label={label}
            icon={icon}
            iconNode={iconNode}
          />
        )}
        <div
          data-slot="card-title"
          data-role="kpi-value"
          {...(thresholdColor ? { 'data-threshold': thresholdColor } : {})}
          className={`${valueClassName ?? computeKpiValueClasses()} ${valueInk(thresholdColor, toneClassName)}`}
        >
          {value}
        </div>
        {trend && <KpiTrend trend={trend} />}
      </div>
      {sparklineSeries && sparklineSeries.length > 0 && <KpiSparkline series={sparklineSeries} />}
      {caption !== undefined && (
        <div
          data-slot="card-footer"
          className={KPI_FOOTER_CLASSES}
        >
          <div data-role="kpi-caption">{caption}</div>
        </div>
      )}
    </div>
  )
}
