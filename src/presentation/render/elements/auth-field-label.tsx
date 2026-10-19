/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, type ReactNode } from 'react'
import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '../../design/forms-default-classes'
import { authFieldControlId } from './auth-form-recovery-link'
import type { AuthFormField } from '@/presentation/design/auth-form-types'

/**
 * A field's label around its control, in the server skeleton — the same markup
 * the island's `AuthFieldRow` draws. A sign-in password field carrying a way
 * back in draws shadcn/ui's login-03 row: the label, then "Forgot your
 * password?" at the end of the same row, above the control — the label naming
 * the control by `htmlFor`, since a link inside a `<label>` would join its name.
 */
export function AuthFieldLabel({
  field,
  children,
}: {
  readonly field: AuthFormField
  readonly children: ReactNode
}): ReactElement {
  if (field.recovery === undefined) {
    return (
      <label className={computeFormFieldClasses()}>
        <span className={computeFormFieldLabelClasses()}>{field.label}</span>
        {children}
      </label>
    )
  }
  return (
    <div className={computeFormFieldClasses()}>
      <div className="flex items-center">
        <label
          htmlFor={authFieldControlId(field)}
          className={computeFormFieldLabelClasses()}
        >
          {field.label}
        </label>
        <a
          href={field.recovery.href}
          className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
        >
          {field.recovery.text}
        </a>
      </div>
      {children}
    </div>
  )
}
