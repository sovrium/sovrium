/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Dialog } from '@base-ui/react/dialog'
import { createPortal } from 'react-dom'
import { computeDrawerPopupClasses, computeOverlayBackdropClasses } from './overlay-default-classes'
import type { ReactElement } from 'react'

const POPUP_CLASS = `${computeDrawerPopupClasses({ side: 'right' })} inset-y-0 right-0 w-[32rem] max-w-full overflow-auto p-6`
const PANEL_CLASS = 'flex h-full flex-col gap-4'
const TITLE_CLASS = 'text-foreground text-lg font-semibold'
const CLOSE_CLASS = 'text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4'

export function RegionSurface({
  title,
  body,
  onClose,
}: {
  readonly title: string
  readonly body: ReactElement
  readonly onClose: () => void
}): ReactElement {
  return createPortal(
    <section
      role="region"
      aria-label={title}
      className={POPUP_CLASS}
    >
      <div className={PANEL_CLASS}>
        <h2 className={TITLE_CLASS}>{title}</h2>
        {body}
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className={CLOSE_CLASS}
        >
          ✕
        </button>
      </div>
    </section>,
    document.body
  )
}

export function DialogSurface({
  title,
  body,
  open,
  onOpenChange,
}: {
  readonly title: string
  readonly body: ReactElement
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}): ReactElement {
  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={computeOverlayBackdropClasses()} />
        <Dialog.Popup
          className={POPUP_CLASS}
          aria-label={title}
        >
          <div className={PANEL_CLASS}>
            <Dialog.Title className={TITLE_CLASS}>{title}</Dialog.Title>
            {body}
            <Dialog.Close
              aria-label="Fermer"
              className={CLOSE_CLASS}
            >
              ✕
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
