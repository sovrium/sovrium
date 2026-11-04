/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { isDestructiveAction, isIrreversibleConfirm } from '@/presentation/design/confirm-weight'
import { solidifyDestructiveButtonClasses } from '@/presentation/design/destructive-solid-button-classes'
import {
  computeDialogDescriptionClasses,
  computeDialogFooterClasses,
  computeDialogHeaderClasses,
  computeDialogTitleClasses,
} from '@/presentation/design/dialog-default-classes'
import { actionTypeAttr } from './action-type-attr'
import type { GateCopy } from './row-confirm-copy'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

/** The type-to-confirm field an object-form gate may ask for. */
export function TypedConfirm({
  label,
  value,
  onChange,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (next: string) => void
}): ReactElement {
  return (
    <input
      type="text"
      aria-label={label}
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
    />
  )
}

/** The `alert-dialog-header` slot: the prompt as the title, and the message under it. */
export function GateHeader({ copy }: { readonly copy: GateCopy }): ReactElement {
  return (
    <div
      data-slot="alert-dialog-header"
      className={computeDialogHeaderClasses('alert-dialog')}
    >
      <Dialog.Title
        data-slot="alert-dialog-title"
        className={computeDialogTitleClasses('alert-dialog')}
      >
        {copy.title}
      </Dialog.Title>
      {copy.message && (
        <Dialog.Description
          data-slot="alert-dialog-description"
          className={computeDialogDescriptionClasses('alert-dialog')}
        >
          {copy.message}
        </Dialog.Description>
      )}
    </div>
  )
}

/**
 * The classes of the gate's affirming button, in the weight of the action it
 * confirms: the solid destructive fill when its `confirm` declares the action
 * `irreversible`, the destructive tint for any other destructive action
 * (`isDestructiveAction`), the default button otherwise.
 */
const affirmClasses = (action: ActionColumnItem): string =>
  isIrreversibleConfirm(action.confirm)
    ? solidifyDestructiveButtonClasses(computePartButtonClasses({ variant: 'destructive' }))
    : computePartButtonClasses({
        variant: isDestructiveAction(action.variant, action.action) ? 'destructive' : 'default',
      })

/**
 * The `alert-dialog-footer` band: Cancel, then the action, locked until typed,
 * in the weight of the action ({@link affirmClasses}).
 */
export function GateFooter({
  copy,
  action,
  locked,
  onConfirm,
}: {
  readonly copy: GateCopy
  readonly action: ActionColumnItem
  readonly locked: boolean
  readonly onConfirm: () => void
}): ReactElement {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={computeDialogFooterClasses('alert-dialog')}
    >
      <Dialog.Close
        data-component-type="button"
        data-slot="alert-dialog-cancel"
        aria-label={copy.cancelLabel}
        className={computePartButtonClasses({ variant: 'outline' })}
      >
        {copy.cancelLabel}
      </Dialog.Close>
      <button
        type="button"
        data-component-type="button"
        data-slot="alert-dialog-action"
        data-action-type={actionTypeAttr(action)}
        disabled={locked}
        className={affirmClasses(action)}
        onClick={onConfirm}
      >
        {copy.confirmLabel}
      </button>
    </div>
  )
}
