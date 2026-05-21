/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useState } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
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
    variant === 'destructive'
      ? 'bg-error-solid text-error-solid-fg hover:opacity-90'
      : 'bg-primary text-primary-fg hover:bg-primary-hover'

  return (
    <div className="flex justify-end gap-3">
      {isAlertDialog && (
        <Dialog.Close className="border-border bg-bg text-fg hover:bg-bg-subtle rounded-md border px-4 py-2 text-sm font-medium transition-colors">
          {cancelLabel}
        </Dialog.Close>
      )}

      {confirmLabel ? (
        <Dialog.Close
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${confirmColorClass}`}
        >
          {confirmLabel}
        </Dialog.Close>
      ) : (
        <Dialog.Close className="text-fg-subtle hover:text-fg-muted absolute top-4 right-4 transition-colors">
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
        <Dialog.Backdrop className="bg-scrim/50 fixed inset-0 z-40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />

        <Dialog.Popup
          className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', className)}
          id={id}
          data-testid={testId}
        >
          <div className="bg-bg-overlay text-fg relative w-full max-w-md rounded-lg p-6 shadow-xl transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {title && (
              <Dialog.Title className="text-fg mb-2 text-lg font-semibold">{title}</Dialog.Title>
            )}

            {description && (
              <Dialog.Description className="text-fg-muted mb-4 text-sm">
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
