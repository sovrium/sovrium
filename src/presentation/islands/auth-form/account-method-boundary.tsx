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
 * carries what was typed into the server's skeleton (`initialValues`).
 */

import { useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { authPendingLabel, authSubmitLabel } from '@/presentation/design/auth-form-types'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { useDeferredComponent } from '../parts/deferred-component'
import { AuthFieldRow } from './auth-form-fields'
import type { AccountMethodFormProps } from './account-method-form'

const loadAccountMethodForm = () =>
  import('./account-method-form').then((module) => module.AccountMethodForm)

const noop = (): void => undefined

/** The island's props, before the defaults the server normally fills in. */
export type AccountMethodBoundaryProps = Omit<
  AccountMethodFormProps,
  'fields' | 'submitLabel' | 'pendingLabel'
> &
  Partial<Pick<AccountMethodFormProps, 'fields' | 'submitLabel' | 'pendingLabel'>>

const NO_FIELDS: AccountMethodFormProps['fields'] = []

/** The account form once loaded; its server-drawn shape until then. */
export function AccountMethodBoundary(input: AccountMethodBoundaryProps): ReactElement {
  const Form = useDeferredComponent(loadAccountMethodForm)
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
  if (Form !== undefined)
    return (
      <Form
        {...props}
        initialValues={initialValues}
      />
    )
  const keep = (event: FormEvent<HTMLFormElement>): void => {
    const { target } = event
    if (!(target instanceof HTMLInputElement)) return
    const { name, value } = target
    setTyped((previous) => ({ ...previous, [name]: value }))
  }
  return (
    <form
      className={computeFormLayoutClasses()}
      id={props.id}
      aria-busy="true"
      onChange={keep}
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
        className={`${computeButtonDefaultClasses()} w-full`}
      >
        {props.submitLabel}
      </button>
    </form>
  )
}
