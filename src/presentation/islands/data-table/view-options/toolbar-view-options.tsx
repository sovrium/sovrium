/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { SessionControls, type SessionControlsProps } from './session-controls'

/**
 * `viewOptions: toolbar` — the reader's view options as one `View` menu at the
 * right end of the toolbar above the grid, shadcn's data-table view options.
 *
 * A grid draws no search box of its own: the toolbar above it is composed on
 * the page, its controls publishing on the channel the grid listens to
 * (`dataSource.bindTo`). So "the toolbar" is the `role="toolbar"` row holding a
 * control that publishes on THAT channel, and the menu joins it, at its end, on
 * the search box's row. A page that composes no such row still gets the menu,
 * at the right end of a row the grid draws above its own rows.
 */

/** The toolbar row a control publishing on `channel` sits in, else `null`. */
function toolbarOf(channel: string | undefined): HTMLElement | null {
  if (channel === undefined) return null
  // Compared in JS, not interpolated into a selector: the channel is author config.
  const publisher = Array.from(
    document.querySelectorAll<HTMLElement>('[data-publishes-bind-to]')
  ).find((element) => element.getAttribute('data-publishes-bind-to') === channel)
  return publisher?.closest<HTMLElement>('[role="toolbar"]') ?? null
}

/** A toolbar child that already pushes the row's end group right (`ml-auto`). */
const PUSHES_RIGHT = /(^|[\s:])ml-auto(\s|$)/

/**
 * A slot appended to the composed toolbar for the menu, removed with the grid.
 * It takes the free space itself only when nothing in the row does already —
 * two `ml-auto` children would split the space and float the first one mid-row.
 */
function useToolbarSlot(channel: string | undefined): HTMLElement | null | undefined {
  const [slot, setSlot] = useState<HTMLElement | null | undefined>(undefined)
  useEffect(() => {
    const toolbar = toolbarOf(channel)
    if (toolbar === null) {
      setSlot(null)
      return undefined
    }
    const element = document.createElement('div')
    const pushed = Array.from(toolbar.children).some((child) =>
      PUSHES_RIGHT.test(child.getAttribute('class') ?? '')
    )
    element.setAttribute('data-slot', 'data-table-toolbar-view-options')
    element.className = pushed ? 'flex items-center' : 'ml-auto flex items-center'
    toolbar.append(element)
    setSlot(element)
    return () => element.remove()
  }, [channel])
  return slot
}

/** The View menu in the toolbar above the grid, or in a row of the grid's own. */
export function ToolbarViewOptions({
  session,
  channel,
}: {
  readonly session: SessionControlsProps
  readonly channel: string | undefined
}): ReactElement | null {
  const slot = useToolbarSlot(channel)
  const menu = (
    <SessionControls
      {...session}
      frame="view"
      side="bottom"
    />
  )
  // Still looking: nothing yet, so the menu never flashes in the wrong row.
  if (slot === undefined) return null
  if (slot !== null) return createPortal(menu, slot)
  return (
    <div
      data-slot="data-table-toolbar"
      data-testid="data-table-toolbar"
      className="border-border bg-card flex items-center justify-end gap-2 border-b p-2"
    >
      {menu}
    </div>
  )
}
