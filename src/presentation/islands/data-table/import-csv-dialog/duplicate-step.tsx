/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DuplicateStrategy } from './types'

interface DuplicateStepProps {
  readonly duplicateStrategy: DuplicateStrategy
  readonly setDuplicateStrategy: (strategy: DuplicateStrategy) => void
  readonly uniqueField: string | undefined
  readonly setUniqueField: (field: string | undefined) => void
  readonly tableFields?: readonly string[]
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

export function DuplicateStep({
  duplicateStrategy,
  setDuplicateStrategy,
  uniqueField,
  setUniqueField,
  tableFields,
}: DuplicateStepProps) {
  const showUniqueField = duplicateStrategy === 'skip' || duplicateStrategy === 'overwrite'
  return (
    <div className="space-y-3">
      <p className="text-foreground-muted mb-4 text-sm">How should duplicate records be handled?</p>
      <StrategyRadio
        value="skip"
        current={duplicateStrategy}
        label="Skip duplicates"
        onChange={setDuplicateStrategy}
      />
      <StrategyRadio
        value="overwrite"
        current={duplicateStrategy}
        label="Overwrite duplicates"
        onChange={setDuplicateStrategy}
      />
      <StrategyRadio
        value="create"
        current={duplicateStrategy}
        label="Create new records"
        onChange={setDuplicateStrategy}
      />
      {showUniqueField && (
        <div className="mt-3 flex items-center gap-2">
          <label
            htmlFor="csv-import-unique-field"
            className="text-foreground text-sm font-medium"
          >
            Unique field
          </label>
          <select
            id="csv-import-unique-field"
            aria-label="Unique field"
            value={uniqueField ?? ''}
            onChange={(e) => setUniqueField(e.target.value || undefined)}
            className="border-border rounded border px-2 py-1 text-sm"
          >
            <option value="">Select a field…</option>
            {tableFields?.map((field) => (
              <option
                key={field}
                value={field}
              >
                {field}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
