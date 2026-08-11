/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { DROPDOWN_TRIGGER_CLASS, useDropdownState } from './use-dropdown-state'

/**
 * Runtime group-by picker exposed in the data-table toolbar (PG-03 /
 * [internal ref]).
 *
 * Plain-`<div>` dropdown (NOT a Base UI Menu) for two reasons:
 *
 * 1. The Group menu is unique among the toolbar menus in that the user
 *    immediately clicks ANOTHER UI element right after selecting a value
 *    (a `<th>` columnheader for spec 034, or a group-header `<tr>` for spec
 *    033). Base UI Menu's anchored Portal lingers in the DOM briefly after
 *    close (`hidden=false; inert=true`), and Playwright's actionability
 *    check on the follow-up click sees the columnheader as being beneath
 *    an overlay and times out.
 *
 * 2. The dropdown content is simple — a `None` entry plus one row per field
 *    — so the focus-trap and keyboard-nav machinery Base UI provides is
 *    overkill. The same pattern is used by `filter-overlay.tsx` /
 *    `sort-overlay.tsx` (Cycle 2 / 3), which also render plain-`<div>`
 *    panels.
 *
 * Renders a `<button aria-haspopup="menu">` trigger and a `<div role="menu">`
 * with one `<button role="menuitem">` per groupable field plus a `None` entry
 * to clear the grouping — matching the spec locator pattern
 * `page.getByRole('menuitem', { name: /status/i })`.
 *
 * Persistence is the caller's responsibility: `onSelect` fires on click and
 * is wired by the orchestrator to the data-table's runtime grouping state.
 * Cycle 5 (saved views) will layer per-view persistence on top of this.
 */
interface GroupMenuProps {
  readonly fields: ReadonlyArray<string>
  readonly current: string | null
  readonly onSelect: (field: string | null) => void
}

export function GroupMenu({ fields, current, onSelect }: GroupMenuProps) {
  // Outside-click close handled by the shared hook. `mousedown` semantics
  // match the spec's expectation that a follow-up `click` on another DOM
  // element fires AFTER the menu has closed.
  const { open, rootRef, onToggle, close } = useDropdownState()

  const handleSelect = useCallback(
    (field: string | null) => {
      onSelect(field)
      close()
    },
    [onSelect, close]
  )

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        type="button"
        aria-label="Group"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={DROPDOWN_TRIGGER_CLASS}
      >
        Group
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Group by"
          className="border-border bg-background-overlay absolute right-0 z-50 mt-1 rounded border py-1 shadow-lg"
        >
          <GroupMenuItem
            // eslint-disable-next-line unicorn/no-null -- `null` is the "clear grouping" sentinel for the `string | null` runtimeGroupBy state contract (setRuntimeGroupBy(null) restores the schema default)
            field={null}
            label="None"
            current={current}
            onSelect={handleSelect}
          />
          {fields.map((field) => (
            <GroupMenuItem
              key={field}
              field={field}
              label={field}
              current={current}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface GroupMenuItemProps {
  readonly field: string | null
  readonly label: string
  readonly current: string | null
  readonly onSelect: (field: string | null) => void
}

function GroupMenuItem({ field, label, current, onSelect }: GroupMenuItemProps) {
  const handleClick = useCallback(() => onSelect(field), [field, onSelect])
  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className={`hover:bg-background-subtle block w-full px-4 py-2 text-left text-sm ${
        current === field ? 'font-medium' : ''
      }`}
    >
      {label}
    </button>
  )
}
