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
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- one-statement state toggle; React Compiler will memoize once enabled in Bun.
        onClick={() => setOpen((prev) => !prev)}
        className="border-border flex items-center gap-1 rounded border px-2 py-1 text-sm"
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="border-border bg-background-overlay absolute top-full left-0 z-10 mt-1 rounded border shadow-lg"
        >
          <li
            role="option"
            aria-selected={value === undefined}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- two-statement select-skip handler; React Compiler will memoize once enabled in Bun.
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
            className="hover:bg-background-subtle cursor-pointer px-3 py-2 text-sm"
          >
            Skip
          </li>
          {tableFields?.map((field) => (
            <li
              key={field}
              role="option"
              aria-selected={value === field}
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- per-option click handler closes over loop-variable `field`; useCallback inside.map has equivalent allocation cost. React Compiler will memoize this once enabled in Bun.
              onClick={() => {
                onChange(field)
                setOpen(false)
              }}
              className="hover:bg-background-subtle cursor-pointer px-3 py-2 text-sm"
            >
              {field}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
