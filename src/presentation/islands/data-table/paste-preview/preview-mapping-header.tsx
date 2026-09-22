/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableEditorLabelClasses,
  computeTablePanelControlClasses,
  computeTablePreviewGridCellClasses,
} from '@/presentation/design/table-default-classes'
import { SKIP_VALUE } from './skip-value'

interface PreviewMappingHeaderProps {
  /** Pasted column header labels, in order. */
  readonly headers: readonly string[]
  /** Per-column target field (or {@link SKIP_VALUE}); index-aligned with headers. */
  readonly mappings: readonly string[]
  /** Available table field names offered as mapping targets. */
  readonly tableFields: readonly string[]
  /** Updates the target field for one column. */
  readonly onMappingChange: (columnIndex: number, value: string) => void
}

/**
 * The `<thead>` of the paste-preview table.
 *
 * One column per pasted header: shows the raw header label, the resolved
 * target field, and a native `<select>` for re-mapping (including a
 * "Skip this column" choice).
 */
export function PreviewMappingHeader({
  headers,
  mappings,
  tableFields,
  onMappingChange,
}: PreviewMappingHeaderProps) {
  return (
    <thead>
      <tr>
        {headers.map((header, columnIndex) => {
          const mapping = mappings[columnIndex] ?? SKIP_VALUE
          return (
            <th
              key={`${header}-${columnIndex}`}
              className={computeTablePreviewGridCellClasses({ kind: 'header' })}
            >
              <div className="flex flex-col gap-1">
                <span className={computeTableEditorLabelClasses()}>{header}</span>
                <span className="text-sm font-semibold">
                  {mapping === SKIP_VALUE ? 'Skip this column' : mapping}
                </span>
                <select
                  aria-label={`Map column ${header}`}
                  value={mapping}
                  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- per-column change handler closes over columnIndex; React Compiler will memoize once enabled in Bun.
                  onChange={(event) => onMappingChange(columnIndex, event.currentTarget.value)}
                  className={computeTablePanelControlClasses()}
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
