/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, type ReactNode } from 'react'
import { fieldDescriptionId } from '@/presentation/utils/field-display'
import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
} from '../recipes/forms-default-classes'

/**
 * Minimal shape needed by CrudFieldShell. Re-declared here to avoid a circular
 * import with `crud-form-skeleton.tsx`, which re-exports the larger
 * `SkeletonFieldDef` and depends on this module for shared structure.
 */
type CrudFieldShellField = {
  readonly name: string
  readonly displayLabel?: string
  readonly required?: boolean
  /** Persistent guidance under the control; the control links to it by id. */
  readonly description?: string
}

const HELP_TEXT_CLASS = `help-text ${computeFormHelpTextClasses()}`

function labelText(field: CrudFieldShellField): string {
  return field.displayLabel ?? field.name
}

/**
 * Shared field shell for CRUD form skeletons (`crud-form-skeleton.tsx`).
 *
 * Emits the `<label>` wrapper with field-structure chrome (flex-column gap,
 * label-text typography, required-asterisk) so every CRUD skeleton field type
 * (`stringField`, `numberField`, `booleanField`, `richTextField`, etc.)
 * produces the same polished default without per-field duplication. Author
 * classNames on inner controls still cascade because the inner content is
 * rendered as-is via `children`.
 *
 * Any label-level data-* attribute (e.g. `data-rich-text-field`) passes
 * through via the rest-spread.
 *
 * SCOPE: This shell is intentionally CRUD-only. The form-runtime renderers
 * (`form-field-elements.tsx`, used by user-defined `form` components) and the
 * auth-form renderer (`auth-form-renderer.tsx`) render their own `<label>`
 * inline — the CRUD skeleton is the only place that NEEDS a stable shell shape
 * (because the input element type is dispatched per field type). The other
 * sites have bespoke chrome and are not migration candidates.
 */
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
      {field.description !== undefined && (
        <small
          id={fieldDescriptionId(field.name)}
          className={HELP_TEXT_CLASS}
        >
          {field.description}
        </small>
      )}
    </label>
  )
}
