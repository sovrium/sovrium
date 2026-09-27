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
 *
 * An OPEN surface is the element that names the component's type
 * (`data-component-type="drawer"`), so the element found by its type is the
 * one holding the opened record; the island names it while closed (see
 * `ClosedDrawerName`). The host cannot carry the name — the surface is portaled
 * out of it — and naming both would name the drawer twice.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useState } from 'react'
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
  open,
  onClose,
}: {
  readonly title: string
  readonly body: ReactElement
  /** Interpreter string (SSR-resolved): the icon button's whole accessible name. */
  readonly closeLabel: string
  /** Closed, the landmark is not drawn; only the drawer's name stays. */
  readonly open: boolean
  readonly onClose: () => void
}): ReactElement {
  if (!open) return <ClosedDrawerName />
  return createPortal(
    <section
      role="region"
      aria-label={title}
      className={POPUP_CLASS}
      data-component-type="drawer"
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
  // The popup stays mounted through its exit transition, still carrying the
  // name — so the closed marker waits until the close has COMPLETED, or the
  // drawer would be named twice for the length of the animation.
  const [settledClosed, setSettledClosed] = useState(!open)
  const onOpenChangeComplete = useCallback((isOpen: boolean) => setSettledClosed(!isOpen), [])
  return (
    <>
      {!open && settledClosed && <ClosedDrawerName />}
      <Dialog.Root
        modal
        open={open}
        onOpenChange={onOpenChange}
        onOpenChangeComplete={onOpenChangeComplete}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={computeOverlayBackdropClasses()} />
          <Dialog.Popup
            className={POPUP_CLASS}
            aria-label={title}
            data-component-type="drawer"
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
    </>
  )
}

/**
 * The drawer's name while it is CLOSED: an empty, hidden element inside the
 * island host carrying `data-component-type="drawer"`, so a closed drawer is
 * found by its type exactly once. It is not rendered while the drawer is open,
 * when the surface itself carries the name.
 */
function ClosedDrawerName(): ReactElement {
  return (
    <span
      hidden
      data-component-type="drawer"
    />
  )
}
