/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, type ReactElement } from 'react'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { DateTextBox } from '../date-text-box'
import { FieldHelpText } from './field-help-text'
import { FieldLabelText, LabelledControl } from './field-label'
import type { TypedFieldProps } from './typed-fields'

/**
 * A `date` column: the date picker (see `parts/date-text-box`) — a box typed
 * in the page's date format with the calendar beside it. The box carries the
 * field's name; the form holds, and sends, the day as `YYYY-MM-DD`.
 */
interface DateFieldProps extends TypedFieldProps {
  /** The picker's words, in the page language where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>> | undefined
}

export function DateField({
  field,
  value,
  onChange,
  invalid,
  uiStrings,
}: DateFieldProps): ReactElement {
  const change = useCallback((day: string) => onChange(field.name, day), [onChange, field.name])
  return (
    <LabelledControl
      label={<FieldLabelText field={field} />}
      help={<FieldHelpText field={field} />}
      control={(id) => (
        <DateTextBox
          id={id}
          name={field.name}
          value={value}
          onChange={change}
          uiStrings={uiStrings}
          {...(field.required === true && { required: true })}
          {...(field.disabled === true && { disabled: true })}
          {...(field.readOnly === true && { readOnly: true })}
          {...(field.placeholder === undefined ? {} : { placeholder: field.placeholder })}
          {...(invalid === true && { invalid: true })}
          {...(field.description === undefined
            ? {}
            : { describedBy: fieldDescriptionId(field.name) })}
        />
      )}
    />
  )
}
