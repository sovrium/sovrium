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
} from '../recipes/forms-default-classes'

type CrudFieldShellField = {
  readonly name: string
  readonly displayLabel?: string
  readonly required?: boolean
}

function labelText(field: CrudFieldShellField): string {
  return field.displayLabel ?? field.name
}

type CrudFieldShellProps = {
  readonly field: CrudFieldShellField
  readonly children: ReactNode
} & Record<string, unknown>

export function CrudFieldShell({
  field,
  children,
  ...labelProps
}: CrudFieldShellProps): ReactElement {
  return (
    <label
      className={computeFormFieldClasses()}
      {...labelProps}
    >
      <span className={computeFormFieldLabelClasses()}>
        {labelText(field)}
        {field.required && (
          <span
            className="text-error-fg ml-0.5"
            aria-hidden="true"
          >
            *
          </span>
        )}
      </span>
      {children}
    </label>
  )
}
