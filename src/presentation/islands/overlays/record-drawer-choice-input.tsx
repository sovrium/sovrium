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
 * Both are the design system's Select (`parts/choice-select`), one input high:
 * the value written is the option's value (the stored option, or the account
 * id), the text shown is its label. A stored value no choice lists is kept as
 * an option of its own, so opening a drawer never silently rewrites what the
 * record holds.
 */

import { useCallback, useMemo } from 'react'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { ChoiceSelect } from '../parts/choice-select'
import { RequiredMark } from '../parts/crud-form/field-label'
import { useAccountChoices, type DrawerChoice } from './record-drawer-choices'
import { refusalIdOf } from './record-drawer-field'
import { RefusalLine } from './record-drawer-refusal-line'
import type { OptionChipPaint } from '@/presentation/design/option-chip-paint'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

/** The choices, plus the stored value when no choice lists it. */
const withStoredValue = (
  choices: ReadonlyArray<DrawerChoice>,
  value: string
): ReadonlyArray<DrawerChoice> =>
  value === '' || choices.some((choice) => choice.value === value)
    ? choices
    : [...choices, { value, label: value }]

/**
 * The colour the chosen option declares, as the dot the grid's chip carries —
 * the declared hue as a fill, never as text — or nothing for an option that
 * declares none.
 */
const chosenHue = (paint: OptionChipPaint | undefined): CSSProperties | undefined => {
  const fill = paint?.dot?.style ?? paint?.style
  const hue = fill?.backgroundColor
  return hue === undefined || hue === 'transparent' ? undefined : { backgroundColor: hue }
}

/** The lines describing the choice: its guidance, then why it was refused. */
function describedByOf(
  field: { readonly name: string; readonly description?: string },
  error: string | undefined
): string | undefined {
  const ids = [
    field.description === undefined ? undefined : fieldDescriptionId(field.name),
    error === undefined ? undefined : refusalIdOf(field.name),
  ].filter((id): id is string => id !== undefined)
  return ids.length === 0 ? undefined : ids.join(' ')
}

function ChoiceInput({
  field,
  label,
  choices,
  value,
  disabled,
  onChange,
  indented,
  error,
}: {
  readonly field: { readonly name: string; readonly description?: string }
  readonly label: string
  readonly choices: ReadonlyArray<DrawerChoice>
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  readonly indented: boolean
  readonly error: string | undefined
}): ReactElement {
  const change = useCallback((next: string) => onChange(field.name, next), [onChange, field.name])
  const options = useMemo(() => withStoredValue(choices, value), [choices, value])
  const describedBy = describedByOf(field, error)
  return (
    <ChoiceSelect
      name={field.name}
      ariaLabel={label}
      value={value}
      onValueChange={change}
      options={options}
      disabled={disabled}
      {...(indented && { triggerClassName: 'pl-7' })}
      {...(error !== undefined && { invalid: true })}
      {...(describedBy === undefined ? {} : { describedBy })}
    />
  )
}

const NO_OPTIONS: ReadonlyArray<DrawerChoice> = []

/** The chosen option's colour as a dot before its name, or nothing. */
function HueDot({ hue }: { readonly hue: CSSProperties | undefined }) {
  if (hue === undefined) return undefined
  return (
    <span
      aria-hidden="true"
      data-option-dot=""
      className="pointer-events-none absolute left-3 z-10 size-2 rounded-full"
      style={hue}
    />
  )
}

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
  error,
  children,
}: {
  readonly field: {
    readonly name: string
    readonly type: string
    readonly description?: string
    readonly options?: ReadonlyArray<DrawerChoice>
    readonly requiredMark?: boolean
    readonly paints?: Readonly<Record<string, OptionChipPaint>>
  }
  readonly label: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  /** Why the choice was refused, drawn under the select; absent when it was not. */
  readonly error?: string | undefined
  readonly children?: ReactNode
}): ReactElement {
  const accounts = useAccountChoices(field.type === 'user')
  const hue = chosenHue(field.paints?.[value])
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-muted-foreground">
        {label}
        <RequiredMark marked={field.requiredMark} />
      </span>
      <span className="relative flex items-center">
        <HueDot hue={hue} />
        <ChoiceInput
          field={field}
          label={label}
          choices={field.type === 'user' ? accounts : (field.options ?? NO_OPTIONS)}
          value={value}
          disabled={disabled}
          onChange={onChange}
          indented={hue !== undefined}
          error={error}
        />
      </span>
      <RefusalLine
        name={field.name}
        error={error}
      />
      {children}
    </label>
  )
}
