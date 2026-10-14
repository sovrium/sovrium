/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import {
  computeFilterBarOptionClasses,
  FILTER_BAR_APPLY_CLASSES,
  FILTER_BAR_BUILDER_ROW_CLASSES,
  FILTER_BAR_VALUE_CONTROL_CLASSES,
} from '@/presentation/design/filter-bar-default-classes'
import {
  kindOf,
  labelOf,
  operatorLabel,
  operatorsFor,
} from '@/presentation/design/filter-expression'
import type {
  FilterBarCondition,
  FilterBarField,
  FilterFieldKind,
} from '@/presentation/design/filter-expression'
import type { ReactElement } from 'react'

interface ConditionBuilderProps {
  readonly fields: readonly FilterBarField[]
  readonly onApply: (condition: FilterBarCondition) => void
}

/** The draft a reader is assembling: a field, an operator over it, and a value. */
interface Draft {
  readonly field?: FilterBarField
  readonly operator?: string
  readonly value: string
}

/**
 * The three rows of the add-condition builder, drawn in the add control's
 * popover.
 *
 * FIELDS stay on screen after one is chosen, rather than being replaced by the
 * operator row. A wizard reads better on paper and is worse to use: picking the
 * wrong column is the commonest mis-click, and a wizard makes correcting it a
 * back-step where this makes it another click on a row already in front of the
 * reader.
 *
 * The field row offers exactly the DECLARED fields. The bar has no table
 * binding — it may drive subscribers over different tables — so there is no
 * schema to introspect and nothing else it could honestly offer. A menu built
 * from a table would also carry that table's `id` and the engine's own system
 * columns, which are not things a reader filters on.
 */
export function ConditionBuilder({ fields, onApply }: ConditionBuilderProps): ReactElement {
  const [draft, setDraft] = useState<Draft>({ value: '' })

  const chooseField = useCallback((field: FilterBarField) => {
    // The first operator of the field's kind is pre-selected so a reader who
    // only names a column and a value can apply; picking one explicitly still
    // overrides it. Leaving it unset would make the commonest condition — `is`
    // — cost one more click than any other.
    setDraft({ field, operator: operatorsFor(field)[0], value: '' })
  }, [])

  const chooseOperator = useCallback((operator: string) => {
    setDraft((previous) => ({ ...previous, operator }))
  }, [])

  const changeValue = useCallback((value: string) => {
    setDraft((previous) => ({ ...previous, value }))
  }, [])

  const apply = useCallback(() => {
    const { field, operator, value } = draft
    if (!field || operator === undefined || value === '') return
    onApply({ field: field.name, operator, value })
    setDraft({ value: '' })
  }, [draft, onApply])

  return (
    <div className="flex flex-col gap-2">
      <FieldRow
        fields={fields}
        selected={draft.field}
        onChoose={chooseField}
      />
      {draft.field && (
        <OperatorRow
          field={draft.field}
          selected={draft.operator}
          onChoose={chooseOperator}
        />
      )}
      {draft.field && (
        <ValueControl
          field={draft.field}
          value={draft.value}
          onChange={changeValue}
        />
      )}
      <button
        type="button"
        onClick={apply}
        data-slot="button"
        data-variant="default"
        data-size="sm"
        className={FILTER_BAR_APPLY_CLASSES}
      >
        Apply
      </button>
    </div>
  )
}

interface FieldRowProps {
  readonly fields: readonly FilterBarField[]
  readonly selected: FilterBarField | undefined
  readonly onChoose: (field: FilterBarField) => void
}

function FieldRow({ fields, selected, onChoose }: FieldRowProps): ReactElement {
  return (
    <span className={FILTER_BAR_BUILDER_ROW_CLASSES}>
      {fields.map((field) => (
        <FieldOption
          key={field.name}
          field={field}
          active={selected?.name === field.name}
          onChoose={onChoose}
        />
      ))}
    </span>
  )
}

function FieldOption({
  field,
  active,
  onChoose,
}: {
  readonly field: FilterBarField
  readonly active: boolean
  readonly onChoose: (field: FilterBarField) => void
}): ReactElement {
  const handleClick = useCallback(() => onChoose(field), [field, onChoose])
  return (
    <button
      type="button"
      data-filter-field-option={field.name}
      aria-pressed={active ? 'true' : 'false'}
      onClick={handleClick}
      className={computeFilterBarOptionClasses({ active, strong: true })}
    >
      {labelOf(field, field.name)}
    </button>
  )
}

interface OperatorRowProps {
  readonly field: FilterBarField
  readonly selected: string | undefined
  readonly onChoose: (operator: string) => void
}

function OperatorRow({ field, selected, onChoose }: OperatorRowProps): ReactElement {
  const kind = kindOf(field)
  return (
    <span className={FILTER_BAR_BUILDER_ROW_CLASSES}>
      {operatorsFor(field).map((operator) => (
        <OperatorOption
          key={operator}
          operator={operator}
          kind={kind}
          active={selected === operator}
          onChoose={onChoose}
        />
      ))}
    </span>
  )
}

function OperatorOption({
  operator,
  kind,
  active,
  onChoose,
}: {
  readonly operator: string
  readonly kind: FilterFieldKind
  readonly active: boolean
  readonly onChoose: (operator: string) => void
}): ReactElement {
  const handleClick = useCallback(() => onChoose(operator), [operator, onChoose])
  return (
    <button
      type="button"
      data-filter-operator-option={operator}
      aria-pressed={active ? 'true' : 'false'}
      onClick={handleClick}
      className={computeFilterBarOptionClasses({ active })}
    >
      {operatorLabel(operator, kind)}
    </button>
  )
}

interface ValueControlProps {
  readonly field: FilterBarField
  readonly value: string
  readonly onChange: (value: string) => void
}

/**
 * The value control, chosen from the field's kind.
 *
 * A `select` field with declared choices gets a `<select>`: its values are a
 * closed set the author already wrote down, and a free-text box over them
 * invites a typo that filters to nothing with no way to tell. Every other kind
 * gets a text box — including `number`, whose value is coerced when the
 * expression is built rather than by the control.
 */
function ValueControl({ field, value, onChange }: ValueControlProps): ReactElement {
  const handleChange = useCallback(
    (event: { readonly target: { readonly value: string } }) => onChange(event.target.value),
    [onChange]
  )
  const { options } = field
  if (kindOf(field) === 'select' && options !== undefined && options.length > 0) {
    return (
      <select
        data-filter-value-input
        aria-label={`${labelOf(field, field.name)} value`}
        value={value}
        onChange={handleChange}
        className={FILTER_BAR_VALUE_CONTROL_CLASSES}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label ?? option.value}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      type="text"
      data-filter-value-input
      aria-label={`${labelOf(field, field.name)} value`}
      value={value}
      onChange={handleChange}
      className={FILTER_BAR_VALUE_CONTROL_CLASSES}
    />
  )
}
