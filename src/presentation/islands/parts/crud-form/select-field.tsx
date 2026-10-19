/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, type ReactElement } from 'react'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { ChoiceSelect } from '../choice-select'
import { FieldHelpText } from './field-help-text'
import { FieldLabelText, LabelledControl } from './field-label'
import type { FieldDef } from './field-def'

/**
 * A choice column (`single-select`, `status`): the design system's Select (see
 * `parts/choice-select`), labelled by the field and led by its "no answer"
 * choice, so an optional field can be set back to empty.
 */
export interface SelectFieldProps {
  readonly field: FieldDef
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  readonly options: NonNullable<FieldDef['options']>
  readonly invalid?: boolean
}

export function SelectField({
  field,
  value,
  onChange,
  options,
  invalid,
}: SelectFieldProps): ReactElement {
  const change = useCallback((next: string) => onChange(field.name, next), [onChange, field.name])
  return (
    <LabelledControl
      label={<FieldLabelText field={field} />}
      help={<FieldHelpText field={field} />}
      control={(id) => (
        <ChoiceSelect
          id={id}
          name={field.name}
          value={value}
          onValueChange={change}
          options={options}
          emptyLabel={field.placeholder ?? 'Select...'}
          {...(field.required === true && { required: true })}
          {...(field.disabled === true && { disabled: true })}
          {...(invalid === true && { invalid: true })}
          {...(field.description === undefined
            ? {}
            : { describedBy: fieldDescriptionId(field.name) })}
        />
      )}
    />
  )
}
