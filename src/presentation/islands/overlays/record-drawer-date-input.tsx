/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A date field in an editable record sheet: a text box holding the day in the
 * PAGE's date format — `14/10/2026` on an English (UK) page — and reading what
 * the reader types the same way. A native date input would follow the
 * browser's locale instead, so the same page read in another browser would
 * show the month first. The sheet holds, and saves, the day as `YYYY-MM-DD`.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { formatPageDate, parsePageDate } from '@/domain/kernel/format/page-date-text'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { RequiredMark } from '../parts/crud-form/field-label'
import { resolvePageLocale } from '../runtime/page-locale'
import { controlStateAttributes } from './record-drawer-control-state'
import { RefusalLine } from './record-drawer-refusal-line'
import type { TypedFieldProps } from './record-drawer-typed-input'

const CONTROL_CLASS = `${computeInputDefaultClasses()} disabled:cursor-not-allowed disabled:opacity-60`

/** The date box — see the module note. */
export function DateTextField(props: TypedFieldProps): ReactElement {
  const { field, label, value, disabled, onChange, children } = props
  const locale = resolvePageLocale()
  const [text, setText] = useState(() => formatPageDate(value, locale))
  // The record landing replaces what the box shows; the reader's own typing,
  // which reads as the day already held, does not.
  useEffect(() => {
    setText((typed) =>
      parsePageDate(typed, locale) === value ? typed : formatPageDate(value, locale)
    )
  }, [value, locale])
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-muted-foreground">
        {label}
        <RequiredMark marked={field.requiredMark} />
      </span>
      <input
        type="text"
        data-component-type="date-picker"
        aria-label={label}
        name={field.name}
        value={text}
        disabled={disabled}
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value)
          onChange(field.name, parsePageDate(event.target.value, locale))
        }}
        className={CONTROL_CLASS}
        {...controlStateAttributes(props)}
      />
      <RefusalLine
        name={field.name}
        error={props.error}
      />
      {children}
    </label>
  )
}
