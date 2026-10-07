/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'

/**
 * The actions row of a form a dialog hosts: Cancel, then the submit, on one
 * line at the row's end. Cancel is `type="button"` so it never posts the form;
 * it carries `data-dialog-cancel`, which the dialog island closes on.
 */
export function FormDialogActions({
  cancelLabel,
  submitLabel,
}: {
  readonly cancelLabel: string
  readonly submitLabel: string
}) {
  return (
    <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        data-component-type="button"
        data-dialog-cancel=""
        className={computeButtonDefaultClasses({ variant: 'secondary' })}
      >
        {cancelLabel}
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
