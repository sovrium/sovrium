/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * record-drawer surface chrome ([internal ref] CAP-2).
 *
 * The two surface wrappers a `record-drawer` opens into — the historical modal
 * `dialog` and the named landmark `region`. Both wrap the SAME record body
 * (`DrawerContent`, built by the island) with a title + close; only the
 * accessible role and the modal/non-modal chrome differ:
 *
 *  - `DialogSurface` — the default. A Base UI modal dialog (backdrop + focus
 *    trap).
 *  - `RegionSurface` — a non-modal `region` landmark, portaled to <body> so it
 *    escapes the hidden island host (display:none) exactly as `Dialog.Portal`
 *    does. Its accessible NAME comes from the drawer's `props.title`.
 *
 * BOTH surfaces render the SAME `DrawerContent` body regardless of binding
 * (DB-table or system DETAIL endpoint): the island fetches the record — from the
 * table records API or the system detail endpoint — and threads it through the
 * one shared body, so the trio (CAP-1 actions / CAP-2 role+name / CAP-3 structured
 * fields) composes uniformly. A system source forces the body read-only (no
 * "Enregistrer", no PATCH) via the island's `canEdit: false`.
 */

import { Dialog } from '@base-ui/react/dialog'
import { createPortal } from 'react-dom'
import { computeDrawerPopupClasses, computeOverlayBackdropClasses } from './overlay-default-classes'
import type { ReactElement } from 'react'

const POPUP_CLASS = `${computeDrawerPopupClasses({ side: 'right' })} inset-y-0 right-0 w-[32rem] max-w-full overflow-auto p-6`
const PANEL_CLASS = 'flex h-full flex-col gap-4'
const TITLE_CLASS = 'text-foreground text-xl font-semibold'
const CLOSE_CLASS = 'text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4'

/**
 * CAP-2 `region` surface — a named landmark `region` rather than a modal
 * `dialog`. Non-modal (no backdrop/focus-trap), portaled to <body> so it
 * escapes the hidden island host (display:none) exactly as `Dialog.Portal` does
 * for the dialog surface. Its accessible NAME comes from `props.title`.
 */
export function RegionSurface({
  title,
  body,
  closeLabel,
  onClose,
}: {
  readonly title: string
  readonly body: ReactElement
  /** Interpreter string (SSR-resolved): the icon button's whole accessible name. */
  readonly closeLabel: string
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
          aria-label={closeLabel}
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

/** The default modal `dialog` surface (the historical record-drawer behavior). */
export function DialogSurface({
  title,
  body,
  closeLabel,
  open,
  onOpenChange,
}: {
  readonly title: string
  readonly body: ReactElement
  /** Interpreter string (SSR-resolved): the icon button's whole accessible name. */
  readonly closeLabel: string
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
              aria-label={closeLabel}
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
