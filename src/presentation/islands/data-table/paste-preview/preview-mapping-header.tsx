/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SKIP_VALUE } from './skip-value'

interface PreviewMappingHeaderProps {
  readonly headers: readonly string[]
  readonly mappings: readonly string[]
  readonly tableFields: readonly string[]
  readonly onMappingChange: (columnIndex: number, value: string) => void
}

export function PreviewMappingHeader({
  headers,
  mappings,
  tableFields,
  onMappingChange,
}: PreviewMappingHeaderProps) {
  return (
    <thead className="bg-background-subtle">
      <tr>
        {headers.map((header, columnIndex) => {
          const mapping = mappings[columnIndex] ?? SKIP_VALUE
          return (
            <th
              key={`${header}-${columnIndex}`}
              className="text-foreground px-3 py-2 text-left font-medium"
            >
              <div className="flex flex-col gap-1">
                <span className="text-foreground-muted text-xs">{header}</span>
                <span className="text-foreground text-xs font-semibold">
                  {mapping === SKIP_VALUE ? 'Skip this column' : mapping}
                </span>
                <select
                  aria-label={`Map column ${header}`}
                  value={mapping}
                  onChange={(event) => onMappingChange(columnIndex, event.currentTarget.value)}
                  className="border-border rounded border px-2 py-1 text-sm"
                >
                  <option value={SKIP_VALUE}>Skip this column</option>
                  {tableFields.map((field) => (
                    <option
                      key={field}
                      value={field}
                    >
                      {field}
                    </option>
                  ))}
                </select>
              </div>
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
