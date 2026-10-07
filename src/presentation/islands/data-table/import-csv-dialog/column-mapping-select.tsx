/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import {
  computeTableEditorListRowClasses,
  computeTableEditorPopoverClasses,
  computeTablePanelControlClasses,
} from '@/presentation/design/table-default-classes'

interface ColumnMappingSelectProps {
  readonly value: string | undefined
  readonly tableFields?: readonly string[]
  readonly onChange: (value: string | undefined) => void
}

export function ColumnMappingSelect({ value, tableFields, onChange }: ColumnMappingSelectProps) {
  const [open, setOpen] = useState(false)
  const label = value ?? 'Skip'

  return (
    <div className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className={`${computeTablePanelControlClasses()} flex items-center gap-1`}
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className={`${computeTableEditorPopoverClasses({ layout: 'stacked' })} top-full left-0 mt-1`}
        >
          <li
            role="option"
            aria-selected={value === undefined}
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
            className={computeTableEditorListRowClasses()}
          >
            Skip
          </li>
          {tableFields?.map((field) => (
            <li
              key={field}
              role="option"
              aria-selected={value === field}
              onClick={() => {
                onChange(field)
                setOpen(false)
              }}
              className={computeTableEditorListRowClasses()}
            >
              {field}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
