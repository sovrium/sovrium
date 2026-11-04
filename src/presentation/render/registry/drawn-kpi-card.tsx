/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  formatKpiValue,
  type KpiFormatConfig,
} from '@/domain/models/app/pages/components/component-types/data/kpi/kpi-figure-service'
import { CARD_SLOT_ATTRIBUTES } from '@/presentation/design/card-default-classes'
import {
  computeKpiCardClasses,
  computeKpiLabelClasses,
  computeKpiValueClasses,
  KPI_HEADER_CLASSES,
  KPI_STACK_CLASSES,
} from '@/presentation/design/kpi-default-classes'
import { hostClassName, namedHost } from '@/presentation/render/registry/island-host-attributes'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { ReactElement } from 'react'

/** What a drawn tile prints: its island's props, its figure, and the figure's classes. */
interface DrawnKpi {
  readonly props: Readonly<Record<string, unknown>>
  readonly metric: number | null
  readonly currentLang: string | undefined
  readonly valueClassName?: string
  readonly toneClassName?: string
}

/** The figure's text, as the island prints it: the neutral dash for no figure. */
const figureText = (
  elementProps: Record<string, unknown>,
  metric: number | null,
  locale: string | undefined
): string =>
  metric === null
    ? '—'
    : formatKpiValue(
        metric,
        elementProps.kpiFormat as KpiFormatConfig | undefined,
        locale ?? 'en-US',
        elementProps.valueCurrency as CurrencyDisplayOptions | undefined
      )

/**
 * A KPI tile whose figure the server read for its reader
 * (`drawn-island-content.ts`): the card the mounted island draws — label,
 * figure, description — on the same parts and classes, so find-in-page and a
 * print reach the figure before the island starts, and nothing moves when it
 * does. The host is marked `data-island-drawn`, the one sign the mounter reads
 * to let a tile far below the first screen wait until it is seen.
 */
export function drawnKpiCard(
  elementProps: Record<string, unknown>,
  { props, metric, currentLang, valueClassName, toneClassName }: DrawnKpi
): ReactElement {
  const label = typeof elementProps.label === 'string' ? elementProps.label : undefined
  const description =
    typeof elementProps.description === 'string' ? elementProps.description : undefined
  return (
    <div
      id={elementProps.id as string | undefined}
      data-island="kpi"
      data-island-props={JSON.stringify({ ...props, drawn: metric })}
      data-island-drawn=""
      {...namedHost('kpi')}
      data-testid={elementProps['data-testid'] as string | undefined}
      {...CARD_SLOT_ATTRIBUTES}
      className={hostClassName(elementProps, computeKpiCardClasses())}
    >
      <div className={KPI_STACK_CLASSES}>
        <div
          data-slot="card-header"
          className={KPI_HEADER_CLASSES}
        >
          {label !== undefined && (
            <div
              data-slot="card-description"
              data-role="kpi-label"
              className={computeKpiLabelClasses()}
            >
              {label}
            </div>
          )}
          <div
            data-slot="card-title"
            data-role="kpi-value"
            className={`${valueClassName ?? computeKpiValueClasses()} ${toneClassName ?? ''}`.trim()}
          >
            {figureText(elementProps, metric, currentLang)}
          </div>
          {description !== undefined && (
            <div
              data-role="kpi-description"
              className="text-muted-foreground text-sm"
            >
              {description}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
