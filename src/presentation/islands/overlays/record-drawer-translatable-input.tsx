/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A translatable field in the record sheet: one tab per declared language,
 * the default first, over the field's own control.
 *
 * The control shows the open tab's language; typing writes that language
 * only. Every language the sheet loaded is held, and Save sends them all
 * (`record-drawer-values.ts`), so a save made in one tab keeps the others. A
 * language holding no value says so on its tab.
 */

import { useState, type KeyboardEvent, type ReactElement } from 'react'
import { FieldInput } from './record-drawer-entry'
import { languageValueKey, type Values } from './record-drawer-values'
import type { RecordDrawerField } from './record-drawer-field'

const TABLIST_CLASS = 'flex gap-3'
const TAB_CLASS =
  'text-muted-foreground hover:text-foreground border-b-2 border-transparent pb-1 text-sm aria-selected:border-primary aria-selected:text-foreground'

/** The tab an arrow key moves to, as a tablist does. */
const steppedCode = (
  codes: readonly string[],
  current: string,
  key: string
): string | undefined => {
  const at = codes.indexOf(current)
  if (key === 'ArrowRight') return codes[(at + 1) % codes.length]
  if (key === 'ArrowLeft') return codes[(at - 1 + codes.length) % codes.length]
  return undefined
}

/** One translatable field: its language tabs, then the open language's control. */
export function TranslatableFieldInput({
  field,
  values,
  disabled,
  onChange,
  error,
}: {
  readonly field: RecordDrawerField
  readonly values: Values
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
  readonly error?: string | undefined
}): ReactElement {
  const languages = field.languages ?? []
  const codes = languages.map((language) => language.code)
  const [open, setOpen] = useState(codes[0] ?? '')
  const key = languageValueKey(field, open)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = steppedCode(codes, open, event.key)
    if (next !== undefined) setOpen(next)
  }
  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label={`${field.label ?? field.name}: languages`}
        className={TABLIST_CLASS}
        onKeyDown={onKeyDown}
      >
        {languages.map(({ code, label }) => {
          const empty = (values[languageValueKey(field, code)] ?? '').trim() === ''
          return (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={code === open}
              tabIndex={code === open ? 0 : -1}
              data-language={code}
              onClick={() => setOpen(code)}
              className={TAB_CLASS}
            >
              {label}
              {empty && <span className="text-muted-foreground ms-1 text-xs">(empty)</span>}
            </button>
          )
        })}
      </div>
      <FieldInput
        field={field}
        value={values[key] ?? ''}
        disabled={disabled}
        onChange={(_name, value) => onChange(key, value)}
        error={error}
      />
    </div>
  )
}
