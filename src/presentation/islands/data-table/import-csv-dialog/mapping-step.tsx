/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ColumnMappingSelect } from './column-mapping-select'
import type { ColumnMapping, CsvPreview } from './types'

interface MappingRowProps {
  readonly mapping: ColumnMapping
  readonly index: number
  readonly sampleValues: readonly string[]
  readonly tableFields?: readonly string[]
  readonly hovered: boolean
  readonly onMouseEnter: (index: number) => void
  readonly onMouseLeave: () => void
  readonly onMappingChange: (index: number, tableField: string | undefined) => void
}

function MappingRow({
  mapping,
  index,
  sampleValues,
  tableFields,
  hovered,
  onMouseEnter,
  onMouseLeave,
  onMappingChange,
}: MappingRowProps) {
  return (
    <div
      data-column={mapping.csvColumn}
      className="border-border relative flex items-center gap-2 rounded border px-3 py-2"
      onMouseEnter={() => onMouseEnter(index)}
      onMouseLeave={onMouseLeave}
    >
      <span className="text-fg text-sm font-medium">{mapping.csvColumn}</span>
      {mapping.tableField !== undefined && <span className="text-fg-subtle">→</span>}
      <ColumnMappingSelect
        value={mapping.tableField}
        tableFields={tableFields}
        onChange={(field) => onMappingChange(index, field)}
      />
      {hovered && sampleValues.length > 0 && (
        <div
          role="tooltip"
          className="border-border bg-bg-overlay absolute top-0 left-full z-20 ml-2 min-w-max rounded border p-2 shadow-lg"
        >
          <p className="text-fg-muted mb-1 text-xs font-medium">Sample values:</p>
          {sampleValues.slice(0, 3).map((val, vi) => (
            <p
              key={vi}
              className="text-fg text-xs"
            >
              {val}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

interface MappingStepProps {
  readonly editableMappings: readonly ColumnMapping[]
  readonly preview: CsvPreview | undefined
  readonly tableFields?: readonly string[]
  readonly hoveredColumnIndex: number | undefined
  readonly unmappedRequiredFields: readonly string[]
  readonly onMouseEnter: (index: number) => void
  readonly onMouseLeave: () => void
  readonly onMappingChange: (index: number, tableField: string | undefined) => void
}

export function MappingStep({
  editableMappings,
  preview,
  tableFields,
  hoveredColumnIndex,
  unmappedRequiredFields,
  onMouseEnter,
  onMouseLeave,
  onMappingChange,
}: MappingStepProps) {
  return (
    <div className="space-y-2">
      <p className="text-fg-muted mb-4 text-sm">Column mapping</p>
      {editableMappings.map((mapping, i) => {
        const sampleValues = (preview?.rows ?? [])
          .map((row) => row[i])
          .filter((v): v is string => v !== undefined && v !== '')
        return (
          <MappingRow
            key={i}
            mapping={mapping}
            index={i}
            sampleValues={sampleValues}
            tableFields={tableFields}
            hovered={hoveredColumnIndex === i}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMappingChange={onMappingChange}
          />
        )
      })}
      {unmappedRequiredFields.map((fieldName) => (
        <p
          key={fieldName}
          className="text-warning-fg text-sm"
        >{`Required field '${fieldName}' has no mapping`}</p>
      ))}
    </div>
  )
}
