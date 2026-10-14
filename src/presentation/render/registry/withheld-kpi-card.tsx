/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CARD_SLOT_ATTRIBUTES } from '@/presentation/design/card-default-classes'
import {
  computeKpiCardClasses,
  computeKpiLabelClasses,
  computeKpiValueClasses,
  KPI_HEADER_CLASSES,
} from '@/presentation/design/kpi-default-classes'
import { hostClassName, namedHost } from '@/presentation/render/registry/island-host-attributes'
import { READ_WITHHELD_MARKER } from '@/presentation/render/resolve/withheld-component'
import type { ReactElement } from 'react'

/** True for a KPI the resolver withheld over a table its visitor may not read. */
export function isWithheldKpi(elementProps: Record<string, unknown>): boolean {
  return elementProps[READ_WITHHELD_MARKER] === true
}

/**
 * A KPI over a table its visitor may not read (`withheld-component.ts`): the
 * card chrome, the author's label and a neutral value — no island, nothing of
 * the table. The label is the author's words, so a public KPI whose visitor
 * cannot read the records still reads as the tile it is.
 */
export function withheldKpiCard(elementProps: Record<string, unknown>): ReactElement {
  const label = typeof elementProps.label === 'string' ? elementProps.label : undefined
  return (
    <div
      {...namedHost('kpi')}
      data-kpi-state="withheld"
      data-testid={elementProps['data-testid'] as string | undefined}
      {...CARD_SLOT_ATTRIBUTES}
      className={hostClassName(elementProps, computeKpiCardClasses())}
    >
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
          className={computeKpiValueClasses()}
        >
          —
        </div>
      </div>
    </div>
  )
}
