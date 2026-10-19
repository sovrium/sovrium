/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CARD_SLOT_ATTRIBUTES } from '@/presentation/design/card-default-classes'
import { cn } from '@/presentation/design/class-merge'
import {
  computeKpiCardClasses,
  KPI_HEADER_CLASSES,
  KPI_SKELETON_CLASSES,
  KPI_STACK_CLASSES,
  computeKpiLabelClasses,
  computeKpiValueClasses,
  computeKpiValueSizeClasses,
} from '@/presentation/design/kpi-default-classes'
import { toneTextClass } from '@/presentation/design/tone-classes'
import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import { hostClassName, namedHost } from '@/presentation/render/registry/island-host-attributes'
import { isWithheldKpi, withheldKpiCard } from './withheld-kpi-card'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Tone } from '@/domain/models/app/pages/components/shared-schemas'
import type { ResponsiveValues } from '@/presentation/design/responsive-classes'

/**
 * The value's classes, resolved here where the class merger is: `valueClassName`
 * is the recipe under the per-breakpoint `size` and the author's `value` part
 * (`design.components.kpi` under the instance's `classes`); `toneClassName` is
 * the `tone`'s ink. The card adds the ink last — a matching threshold's in place
 * of the tone's — so the island needs no merger of its own.
 */
const kpiValueClasses = (
  elementProps: Record<string, unknown>,
  parts: Readonly<Record<string, string>> | undefined
): { readonly valueClassName?: string; readonly toneClassName?: string } => {
  const size = elementProps.size as ResponsiveValues<'sm' | 'md' | 'lg'> | undefined
  const tone = toneTextClass(elementProps.tone as Tone | undefined)
  const part = parts?.['value']
  return {
    ...(size === undefined && part === undefined
      ? {}
      : {
          valueClassName: cn(
            computeKpiValueClasses({ sized: size !== undefined }),
            computeKpiValueSizeClasses(size),
            part
          ),
        }),
    ...(tone === undefined ? {} : { toneClassName: tone }),
  }
}

/**
 * Extracts KPI island props from section component props.
 *
 * Forwarded to the KPI island for client-side data fetching, single-metric
 * aggregation, and formatted card rendering.
 */
function extractKpiProps(
  elementProps: Record<string, unknown>,
  parts: Readonly<Record<string, string>> | undefined
): Record<string, unknown> {
  return {
    ...kpiValueClasses(elementProps, parts),
    dataSource: elementProps.dataSource,
    label: elementProps.label,
    kpiAggregate: elementProps.kpiAggregate,
    kpiFormat: elementProps.kpiFormat,
    // The aggregated field's currency display, resolved from `app.tables`, so
    // a currency KPI shows the field's precision in the page language.
    valueCurrency: elementProps.valueCurrency,
    // Read the figures from one aggregate read rather than a page of records.
    aggregateRead: elementProps.aggregateRead,
    icon: elementProps.icon,
    // Server-resolved icon geometry. The island draws from this instead of
    // resolving the name itself, which is what keeps lucide's ~2,000-icon set
    // (a measured 668 KB chunk) out of the island graph — see
    // `@/presentation/utils/lucide-glyph`.
    iconNode:
      typeof elementProps.icon === 'string' ? resolveLucideIconNode(elementProps.icon) : undefined,
    trend: elementProps.trend,
    thresholds: elementProps.thresholds,
    sparkline: elementProps.sparkline,
    // The rate-limited notice's and loading status's words, where they differ from English.
    uiStrings: elementProps.uiStrings,
  }
}

/** The skeleton's status name: `kpi.loading` in the page language, English when they agree. */
const kpiLoadingLabel = (elementProps: Record<string, unknown>): string =>
  (elementProps.uiStrings as Readonly<Record<string, string>> | undefined)?.['kpi.loading'] ??
  'Loading KPI...'

/**
 * The KPI tile: an island reading the records API for its figure, its label
 * server-rendered beside the skeleton — or, over a table its visitor may not
 * read, the withheld static card (`withheld-kpi-card.tsx`).
 */
export const islandKpiComponent: ComponentRenderer = ({ elementProps, designStyles }) => {
  if (isWithheldKpi(elementProps)) return withheldKpiCard(elementProps)
  const propsJson = JSON.stringify(extractKpiProps(elementProps, designStyles?.parts))
  // GAP-I1: server-render the KPI label as visible text in the SSR skeleton.
  // The label is a static, public binding (not record data), so it can paint
  // pre-hydration and remain visible to anonymous visitors on public pages —
  // independent of the auth-gated records fetch the island performs.
  const kpiLabel = typeof elementProps.label === 'string' ? elementProps.label : undefined

  // The ONE element naming the KPI; the mounted card writes `data-kpi-state` onto it.
  return (
    <div
      id={elementProps.id as string | undefined}
      data-island="kpi"
      data-island-props={propsJson}
      {...namedHost('kpi')}
      data-testid={elementProps['data-testid'] as string | undefined}
      {...CARD_SLOT_ATTRIBUTES}
      className={hostClassName(elementProps, computeKpiCardClasses())}
    >
      {/* Loading skeleton — preserved as Suspense fallback.

          The host IS the card, and the skeleton sits in a card header on the
          SAME parts the hydrated `KpiCard` draws, so the card does not change
          at the moment the island mounts, and the label that was
          server-rendered does not jump. */}
      <div
        className={KPI_STACK_CLASSES}
        data-loading-status=""
        aria-label={kpiLoadingLabel(elementProps)}
        role="status"
      >
        <div
          data-slot="card-header"
          className={KPI_HEADER_CLASSES}
        >
          {kpiLabel ? (
            <div
              data-slot="card-description"
              data-role="kpi-label"
              className={computeKpiLabelClasses()}
            >
              {kpiLabel}
            </div>
          ) : (
            <div
              data-slot="skeleton"
              className={`${KPI_SKELETON_CLASSES} h-5 w-32`}
            />
          )}
          <div
            data-slot="skeleton"
            className={`${KPI_SKELETON_CLASSES} h-8 w-24`}
          />
        </div>
      </div>
    </div>
  )
}
