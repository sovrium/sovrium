/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The editable drawer's choice controls: a status or a single-select offered
 * as its declared options, and a `user` field offered as the accounts it may
 * hold, each shown by name — the choices the form offers for the same fields,
 * never a text box holding a value the reader has to know.
 *
 * Both are one native `<select>`: the value written is the option's value (the
 * stored option, or the account id), the text shown is its label. A stored
 * value no choice lists is kept as an option of its own, so opening a drawer
 * never silently rewrites what the record holds.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- a field's onChange closes over its name; transient surface, rendered only while the drawer is open */

import { fieldDescribedBy } from '@/presentation/design/field-display'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { useAccountChoices, type DrawerChoice } from './record-drawer-choices'
import type { ReactElement, ReactNode } from 'react'

/** The input component's surface — one input (36 px) high, as every drawer control is. */
const SELECT_CLASS = `${computeInputDefaultClasses()} disabled:cursor-not-allowed disabled:opacity-60`

/** The choices, plus the stored value when no choice lists it. */
const withStoredValue = (
  choices: ReadonlyArray<DrawerChoice>,
  value: string
): ReadonlyArray<DrawerChoice> =>
  value === '' || choices.some((choice) => choice.value === value)
    ? choices
    : [...choices, { value, label: value }]

function ChoiceInput({
  field,
  label,
  choices,
  value,
  disabled,
  onChange,
}: {
  readonly field: { readonly name: string; readonly description?: string }
  readonly label: string
  readonly choices: ReadonlyArray<DrawerChoice>
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
}): ReactElement {
  return (
    <select
      data-component-type="select"
      aria-label={label}
      name={field.name}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(field.name, event.target.value)}
      className={SELECT_CLASS}
      {...fieldDescribedBy(field)}
    >
      {value === '' && <option value="" />}
      {withStoredValue(choices, value).map((choice) => (
        <option
          key={choice.value}
          value={choice.value}
        >
          {choice.label}
        </option>
      ))}
    </select>
  )
}

const NO_OPTIONS: ReadonlyArray<DrawerChoice> = []

/**
 * An editable status / single-select entry offered as its options, or a
 * `user` entry offered as the accounts it may hold, named — the form's
 * choices for the same fields. `label` is the entry's heading and `children`
 * its guidance line.
 */
export function ChoiceField({
  field,
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  readonly field: {
    readonly name: string
    readonly type: string
    readonly description?: string
    readonly options?: ReadonlyArray<DrawerChoice>
  }
  readonly label: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  readonly children?: ReactNode
}): ReactElement {
  const accounts = useAccountChoices(field.type === 'user')
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-foreground-muted">{label}</span>
      <ChoiceInput
        field={field}
        label={label}
        choices={field.type === 'user' ? accounts : (field.options ?? NO_OPTIONS)}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
      {children}
    </label>
  )
}
