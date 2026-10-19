/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableEditorLabelClasses,
  computeTableEditorPopoverClasses,
  computeTablePreviewGridCellClasses,
} from '@/presentation/design/table-default-classes'
import { ColumnMappingSelect } from './column-mapping-select'
import { fieldReading } from './field-reading'
import { useImportWords } from './import-words'
import { ValueMappingGroups } from './value-mapping'
import type { ColumnMapping, CsvPreview, ValueMappings } from './types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

const cell = computeTablePreviewGridCellClasses({ kind: 'data' })

/** The column's values on the rows after the first, shown while the pointer rests on its row. */
function NextRows({ values }: { readonly values: readonly string[] }) {
  const t = useImportWords()
  if (values.length === 0) return undefined
  return (
    <div
      role="tooltip"
      className={`${computeTableEditorPopoverClasses()} top-0 left-full z-10 ml-2 min-w-max`}
    >
      <p className={computeTableEditorLabelClasses()}>{t('csvImport.nextRows', 'Next rows:')}</p>
      {values.slice(0, 3).map((value, vi) => (
        <p
          key={vi}
          className="text-sm"
        >
          {value}
        </p>
      ))}
    </div>
  )
}

interface MappingRowProps {
  readonly mapping: ColumnMapping
  readonly index: number
  /** The column's value on the file's first row, and on the rows after it. */
  readonly firstRow: string
  readonly nextRows: readonly string[]
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly hovered: boolean
  readonly onMouseEnter: (index: number) => void
  readonly onMouseLeave: () => void
  readonly onMappingChange: (index: number, tableField: string | undefined) => void
}

/**
 * One CSV column: its header, its first value, the field it goes into and how
 * that field reads it. While the pointer rests on the row, the next rows'
 * values of the column show beside it.
 */
function MappingRow({
  mapping,
  index,
  firstRow,
  nextRows,
  tableFields,
  fieldMeta,
  hovered,
  onMouseEnter,
  onMouseLeave,
  onMappingChange,
}: MappingRowProps) {
  const t = useImportWords()
  const next = nextRows.filter((value) => value !== '')
  const mapped = mapping.tableField !== undefined
  return (
    <tr
      data-column={mapping.csvColumn}
      onMouseEnter={() => onMouseEnter(index)}
      onMouseLeave={onMouseLeave}
    >
      <td className={`${cell} font-medium`}>{mapping.csvColumn}</td>
      <td className={`${cell} relative`}>
        {firstRow}
        {hovered && <NextRows values={next} />}
      </td>
      <td className={cell}>
        <div className="flex items-center gap-1">
          {mapped && <span aria-hidden="true">→</span>}
          <ColumnMappingSelect
            column={mapping.csvColumn}
            value={mapping.tableField}
            tableFields={tableFields}
            fieldMeta={fieldMeta}
            onChange={(field) => onMappingChange(index, field)}
          />
        </div>
      </td>
      <td className={`${cell} text-muted-foreground`}>
        {mapped
          ? fieldReading(fieldMeta?.[mapping.tableField ?? ''], t)
          : t('csvImport.notImported', 'Not imported')}
      </td>
    </tr>
  )
}

interface MappingStepProps {
  readonly editableMappings: readonly ColumnMapping[]
  readonly preview: CsvPreview | undefined
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly valueMappings: ValueMappings
  readonly hoveredColumnIndex: number | undefined
  readonly unmappedRequiredFields: readonly string[]
  readonly onMouseEnter: (index: number) => void
  readonly onMouseLeave: () => void
  readonly onMappingChange: (index: number, tableField: string | undefined) => void
  readonly onValueMappingChange: (column: number, value: string, option: string) => void
}

/** The mapping table's four headings. */
function MappingHead() {
  const t = useImportWords()
  const heading = computeTablePreviewGridCellClasses({ kind: 'header' })
  return (
    <thead>
      <tr>
        <th className={heading}>{t('csvImport.csvColumn', 'CSV column')}</th>
        <th className={heading}>{t('csvImport.firstRow', 'First row')}</th>
        <th className={heading}>{t('csvImport.field', 'Field')}</th>
        <th className={heading}>{t('csvImport.reading', 'How it is read')}</th>
      </tr>
    </thead>
  )
}

/** The non-empty values of one column, in file order. */
const columnValues = (preview: CsvPreview | undefined, column: number): readonly string[] =>
  (preview?.rows ?? [])
    .map((row) => row[column])
    .filter((v): v is string => v !== undefined && v !== '')

/**
 * The Columns step: the column mapping as a table, the values of a choice
 * column to match to the field's options, and a warning per required field no
 * column fills.
 */
export function MappingStep(props: MappingStepProps) {
  const { editableMappings, preview, tableFields, fieldMeta, unmappedRequiredFields } = props
  const t = useImportWords()
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table
          aria-label={t('csvImport.mapping', 'Column mapping')}
          className="min-w-full border-collapse"
        >
          <MappingHead />
          <tbody>
            {editableMappings.map((mapping, i) => (
              <MappingRow
                key={i}
                mapping={mapping}
                index={i}
                firstRow={preview?.rows[0]?.[i] ?? ''}
                nextRows={(preview?.rows ?? []).slice(1, 4).map((row) => row[i] ?? '')}
                tableFields={tableFields}
                fieldMeta={fieldMeta}
                hovered={props.hoveredColumnIndex === i}
                onMouseEnter={props.onMouseEnter}
                onMouseLeave={props.onMouseLeave}
                onMappingChange={props.onMappingChange}
              />
            ))}
          </tbody>
        </table>
      </div>
      <ValueMappingGroups
        columns={editableMappings.map((mapping, i) => ({
          index: i,
          field: mapping.tableField,
          values: columnValues(preview, i),
        }))}
        fieldMeta={fieldMeta}
        valueMappings={props.valueMappings}
        onChange={props.onValueMappingChange}
      />
      {unmappedRequiredFields.map((fieldName) => (
        <p
          key={fieldName}
          className="text-warning-fg text-sm"
        >
          {t('csvImport.requiredUnmapped', "Required field '{field}' has no mapping", {
            field: fieldName,
          })}
        </p>
      ))}
    </div>
  )
}
