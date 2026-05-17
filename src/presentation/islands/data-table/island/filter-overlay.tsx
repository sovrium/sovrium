/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../../shared/types'
import type { useReactTable } from '@tanstack/react-table'

type FilterStep = 'field' | 'value'

interface ActiveFilter {
  readonly field: string
  readonly value: string
}

interface FilterOverlayProps {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly records: readonly TableRecord[]
  readonly tableFields?: readonly string[]
  readonly filterStep: FilterStep
  readonly filterField: string | undefined
  readonly onFieldSelect: (field: string) => void
  readonly onValueSelect: (filter: ActiveFilter) => void
}

export function FilterOverlay({
  table,
  records,
  tableFields,
  filterStep,
  filterField,
  onFieldSelect,
  onValueSelect,
}: FilterOverlayProps) {
  return (
    <div className="p-4">
      {filterStep === 'field' ? (
        <div>
          {(
            tableFields ??
            table
              .getAllColumns()
              .map((col) => col.id)
              .filter((id) => id !== 'select')
          ).map((field) => (
            <button
              key={field}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- per-field click handler closes over loop-variable `field`; useCallback inside .map() has equivalent allocation cost. React Compiler will memoize this once enabled in Bun (see docs/infrastructure/ui/react.md).
              onClick={() => onFieldSelect(field)}
            >
              {field}
            </button>
          ))}
        </div>
      ) : (
        <div>
          {[
            ...new Set(
              records
                .map((r) => String((r as Record<string, unknown>)[filterField!] ?? ''))
                .filter(Boolean)
            ),
          ].map((value) => (
            <button
              key={value}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- per-value click handler closes over loop-variable `value`; useCallback inside .map() has equivalent allocation cost. React Compiler will memoize this once enabled in Bun (see docs/infrastructure/ui/react.md).
              onClick={() => onValueSelect({ field: filterField!, value })}
            >
              {value}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
