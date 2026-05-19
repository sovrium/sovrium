/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useState } from 'react'
import type { ReactElement } from 'react'

interface DialogIslandProps {
  readonly title?: string
  readonly description?: string
  readonly cancelLabel?: string
  readonly confirmLabel?: string
  readonly variant?: 'default' | 'destructive'
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly childrenHtml?: string
}

function DialogActions({
  isAlertDialog,
  cancelLabel,
  confirmLabel,
  variant,
}: {
  readonly isAlertDialog: boolean
  readonly cancelLabel: string
  readonly confirmLabel?: string
  readonly variant: 'default' | 'destructive'
}): ReactElement {
  const confirmColorClass =
    variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'

  return (
    <div className="flex justify-end gap-3">
      {isAlertDialog && (
        <Dialog.Close className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
          {cancelLabel}
        </Dialog.Close>
      )}

      {confirmLabel ? (
        <Dialog.Close
          className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${confirmColorClass}`}
        >
          {confirmLabel}
        </Dialog.Close>
      ) : (
        <Dialog.Close className="absolute top-4 right-4 text-gray-400 transition-colors hover:text-gray-600">
          <span
            className="sr-only"
            aria-hidden="true"
          >
            Close
          </span>
          ✕
        </Dialog.Close>
      )}
    </div>
  )
}

function SSRSkeletonDiv({
  html,
  className,
}: {
  readonly html: string
  readonly className?: string
}): ReactElement {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function DialogIsland({
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  variant = 'default',
  className,
  id,
  childrenHtml,
  'data-testid': testId,
}: DialogIslandProps): ReactElement {
  const isAlertDialog = variant === 'destructive' || confirmLabel !== undefined
  const [open, setOpen] = useState(true)

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={setOpen}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />

        <Dialog.Popup
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className ?? ''}`}
          id={id}
          data-testid={testId}
        >
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {title && (
              <Dialog.Title className="mb-2 text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
            )}

            {description && (
              <Dialog.Description className="mb-4 text-sm text-gray-600">
                {description}
              </Dialog.Description>
            )}

            {childrenHtml && (
              <SSRSkeletonDiv
                html={childrenHtml}
                className="mb-4"
              />
            )}

            <DialogActions
              isAlertDialog={isAlertDialog}
              cancelLabel={cancelLabel}
              confirmLabel={confirmLabel}
              variant={variant}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
