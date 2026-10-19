/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A currency field in an editable record sheet: a text box flanked by the
 * currency's sign (shadcn/ui's input group), its amount grouped as the page
 * reads numbers — `12,480` on an English page — and typed back the same way.
 * What the reader types is held as she typed it; the sheet holds, and saves,
 * the plain number it reads as (`9,450.50` is `9450.5`).
 */

import { useEffect, useState, type ReactElement } from 'react'
import {
  currencySignOf,
  formatGroupedAmount,
  parseGroupedAmount,
} from '@/domain/kernel/format/grouped-amount'
import { computeInputGroupAddonClasses } from '@/presentation/design/input-group-default-classes'
import { computeInputGroupFieldClasses } from '@/presentation/design/input-group-field-classes'
import { computeInputGroupClasses } from '@/presentation/design/input-group-root-classes'
import { RequiredMark } from '../parts/crud-form/field-label'
import { resolvePageLocale } from '../runtime/page-locale'
import { controlStateAttributes } from './record-drawer-control-state'
import { RefusalLine } from './record-drawer-refusal-line'
import type { TypedFieldProps } from './record-drawer-typed-input'

/** The currency's sign, before or after the amount as the field or the page places it. */
function SignAddon({
  currency,
  position,
  locale,
}: {
  readonly currency: string
  readonly position: 'before' | 'after' | undefined
  readonly locale: string
}): ReactElement {
  const sign = currencySignOf(currency, locale)
  const before = position === undefined ? sign.before : position === 'before'
  const align = before ? 'inline-start' : 'inline-end'
  return (
    <span
      data-slot="input-group-addon"
      data-align={align}
      className={computeInputGroupAddonClasses({ align, content: sign.symbol })}
    >
      {sign.symbol}
    </span>
  )
}

/** The amount box — see the module note. */
export function AmountField(props: TypedFieldProps): ReactElement {
  const { field, label, value, disabled, onChange, children } = props
  const locale = resolvePageLocale()
  const [text, setText] = useState(() => formatGroupedAmount(value, locale))
  // The record landing, or a save resetting it, replaces what the box shows;
  // the reader's own typing, which reads as the value already held, does not.
  useEffect(() => {
    setText((typed) =>
      parseGroupedAmount(typed, locale) === value ? typed : formatGroupedAmount(value, locale)
    )
  }, [value, locale])
  const code = field.currency?.currency
  return (
    <label
      data-field={field.name}
      className="text-md flex flex-col gap-1"
    >
      <span className="text-muted-foreground">
        {label}
        <RequiredMark marked={field.requiredMark} />
      </span>
      <span
        data-slot="input-group"
        className={computeInputGroupClasses()}
      >
        {code === undefined ? undefined : (
          <SignAddon
            currency={code}
            position={field.currency?.symbolPosition}
            locale={locale}
          />
        )}
        <input
          type="text"
          inputMode="decimal"
          data-slot="input-group-control"
          data-component-type="input"
          aria-label={label}
          name={field.name}
          value={text}
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value)
            onChange(field.name, parseGroupedAmount(event.target.value, locale))
          }}
          className={computeInputGroupFieldClasses()}
          {...controlStateAttributes(props)}
        />
      </span>
      <RefusalLine
        name={field.name}
        error={props.error}
      />
      {children}
    </label>
  )
}
