/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, type ReactElement } from 'react'
import { computeTablePagerButtonClasses } from '@/presentation/design/table-default-classes'
import { useGridString } from '../island/grid-strings'
import { useTableViews, type ListedView } from './table-views'
import type { ViewLayout } from './view-layout'
import type { SessionView } from '../island/use-ui-state'

/**
 * Whether a view filters nothing: it declares no `filters`, or an empty `and` /
 * `or` group (or an empty list). Such a view already shows every row, so the
 * switcher leaves out its `All <plural>` entry beside it.
 */
function filtersNothing(filters: unknown): boolean {
  if (filters === undefined || filters === null) return true
  if (Array.isArray(filters)) return filters.length === 0
  const group = filters as { readonly and?: unknown; readonly or?: unknown }
  const conditions = group.and ?? group.or
  return Array.isArray(conditions) && conditions.length === 0
}

/** The address parameter a grid that opted into URL sync mirrors its view in. */
const VIEW_PARAM = 'view'

/** The switcher's entries: `All <plural>` first, unless a view already shows every row. */
function switcherEntries(
  listed: readonly ListedView[],
  allLabel: string
): ReadonlyArray<{ readonly id: string | undefined; readonly name: string }> {
  const all = listed.some((view) => filtersNothing(view.filters))
    ? []
    : [{ id: undefined, name: allLabel }]
  return [...all, ...listed.map((view) => ({ id: String(view.id), name: view.name }))]
}

/** Write the view into the address (or take it out), without a navigation. */
function mirrorInAddress(viewId: string | undefined): void {
  const url = new URL(window.location.href)
  if (viewId === undefined) url.searchParams.delete(VIEW_PARAM)
  else url.searchParams.set(VIEW_PARAM, viewId)
  window.history.replaceState(window.history.state, '', url)
}

/** What the switcher reads and writes. */
export interface ViewSwitcherProps {
  readonly table: string
  /** `All <plural>`, the entry that reads the table through no view. */
  readonly allLabel: string
  /** The view the grid is configured to read through (`dataSource.view`), if any. */
  readonly configuredView?: string
  /** The reader's pick for the visit; `undefined` keeps the configured view. */
  readonly sessionView: SessionView
  readonly onSelect: (view: SessionView) => void
  /** Mirror the pick in the address as `?view=` (the grid's `publishes.url`). */
  readonly inAddress: boolean
  /** Draw a view's columns and grouping — or the table's own, for none. */
  readonly onLayout: (view: ViewLayout | undefined) => void
}

/**
 * The view switcher, in the 40px row above the grid: one toggle button per
 * entry — `All <plural>` first, then the table's declared views, the default
 * one leading — the active one pressed. The `All` entry is left out when a view
 * the reader may open filters nothing: that view already shows every row. Picking one re-reads the rows through
 * that view.
 *
 * The pick lasts for the visit and is stored nowhere: a reload returns to the
 * view the page configures. Only a grid that opted into URL sync
 * (`publishes.url`) mirrors it as `?view=`, so a shared link opens on the same
 * view. A table that declares no views draws no switcher at all (the server
 * sends no `viewSwitcher` for it, so this never mounts).
 */
export function ViewSwitcher(props: ViewSwitcherProps): ReactElement | undefined {
  const { table, onSelect, inAddress, onLayout } = props
  const groupLabel = useGridString('datatable.views', 'Views')
  const views = useTableViews(table)

  // A shared link carries the view it was taken on — read once, on a grid that
  // writes it there.
  useEffect(() => {
    if (!inAddress) return
    const fromAddress = new URL(window.location.href).searchParams.get(VIEW_PARAM)
    if (fromAddress !== null) onSelect({ id: fromAddress })
  }, [inAddress, onSelect])

  // A grid configured with no view opens on the table's DEFAULT view — the one
  // its author marked `isDefault` — with that view's columns and grouping,
  // unless a shared link already named one.
  const defaultView = (views.data ?? []).find((view) => view.isDefault === true)
  const opensOnDefault = props.configuredView === undefined && props.sessionView === undefined
  useEffect(() => {
    if (!opensOnDefault || defaultView === undefined) return
    if (inAddress && new URL(window.location.href).searchParams.has(VIEW_PARAM)) return
    onSelect({ id: String(defaultView.id) })
    onLayout(defaultView)
  }, [opensOnDefault, defaultView, inAddress, onSelect, onLayout])

  const listed = views.data ?? []
  if (listed.length === 0) return undefined
  const active = props.sessionView === undefined ? props.configuredView : props.sessionView.id
  const pick = (id: string | undefined): void => {
    onSelect(id === undefined ? {} : { id })
    onLayout(listed.find((view) => String(view.id) === id))
    if (inAddress) mirrorInAddress(id)
  }
  const entries = switcherEntries(listed, props.allLabel)
  return (
    <div
      role="group"
      aria-label={groupLabel}
      data-slot="data-table-view-switcher"
      className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto px-2"
    >
      {entries.map((entry) => (
        <ViewButton
          key={entry.id ?? ''}
          label={entry.name}
          pressed={active === entry.id}
          onPress={() => pick(entry.id)}
        />
      ))}
    </div>
  )
}

/** One entry of the switcher: a toggle button, pressed while its view is read. */
function ViewButton(props: {
  readonly label: string
  readonly pressed: boolean
  readonly onPress: () => void
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      className={computeTablePagerButtonClasses({
        variant: props.pressed ? 'secondary' : 'ghost',
      })}
      onClick={props.onPress}
    >
      {props.label}
    </button>
  )
}
