/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A progress bar bound to records: `dataSource` + a ratio `kpiAggregate`.
 *
 * The bar is drawn on the server, so its two counts are taken here, over the
 * rows its binding read for this reader — through the records gate, so a row
 * she may not read is in neither count — and with her own row joined first
 * when the binding declares `mine` (`viewer-own-rows.ts`). The denominator
 * counts the rows matching `denominator.filter`; the numerator, those among
 * them matching `numerator.filter`, the KPI ratio's reading. The figure lands
 * where a written bar keeps it (`progressValue`, `progressMax`), and
 * `labelTemplate`, filled, replaces the percentage beside it. A denominator of
 * zero is an empty bar and `0 of 0`, never a division.
 */

import { rewriteComponent, tableBindingOf } from './component-rewrite'
import { recordMatchesCollectionFilter } from './page-collection-filter'
import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

type Row = Readonly<Record<string, unknown>>

/** The rows matching every condition of one side, read through the table's field types. */
const matching = (
  rows: readonly Row[],
  filter: readonly DataFilter[] | undefined,
  ctx: { readonly table: string; readonly app: App }
): readonly Row[] =>
  rows.filter((row) =>
    recordMatchesCollectionFilter(row, { table: ctx.table, filter }, { tables: ctx.app.tables })
  )

/** The label template with both counts and the rounded share filled in. */
const fillLabel = (template: string, counts: Readonly<Record<string, number>>): string =>
  template.replace(/\{(numerator|denominator|percent)\}/g, (_, key: string) =>
    String(counts[key] ?? 0)
  )

/**
 * A bound progress bar with its figure taken from `rows`; any other component,
 * or a bar without a ratio, comes back as it is.
 */
export function withProgressRatio(component: Component, rows: readonly Row[], app: App): Component {
  if (component.type !== 'progress') return component
  const { kpiAggregate } = component
  const table = tableBindingOf(component)?.table
  if (kpiAggregate?.function !== 'ratio' || typeof table !== 'string') return component
  const ctx = { table, app }
  const denominatorRows = matching(rows, kpiAggregate.denominator?.filter, ctx)
  const numerator = matching(denominatorRows, kpiAggregate.numerator?.filter, ctx).length
  const denominator = denominatorRows.length
  return rewriteComponent(component, {
    progressValue: numerator,
    progressMax: denominator,
    props: {
      ...(component.props ?? {}),
      ...labelOf(component.labelTemplate, numerator, denominator),
    },
  })
}

/** The filled `labelTemplate` a bound bar prints, as its marker prop; none without a template. */
const labelOf = (template: unknown, numerator: number, denominator: number) => {
  if (typeof template !== 'string') return {}
  const percent = denominator === 0 ? 0 : Math.round((numerator / denominator) * 100)
  return { _progressLabel: fillLabel(template, { numerator, denominator, percent }) }
}
