/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, type ReactElement } from 'react'
import { computeTablePagerButtonClasses } from '@/presentation/design/table-default-classes'
import { useGridString } from '../island/grid-strings'
import type { SessionView } from '../island/use-ui-state'

/** One view of the table, as `GET /api/tables/:table/views` lists it. */
interface ListedView {
  readonly id: string | number
  readonly name: string
  readonly isDefault?: boolean
}

/** The address parameter a grid that opted into URL sync mirrors its view in. */
const VIEW_PARAM = 'view'

/** The table's views the reader may open: the default one first, then in declaration order. */
async function fetchViews(table: string): Promise<readonly ListedView[]> {
  const response = await fetch(`/api/tables/${encodeURIComponent(table)}/views`, {
    credentials: 'same-origin',
  })
  if (!response.ok) return []
  const listed = (await response.json()) as unknown
  if (!Array.isArray(listed)) return []
  const views = listed as readonly ListedView[]
  return [
    ...views.filter((view) => view.isDefault === true),
    ...views.filter((view) => view.isDefault !== true),
  ]
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
}

/**
 * The view switcher, in the 40px row above the grid: one toggle button per
 * entry — `All <plural>` first, then the table's declared views, the default
 * one leading — the active one pressed. Picking one re-reads the rows through
 * that view.
 *
 * The pick lasts for the visit and is stored nowhere: a reload returns to the
 * view the page configures. Only a grid that opted into URL sync
 * (`publishes.url`) mirrors it as `?view=`, so a shared link opens on the same
 * view. A table that declares no views draws no switcher at all (the server
 * sends no `viewSwitcher` for it, so this never mounts).
 */
export function ViewSwitcher(props: ViewSwitcherProps): ReactElement | undefined {
  const { table, onSelect, inAddress } = props
  const groupLabel = useGridString('datatable.views', 'Views')
  const views = useQuery({
    queryKey: ['data-table-views', table],
    queryFn: () => fetchViews(table),
    staleTime: Infinity,
  })

  // A shared link carries the view it was taken on — read once, on a grid that
  // writes it there.
  useEffect(() => {
    if (!inAddress) return
    const fromAddress = new URL(window.location.href).searchParams.get(VIEW_PARAM)
    if (fromAddress !== null) onSelect({ id: fromAddress })
  }, [inAddress, onSelect])

  const listed = views.data ?? []
  if (listed.length === 0) return undefined
  const active = props.sessionView === undefined ? props.configuredView : props.sessionView.id
  const pick = (id: string | undefined): void => {
    onSelect(id === undefined ? {} : { id })
    if (inAddress) mirrorInAddress(id)
  }
  return (
    <div
      role="group"
      aria-label={groupLabel}
      data-slot="data-table-view-switcher"
      className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto px-2"
    >
      <ViewButton
        label={props.allLabel}
        pressed={active === undefined}
        onPress={() => pick(undefined)}
      />
      {listed.map((view) => (
        <ViewButton
          key={String(view.id)}
          label={view.name}
          pressed={active === String(view.id)}
          onPress={() => pick(String(view.id))}
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
