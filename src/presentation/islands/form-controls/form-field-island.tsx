/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { ChoiceSelect, type ChoiceSelectOption } from '../parts/choice-select'
import { DateTextBox } from '../parts/date-text-box'

/**
 * One control of a server-rendered form (a hosted `/forms/…` page, or a form
 * a page or a dialog embeds through `formRef`) that the browser cannot draw in
 * the app's design: a choice field, drawn as the Select, and a date field,
 * drawn as the date picker. Every other control of such a form stays the
 * markup the server wrote; these two are mounted in place of their skeleton.
 *
 * The form's own inline runtime still owns the form — its rules, its
 * calculations, its validation, its submission — and reads the controls by
 * their `name`. So the value always lives in a NAMED input the browser
 * validates and posts, and the island keeps that runtime in step:
 *
 * - a reader's change is announced with `input` and `change` on the named
 *   input, as a native control's would be, so rules and calculations follow;
 * - once mounted, it announces itself (`sovrium:control-ready`), so the
 *   runtime applies its rules to the input that replaced the skeleton's — a
 *   field a rule hides is disabled by the runtime, never by the island, so
 *   the rule can give it back;
 * - a reset by the runtime (`sovrium:values-reset`, after it rewrote the
 *   inputs) or by the browser (`reset`) is read back into the control.
 */
export interface FormFieldIslandProps {
  readonly kind: 'select' | 'date'
  /** The control's id, which the field's `<label for>` names it by. */
  readonly id: string
  readonly name: string
  readonly value?: string
  readonly options?: readonly ChoiceSelectOption[]
  /** The leading "no answer" choice's label (a choice field). */
  readonly emptyLabel?: string
  readonly placeholder?: string
  readonly required?: boolean
  /** The date picker's words, in the page language where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
  /** What the skeleton's named input held when the island mounted. */
  readonly initialValues?: Readonly<Record<string, string>>
}

const NO_OPTIONS: readonly ChoiceSelectOption[] = []

/** Announce a value the reader set, as a native control would. */
function announce(input: HTMLInputElement | null): void {
  input?.dispatchEvent(new Event('input', { bubbles: true }))
  input?.dispatchEvent(new Event('change', { bubbles: true }))
}

/** The held value, kept in step with the form's runtime — see the module note. */
function useRuntimeValue(props: FormFieldIslandProps) {
  const start = props.initialValues?.[props.name] ?? props.value ?? ''
  const [value, setValue] = useState(start)
  const input = useRef<HTMLInputElement | null>(null)
  // The named input can be replaced after mount (the Select's stand-in gives
  // way to the loaded Select), so the input is followed, not read once.
  const [own, setOwn] = useState<HTMLInputElement | null>(null)
  const inputRef = useCallback((element: HTMLInputElement | null) => {
    input.current = element
    if (element !== null) setOwn(element)
  }, [])
  const changed = useRef(false)
  useEffect(() => {
    if (!changed.current) return
    changed.current = false
    announce(input.current)
  }, [value])
  useEffect(() => {
    own?.dispatchEvent(new Event('sovrium:control-ready', { bubbles: true }))
    const form = own?.form
    if (!form) return undefined
    const readBack = (): void => setValue(own.value)
    const backToStart = (): void => setValue(props.value ?? '')
    form.addEventListener('sovrium:values-reset', readBack)
    form.addEventListener('reset', backToStart)
    return () => {
      form.removeEventListener('sovrium:values-reset', readBack)
      form.removeEventListener('reset', backToStart)
    }
  }, [own, props.value])
  const change = useCallback((next: string) => {
    changed.current = true
    setValue(next)
  }, [])
  return { value, change, inputRef }
}

export default function FormFieldIsland(props: FormFieldIslandProps): ReactElement {
  const { value, change, inputRef } = useRuntimeValue(props)
  if (props.kind === 'date') {
    return (
      <DateTextBox
        id={props.id}
        valueName={props.name}
        valueRef={inputRef}
        value={value}
        onChange={change}
        uiStrings={props.uiStrings}
        {...(props.required === true && { required: true })}
        {...(props.placeholder === undefined ? {} : { placeholder: props.placeholder })}
      />
    )
  }
  return (
    <ChoiceSelect
      id={props.id}
      name={props.name}
      inputRef={inputRef}
      value={value}
      onValueChange={change}
      options={props.options ?? NO_OPTIONS}
      emptyLabel={props.emptyLabel ?? ''}
      {...(props.required === true && { required: true })}
    />
  )
}
