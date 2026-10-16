/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { type ReactElement, type ReactNode } from 'react'
import { computeTablePagerButtonClasses } from '@/presentation/design/table-default-classes'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
} from '../../overlays/menu-default-classes'
import { useGridString } from '../island/grid-strings'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { DataTableInstance } from '../island/table-features'
import type { SessionGrouping } from '../island/use-ui-state'
import type { GridRowHeight } from '@/presentation/design/table-body-default-classes'

/**
 * The reader's session controls, in the right half of the grid's bottom bar:
 * Group by, Hide fields and Row height. Each changes the grid for the visit and
 * nothing else — no request writes it, a reload forgets it. A lasting grouping
 * is a table view's `groupBy`, a lasting set of columns the grid's `columns`, a
 * lasting row height its `rowHeight`.
 */

/** The field types a reader may group a grid by: one value per row, few distinct ones. */
const GROUPABLE_TYPES: ReadonlySet<string> = new Set([
  'single-select',
  'status',
  'checkbox',
  'single-line-text',
  'user',
  'date',
])

const ROW_HEIGHTS: readonly GridRowHeight[] = ['short', 'medium', 'tall', 'extra-tall']

/** The check a chosen row shows, lucide's `check`. */
const CHECK = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-4"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const OPTION_ITEM = `${computeMenuItemClasses()} pr-8`
const INDICATOR = 'pointer-events-none absolute right-2 flex size-4 items-center justify-center'
const TRIGGER = computeTablePagerButtonClasses({ variant: 'ghost' })

/** One field column the controls can name: its field, its heading, its column. */
interface FieldColumnEntry {
  readonly field: string
  readonly label: string
  readonly column: ReturnType<DataTableInstance['getAllLeafColumns']>[number]
}

/** The grid's field columns, in their order, each with the heading it is drawn under. */
function fieldColumnsOf(table: DataTableInstance): readonly FieldColumnEntry[] {
  return table.getAllLeafColumns().flatMap((column) => {
    const field = column.columnDef.meta?.field
    if (field === undefined) return []
    const { header } = column.columnDef
    return [{ field, label: typeof header === 'string' ? header : field, column }]
  })
}

/** A bottom-bar menu: a ghost trigger and its popup, opening upward from the bar. */
function BarMenu({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <Menu.Root>
      <Menu.Trigger
        type="button"
        className={TRIGGER}
      >
        {label}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="end"
          sideOffset={4}
          positionMethod="fixed"
          className="isolate z-50 outline-none"
        >
          <Menu.Popup
            data-slot="dropdown-menu-content"
            className={computeMenuPopupClasses()}
          >
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

/** One radio row of a bar menu. */
function RadioRow({ value, label }: { readonly value: string; readonly label: string }) {
  return (
    <Menu.RadioItem
      value={value}
      closeOnClick
      className={OPTION_ITEM}
    >
      {label}
      <Menu.RadioItemIndicator className={INDICATOR}>{CHECK}</Menu.RadioItemIndicator>
    </Menu.RadioItem>
  )
}

/** Group by: None, then every groupable column the grid draws. */
function GroupByMenu(props: {
  readonly columns: readonly FieldColumnEntry[]
  readonly fieldMeta?: FieldMetaMap
  readonly current?: string
  readonly onGroup: (grouping: SessionGrouping) => void
}) {
  const label = useGridString('datatable.groupBy', 'Group by')
  const none = useGridString('datatable.groupNone', 'None')
  const groupable = props.columns.filter((entry) =>
    GROUPABLE_TYPES.has(props.fieldMeta?.[entry.field]?.type ?? '')
  )
  if (groupable.length === 0) return undefined
  return (
    <BarMenu label={label}>
      <Menu.RadioGroup
        value={props.current ?? ''}
        onValueChange={(next: string) => props.onGroup(next === '' ? {} : { field: next })}
      >
        <RadioRow
          value=""
          label={none}
        />
        {groupable.map((entry) => (
          <RadioRow
            key={entry.field}
            value={entry.field}
            label={entry.label}
          />
        ))}
      </Menu.RadioGroup>
    </BarMenu>
  )
}

/** Hide fields: one checkbox per column; at least one column always stays. */
function HideFieldsMenu({ columns }: { readonly columns: readonly FieldColumnEntry[] }) {
  const label = useGridString('datatable.hideFields', 'Hide fields')
  const shown = columns.filter((entry) => entry.column.getIsVisible()).length
  return (
    <BarMenu label={label}>
      {columns.map((entry) => {
        const visible = entry.column.getIsVisible()
        return (
          <Menu.CheckboxItem
            key={entry.field}
            checked={visible}
            closeOnClick={false}
            disabled={visible && shown === 1}
            onCheckedChange={(checked) => entry.column.toggleVisibility(checked)}
            className={OPTION_ITEM}
          >
            {entry.label}
            <Menu.CheckboxItemIndicator className={INDICATOR}>{CHECK}</Menu.CheckboxItemIndicator>
          </Menu.CheckboxItem>
        )
      })}
    </BarMenu>
  )
}

/** Row height: the three an author may declare, and Extra tall for the visit. */
function RowHeightMenu(props: {
  readonly current: string
  readonly onRowHeight: (height: GridRowHeight) => void
}) {
  const label = useGridString('datatable.rowHeight', 'Row height')
  const names: Readonly<Record<GridRowHeight, string>> = {
    short: useGridString('datatable.rowHeight.short', 'Short'),
    medium: useGridString('datatable.rowHeight.medium', 'Medium'),
    tall: useGridString('datatable.rowHeight.tall', 'Tall'),
    'extra-tall': useGridString('datatable.rowHeight.extraTall', 'Extra tall'),
  }
  return (
    <BarMenu label={label}>
      <Menu.RadioGroup
        value={props.current}
        onValueChange={(next: string) => props.onRowHeight(next as GridRowHeight)}
      >
        {ROW_HEIGHTS.map((height) => (
          <RadioRow
            key={height}
            value={height}
            label={names[height]}
          />
        ))}
      </Menu.RadioGroup>
    </BarMenu>
  )
}

/** What the session controls read and write. */
export interface SessionControlsProps {
  readonly table: DataTableInstance
  readonly fieldMeta?: FieldMetaMap
  /** The field the grid is grouped by right now, configured or picked. */
  readonly groupedBy?: string
  readonly onGroup: (grouping: SessionGrouping) => void
  readonly rowHeight: string
  readonly onRowHeight: (height: GridRowHeight) => void
}

/** Group by · Hide fields · Row height — the bottom bar's right half, before the pager. */
export function SessionControls(props: SessionControlsProps): ReactElement {
  const columns = fieldColumnsOf(props.table)
  return (
    <div
      data-slot="data-table-session-controls"
      className="flex items-center gap-1"
    >
      <GroupByMenu
        columns={columns}
        {...(props.fieldMeta !== undefined && { fieldMeta: props.fieldMeta })}
        {...(props.groupedBy !== undefined && { current: props.groupedBy })}
        onGroup={props.onGroup}
      />
      {columns.length > 0 && <HideFieldsMenu columns={columns} />}
      <RowHeightMenu
        current={props.rowHeight}
        onRowHeight={props.onRowHeight}
      />
    </div>
  )
}
