/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import {
  computeTableEditorLabelClasses,
  computeTablePanelControlClasses,
} from '@/presentation/design/table-default-classes'
import { chosenOption, fieldLabel, foreignValues } from './field-reading'
import { useImportWords } from './import-words'
import type { ValueMappings } from './types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

/** One CSV column, as the value mapping reads it. */
interface MappedColumn {
  readonly index: number
  readonly field: string | undefined
  readonly values: readonly string[]
}

interface ValueMappingGroupsProps {
  readonly columns: readonly MappedColumn[]
  readonly fieldMeta?: FieldMetaMap
  readonly valueMappings: ValueMappings
  readonly onChange: (column: number, value: string, option: string) => void
}

/**
 * For each column going into a single-choice field, the values the field has
 * no option for — each with a select of the field's options, so the record
 * stores an option rather than the spreadsheet's word. A column whose values
 * are all options draws nothing.
 */
export function ValueMappingGroups({
  columns,
  fieldMeta,
  valueMappings,
  onChange,
}: ValueMappingGroupsProps) {
  const t = useImportWords()
  return (
    <>
      {columns.map(({ index, field, values }) => {
        const meta = field === undefined ? undefined : fieldMeta?.[field]
        const foreign = foreignValues(values, meta)
        if (field === undefined || foreign.length === 0) return undefined
        const options = meta?.options ?? []
        return (
          <fieldset
            key={index}
            className="space-y-2 rounded-md border p-3"
          >
            <legend className={computeTableEditorLabelClasses()}>
              {t('csvImport.unknownValues', 'Values of {field} with no matching option', {
                field: fieldLabel(field, fieldMeta),
              })}
            </legend>
            {foreign.map((value) => (
              <label
                key={value}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{value}</span>
                <select
                  aria-label={value}
                  value={chosenOption(value, valueMappings[index], meta)}
                  onChange={(e) => onChange(index, value, e.target.value)}
                  className={computeTablePanelControlClasses()}
                >
                  <option value="">{t('csvImport.leaveEmpty', 'Leave empty')}</option>
                  {options.map((option) => (
                    <option
                      key={optionValue(option)}
                      value={optionValue(option)}
                    >
                      {optionLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
        )
      })}
    </>
  )
}
