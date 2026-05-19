/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'

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
        className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm"
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-10 mt-1 rounded border border-gray-200 bg-white shadow-lg"
        >
          <li
            role="option"
            aria-selected={value === undefined}
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
            className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
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
              className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
            >
              {field}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
