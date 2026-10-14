/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { Fragment, useRef, type ReactElement } from 'react'
import {
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
} from '../../overlays/menu-default-classes'
import { useGridString } from '../island/grid-strings'
import { RowActionMenuItem, RowMenuGate, type RowActionEntryProps } from './row-action-menu-item'
import { rowOf } from './row-origin'
import type { ActionClickHandler, ActionControlLabels } from './row-action-types'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** One action the row shows, under the key its confirm gate is stored by. */
export interface ShownRowAction {
  readonly action: ActionColumnItem
  readonly key: string
}

/**
 * base-nova's ghost `icon-sm` button: the `…` trigger shadcn/ui's
 * `DataTableRowActions` draws at the end of each row.
 */
const TRIGGER =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-all hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted aria-expanded:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"

/** lucide's `ellipsis`, the glyph of the trigger. */
const ELLIPSIS = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="1"
    />
    <circle
      cx="19"
      cy="12"
      r="1"
    />
    <circle
      cx="5"
      cy="12"
      r="1"
    />
  </svg>
)

/**
 * A separator goes before the first destructive item that follows a plain one,
 * as shadcn/ui's `DataTableRowActions` sets its Delete apart.
 */
const separatesDestructive = (entries: readonly RowActionEntryProps[], index: number): boolean =>
  index > 0 &&
  entries[index]?.action.variant === 'destructive' &&
  entries[index - 1]?.action.variant !== 'destructive'

/** The menu's popup, aligned to the end of the row, one item per action. */
function RowActionsPopup({
  entries,
}: {
  readonly entries: readonly RowActionEntryProps[]
}): ReactElement {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side="bottom"
        align="end"
        sideOffset={4}
        positionMethod="fixed"
        className="isolate z-50 outline-none"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={computeMenuPopupClasses()}
        >
          {entries.map((entry, index) => (
            <Fragment key={entry.confirmKey}>
              {separatesDestructive(entries, index) && (
                <Menu.Separator
                  data-slot="dropdown-menu-separator"
                  className={computeMenuSeparatorClasses()}
                />
              )}
              <RowActionMenuItem {...entry} />
            </Fragment>
          ))}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

/** The trigger's name: the column's header (else "Actions") for the row. */
function useTriggerName(columnLabel: string | undefined, rowName: string | number): string {
  const defaultLabel = useGridString('datatable.rowActions.label', 'Actions')
  const positional = useGridString('datatable.rowActions.row', 'row {number}', {
    number: rowName,
  })
  return useGridString('datatable.rowActions.open', '{label} for {row}', {
    label: columnLabel === undefined || columnLabel.trim() === '' ? defaultLabel : columnLabel,
    row: typeof rowName === 'number' ? positional : rowName,
  })
}

/**
 * A row's actions collapsed into one `…` menu (`rowActions.display: menu`),
 * shadcn/ui's `DataTableRowActions`: a ghost icon trigger opening a
 * `DropdownMenu` aligned to the row's end, one item per action the row shows
 * (`visibleWhen` already filtered them). The menu returns the focus to its
 * trigger when it closes; a confirm gate opened from an item returns it there
 * too.
 *
 * The trigger is named after its column and its row — "Actions for Ada
 * Lovelace" — rather than shadcn's "Open menu": a grid holds one per row, a row
 * may hold one per action column, and a page's own menu button is also "Open
 * menu", so a shared name would leave a screen-reader user a list of identical
 * buttons.
 */
export function RowActionsMenu({
  shown,
  record,
  onActionClick,
  labels,
  columnLabel,
  rowName,
}: {
  readonly shown: readonly ShownRowAction[]
  readonly record: TableRecord
  readonly onActionClick: ActionClickHandler
  readonly labels: ActionControlLabels
  /** The action column's header, when it has one. */
  readonly columnLabel: string | undefined
  /** The row as a reader knows it: its first field's value, else its position. */
  readonly rowName: string | number
}): ReactElement {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const openLabel = useTriggerName(columnLabel, rowName)
  const origin = () => rowOf(triggerRef.current)
  // One key per row: the row id the action keys already start with.
  const focusKey = `${(shown[0]?.key ?? '').split('::')[0] ?? ''}::menu`
  const entries = shown.map(({ action, key }) => ({
    action,
    record,
    onActionClick,
    labels,
    confirmKey: key,
    origin,
    focusKey,
  }))
  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          ref={triggerRef}
          data-slot="dropdown-menu-trigger"
          data-row-actions-trigger={focusKey}
          aria-label={openLabel}
          className={TRIGGER}
        >
          {ELLIPSIS}
        </Menu.Trigger>
        <RowActionsPopup entries={entries} />
      </Menu.Root>
      {entries
        .filter((entry) => entry.action.confirm !== undefined)
        .map((entry) => (
          <RowMenuGate
            key={entry.confirmKey}
            {...entry}
          />
        ))}
    </>
  )
}
