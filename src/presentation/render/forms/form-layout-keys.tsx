/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page form's layout keys on a hosted form's flat body: `labelPlacement:
 * side` puts each label beside its control, and `stickyActions` pins the
 * submit to the bottom of the view with the count of changed fields.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormSaveBarClasses } from '@/presentation/design/form-layout-classes'
import { FormDialogActions } from './form-dialog-actions'
import type { Form } from '@/domain/models/app/forms'
import type { ReactElement } from 'react'

/** The two keys, as a hosted form declares them. */
export type FormLayoutKeys = Pick<Form, 'labelPlacement' | 'stickyActions'>

/**
 * The `stickyActions` bar, as the server draws it: the count of changed fields,
 * Discard, and the form's own submit. The inline runtime counts the changes,
 * puts them back on Discard and asks before the page is left with changes
 * unsaved (`form-runtime-save-bar.ts`); without it the bar still keeps the
 * submit in view.
 */
function FormSaveBar({ submitLabel }: { readonly submitLabel: string }): ReactElement {
  return (
    <div
      data-form-save-bar=""
      className={computeFormSaveBarClasses()}
    >
      <span
        role="status"
        data-form-changes=""
        className="text-foreground-muted mr-auto font-mono text-sm"
      >
        No unsaved changes
      </span>
      <button
        type="button"
        data-form-discard=""
        disabled
        className={computeButtonDefaultClasses({ variant: 'secondary' })}
      >
        Discard
      </button>
      <button
        type="submit"
        data-component-type="button"
        className={computeButtonDefaultClasses()}
      >
        {submitLabel}
      </button>
    </div>
  )
}

/**
 * The flat body's actions: Cancel beside the submit in a dialog, the sticky
 * bar when the form asks for one, otherwise the submit alone.
 */
export function FlatFormActions({
  layoutKeys,
  submitLabel,
  submitAlign,
  cancelLabel,
}: {
  readonly layoutKeys: FormLayoutKeys | undefined
  readonly submitLabel: string
  readonly submitAlign: string
  readonly cancelLabel: string | undefined
}): ReactElement {
  if (cancelLabel !== undefined)
    return (
      <FormDialogActions
        cancelLabel={cancelLabel}
        submitLabel={submitLabel}
      />
    )
  if (layoutKeys?.stickyActions === true) return <FormSaveBar submitLabel={submitLabel} />
  return (
    <button
      type="submit"
      data-component-type="button"
      className={`${computeButtonDefaultClasses()} mt-2 w-full sm:w-auto ${submitAlign}`}
    >
      {submitLabel}
    </button>
  )
}
