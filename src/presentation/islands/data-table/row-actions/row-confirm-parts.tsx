/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
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

/** The `alert-dialog-footer` band: Cancel, then the action, locked until typed. */
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
        className={computePartButtonClasses({ variant: 'destructive' })}
        onClick={onConfirm}
      >
        {copy.confirmLabel}
      </button>
    </div>
  )
}
