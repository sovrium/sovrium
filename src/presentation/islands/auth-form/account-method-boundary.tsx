/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The lazy door to the account methods' form (`account-method-form.tsx`).
 *
 * The enrolment screens carry a QR encoder and screens a sign-in page never
 * draws, so they load only when a page holds an account form. Until they
 * arrive the form is drawn as the server drew it — its fields and a disabled
 * button — so nothing moves and nothing can be sent half-wired. Whatever the
 * reader types meanwhile is carried into the loaded form, as the island mounter
 * carries what was typed into the server's skeleton (`initialValues`), and the
 * keyboard stays on the field she was typing in (`useCarriedFocus`).
 */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactElement,
  type RefObject,
  type SetStateAction,
} from 'react'
import { authPendingLabel, authSubmitLabel } from '@/presentation/design/auth-form-types'
import { computeSubmitButtonClasses } from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { useDeferredComponent } from '../parts/deferred-component'
import { AuthFieldRow } from './auth-form-fields'
import { TwoFactorNoticeView } from './two-factor-notice'
import type { AccountMethodFormProps } from './account-method-form'

const loadAccountMethodForm = () =>
  import('./account-method-form').then((module) => module.AccountMethodForm)
// The same lazy module: a connect/disconnect control costs a sign-in page nothing.
const loadAccountLinkControl = () =>
  import('./account-method-form').then((module) => module.AccountLinkControl)

const noop = (): void => undefined

/** The island's props, before the defaults the server normally fills in. */
export type AccountMethodBoundaryProps = Omit<
  AccountMethodFormProps,
  'fields' | 'submitLabel' | 'pendingLabel'
> &
  Partial<Pick<AccountMethodFormProps, 'fields' | 'submitLabel' | 'pendingLabel'>>

const NO_FIELDS: AccountMethodFormProps['fields'] = []

/** Note what the reader types into the server-drawn form, by field name. */
const keepTyped =
  (setTyped: Dispatch<SetStateAction<Readonly<Record<string, string>>>>) =>
  (event: FormEvent<HTMLFormElement>): void => {
    const { target } = event
    if (target instanceof HTMLInputElement)
      setTyped((previous) => ({ ...previous, [target.name]: target.value }))
  }

/** The field that had the keyboard when the loaded form replaced the server-drawn one. */
interface HeldFocus {
  readonly host: HTMLElement
  readonly name: string
  readonly start: number | null
  readonly end: number | null
}

/**
 * Keep the keyboard on the field the reader is typing in when the loaded form
 * replaces the server-drawn one.
 *
 * The swap removes the field under her caret, and the browser drops the focus
 * on `<body>`: whatever she types next goes nowhere, and the form is sent
 * without it. The skeleton's ref cleanup runs inside the commit, BEFORE its
 * node leaves the document, so it can still see which field is focused; the
 * layout effect then hands the keyboard to the loaded twin of that field,
 * caret and selection included, in that same commit — no keystroke can land
 * in between. A reader who has moved on to something else is not pulled back.
 */
function useCarriedFocus(loaded: boolean): (form: HTMLFormElement | null) => (() => void) | void {
  const held: RefObject<HeldFocus | undefined> = useRef(undefined)
  useLayoutEffect(() => {
    const focus = held.current
    if (!loaded || focus === undefined) return
    held.current = undefined
    const current = document.activeElement
    if (current !== null && current !== document.body) return
    const control = focus.host.querySelector<HTMLInputElement>(
      `input[name="${CSS.escape(focus.name)}"]`
    )
    if (control === null) return
    control.focus()
    if (focus.start === null || focus.end === null) return
    try {
      control.setSelectionRange(focus.start, focus.end)
    } catch {
      // A field type without a text selection: the focus alone is right.
    }
  }, [loaded])
  return useCallback((form: HTMLFormElement | null) => {
    if (form === null) return
    return () => {
      const active = document.activeElement
      const host = form.parentElement
      if (!(active instanceof HTMLInputElement) || active.name === '') return
      if (!form.contains(active) || host === null) return
      held.current = {
        host,
        name: active.name,
        start: active.selectionStart,
        end: active.selectionEnd,
      }
    }
  }, [])
}

/**
 * `linkAccount` / `unlinkAccount` once loaded; nothing drawn until then — and
 * nothing until the control knows which of the pair applies.
 */
export function AccountLinkBoundary(input: AccountMethodBoundaryProps): ReactElement {
  const Link = useDeferredComponent(loadAccountLinkControl)
  if (Link === undefined)
    return (
      <form
        id={input.id}
        hidden
      />
    )
  return (
    <Link
      {...input}
      provider={input.provider ?? ''}
      submitLabel={input.submitLabel ?? authSubmitLabel(input.method)}
      pendingLabel={input.pendingLabel ?? authPendingLabel(input.method)}
    />
  )
}

/**
 * The account form once loaded; its server-drawn shape until then. A code form
 * with no sign-in waiting draws its notice at once: it needs nothing the form loads.
 */
export function AccountMethodBoundary(input: AccountMethodBoundaryProps): ReactElement {
  const Form = useDeferredComponent(loadAccountMethodForm)
  const holdFocus = useCarriedFocus(Form !== undefined)
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({})
  const props: AccountMethodFormProps = {
    ...input,
    fields: input.fields ?? NO_FIELDS,
    submitLabel: input.submitLabel ?? authSubmitLabel(input.method),
    pendingLabel: input.pendingLabel ?? authPendingLabel(input.method),
  }
  const initialValues = useMemo(
    () => ({ ...input.initialValues, ...typed }),
    [input.initialValues, typed]
  )
  if (input.twoFactorNotice?.shown === true)
    return (
      <TwoFactorNoticeView
        {...input}
        notice={input.twoFactorNotice}
      />
    )
  if (Form !== undefined)
    return (
      <Form
        {...props}
        initialValues={initialValues}
      />
    )
  return (
    <form
      ref={holdFocus}
      className={computeFormLayoutClasses()}
      id={props.id}
      aria-busy="true"
      onChange={keepTyped(setTyped)}
    >
      {props.fields.map((field) => (
        <AuthFieldRow
          key={field.name}
          field={field}
          defaultValue={input.initialValues?.[field.name] ?? ''}
          error={undefined}
          onBlur={noop}
        />
      ))}
      <button
        type="submit"
        disabled
        data-component-type="button"
        className={`${computeSubmitButtonClasses(props.submitVariant)} w-full`}
      >
        {props.submitLabel}
      </button>
    </form>
  )
}
