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
import { fieldLabel } from './field-reading'
import { useImportWord } from './import-words'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface ColumnMappingSelectProps {
  /** The CSV column this control maps: it names the control for assistive tech. */
  readonly column: string
  readonly value: string | undefined
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly onChange: (value: string | undefined) => void
}

/** The field a CSV column goes into, by its label, or Skip to leave the column out. */
export function ColumnMappingSelect({
  column,
  value,
  tableFields,
  fieldMeta,
  onChange,
}: ColumnMappingSelectProps) {
  const [open, setOpen] = useState(false)
  const skip = useImportWord('csvImport.skip', 'Skip')
  const name = useImportWord('csvImport.fieldFor', 'Field for column {column}', { column })
  const label = value === undefined ? skip : fieldLabel(value, fieldMeta)
  const pick = (field: string | undefined): void => {
    onChange(field)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={name}
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
            onClick={() => pick(undefined)}
            className={computeTableEditorListRowClasses()}
          >
            {skip}
          </li>
          {tableFields?.map((field) => (
            <li
              key={field}
              role="option"
              aria-selected={value === field}
              onClick={() => pick(field)}
              className={computeTableEditorListRowClasses()}
            >
              {fieldLabel(field, fieldMeta)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
