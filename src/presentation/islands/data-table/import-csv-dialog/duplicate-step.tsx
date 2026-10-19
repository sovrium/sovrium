/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableDialogBodyClasses,
  computeTableEditorLabelClasses,
  computeTablePanelControlClasses,
} from '@/presentation/design/table-default-classes'
import { fieldLabel } from './field-reading'
import { useImportWord } from './import-words'
import type { DuplicateStrategy } from './types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface DuplicateStepProps {
  readonly duplicateStrategy: DuplicateStrategy
  readonly setDuplicateStrategy: (strategy: DuplicateStrategy) => void
  readonly uniqueField: string | undefined
  readonly setUniqueField: (field: string | undefined) => void
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
}

function StrategyRadio({
  value,
  current,
  label,
  onChange,
}: {
  readonly value: DuplicateStrategy
  readonly current: DuplicateStrategy
  readonly label: string
  readonly onChange: (value: DuplicateStrategy) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="radio"
        name="duplicate-strategy"
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
    </label>
  )
}

/** The field two rows must share to count as duplicates. */
function UniqueFieldSelect({
  uniqueField,
  setUniqueField,
  tableFields,
  fieldMeta,
}: Pick<DuplicateStepProps, 'uniqueField' | 'setUniqueField' | 'tableFields' | 'fieldMeta'>) {
  const uniqueLabel = useImportWord('csvImport.uniqueField', 'Unique field')
  const chooseField = useImportWord('csvImport.selectField', 'Select a field…')
  return (
    <div className="mt-3 flex items-center gap-2">
      <label
        htmlFor="csv-import-unique-field"
        className={computeTableEditorLabelClasses()}
      >
        {uniqueLabel}
      </label>
      <select
        id="csv-import-unique-field"
        aria-label={uniqueLabel}
        value={uniqueField ?? ''}
        onChange={(e) => setUniqueField(e.target.value || undefined)}
        className={computeTablePanelControlClasses()}
      >
        <option value="">{chooseField}</option>
        {tableFields?.map((field) => (
          <option
            key={field}
            value={field}
          >
            {fieldLabel(field, fieldMeta)}
          </option>
        ))}
      </select>
    </div>
  )
}

export function DuplicateStep({
  duplicateStrategy,
  setDuplicateStrategy,
  uniqueField,
  setUniqueField,
  tableFields,
  fieldMeta,
}: DuplicateStepProps) {
  const showUniqueField = duplicateStrategy === 'skip' || duplicateStrategy === 'overwrite'
  return (
    <div className="space-y-3">
      <p className={computeTableDialogBodyClasses()}>
        {useImportWord('csvImport.duplicates', 'How should duplicate records be handled?')}
      </p>
      <StrategyRadio
        value="skip"
        current={duplicateStrategy}
        label={useImportWord('csvImport.skipDuplicates', 'Skip duplicates')}
        onChange={setDuplicateStrategy}
      />
      <StrategyRadio
        value="overwrite"
        current={duplicateStrategy}
        label={useImportWord('csvImport.overwriteDuplicates', 'Overwrite duplicates')}
        onChange={setDuplicateStrategy}
      />
      <StrategyRadio
        value="create"
        current={duplicateStrategy}
        label={useImportWord('csvImport.createNew', 'Create new records')}
        onChange={setDuplicateStrategy}
      />
      {showUniqueField && (
        <UniqueFieldSelect
          uniqueField={uniqueField}
          setUniqueField={setUniqueField}
          tableFields={tableFields}
          fieldMeta={fieldMeta}
        />
      )}
    </div>
  )
}
