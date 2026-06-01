/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { DROPDOWN_TRIGGER_CLASS, useDropdownState } from './use-dropdown-state'

interface GroupMenuProps {
  readonly fields: ReadonlyArray<string>
  readonly current: string | null
  readonly onSelect: (field: string | null) => void
}

export function GroupMenu({ fields, current, onSelect }: GroupMenuProps) {
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
