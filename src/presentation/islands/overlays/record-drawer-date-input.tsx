/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A date field in an editable record sheet: the date picker a form draws
 * (`parts/date-text-box`) — a box holding the day in the PAGE's date format,
 * `14/10/2026` on an English (UK) page, read back the same way, with a
 * "Pick a date" calendar inside its end. A native date input would follow the
 * browser's locale instead. The box shows the page's date format as its
 * placeholder (`MM/DD/YYYY` on an English (US) page). The sheet holds, and
 * saves, the day as `YYYY-MM-DD`.
 */

import { useCallback, useMemo, type ReactElement } from 'react'
import { pageDatePattern } from '@/domain/kernel/format/page-date-text'
import { RequiredMark } from '../parts/crud-form/field-label'
import { DateTextBox } from '../parts/date-text-box'
import { resolvePageLocale } from '../runtime/page-locale'
import { useControlStateAttributes } from './record-drawer-control-state'
import { useDatePickerWords } from './record-drawer-date-words'
import { RefusalLine } from './record-drawer-refusal-line'
import type { TypedFieldProps } from './record-drawer-typed-input'

/** The date picker — see the module note. */
export function DateTextField(props: TypedFieldProps): ReactElement {
  const { field, label, value, disabled, onChange, children } = props
  const locale = resolvePageLocale()
  const placeholder = useMemo(() => pageDatePattern(locale), [locale])
  const words = useDatePickerWords()
  const change = useCallback((day: string) => onChange(field.name, day), [onChange, field.name])
  const state = useControlStateAttributes(props)
  const describedBy = state['aria-describedby']
  return (
    <div className="text-md flex flex-col gap-1">
      <span className="text-muted-foreground">
        {label}
        <RequiredMark marked={field.requiredMark} />
      </span>
      <DateTextBox
        name={field.name}
        value={value}
        onChange={change}
        ariaLabel={label}
        placeholder={placeholder}
        disabled={disabled}
        uiStrings={words}
        {...(field.required === true && { required: true })}
        {...(state['aria-invalid'] === undefined ? {} : { invalid: true })}
        {...(typeof describedBy === 'string' ? { describedBy } : {})}
      />
      <RefusalLine
        name={field.name}
        error={props.error}
      />
      {children}
    </div>
  )
}
