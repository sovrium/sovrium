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
 * The drawer's type (`data-component-type="drawer"`) is named once, on the
 * island host the server renders, closed and open alike. The surfaces here are
 * portaled out of that host and carry no name of their own — naming them too
 * would name the drawer twice. What the host carries instead, while a surface
 * is open, is `aria-controls` pointing at it ({@link useHostControls}), so the
 * open panel is found from the element that names the drawer.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  computeDialogCloseClasses,
  computeSheetOverlayClasses,
} from '@/presentation/design/dialog-default-classes'
import { OverlayCloseGlyph } from '@/presentation/design/overlay-close-glyph'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { useHostControls } from './dialog-open-state'
import { useOverlayPending } from './overlay-pending'
import { SheetHeader } from './record-drawer-sheet-header'
import {
  computeSheetClosePositionClasses,
  computeSheetContentClasses,
} from './sheet-default-classes'
import type { SheetHeaderParts } from './record-drawer-navigation-slot'
import type { ReactElement } from 'react'

/** shadcn's `sheet-content` on its right side, at the record drawer's 32rem. */
const POPUP_CLASS = `${computeSheetContentClasses()} w-[32rem] max-w-full overflow-auto`
const PANEL_CLASS = 'flex h-full flex-col gap-4 p-4'
const CLOSE_CLASS = `${computeDialogCloseClasses()} ${computeSheetClosePositionClasses()}`

/** The surface's classes, with the author's `props.className` appended. */
const popupClass = (className: string | undefined): string =>
  resolveClasses(POPUP_CLASS, undefined, className)

/**
 * CAP-2 `region` surface — a named landmark `region` rather than a modal
 * `dialog`. Non-modal (no backdrop/focus-trap), portaled to <body> so it
 * escapes the hidden island host (display:none) exactly as `Dialog.Portal` does
 * for the dialog surface. Its accessible NAME comes from `props.title`.
 */
export function RegionSurface({
  title,
  header,
  body,
  closeLabel,
  open,
  onClose,
  className,
}: {
  readonly title: string
  readonly header?: SheetHeaderParts | undefined
  readonly body: ReactElement
  /** Interpreter string (SSR-resolved): the icon button's whole accessible name. */
  readonly closeLabel: string
  /** Closed, the landmark is not drawn. */
  readonly open: boolean
  readonly onClose: () => void
  readonly className?: string | undefined
}): ReactElement {
  const { id, anchor } = useHostControls(open, undefined)
  if (!open) return anchor
  const panel = createPortal(
    <section
      id={id}
      role="region"
      aria-label={title}
      data-slot="sheet-content"
      data-side="right"
      className={popupClass(className)}
    >
      <div className={PANEL_CLASS}>
        <SheetHeader
          title={title}
          header={header}
          modal={false}
        />
        {body}
        <button
          type="button"
          data-component-type="button"
          data-slot="sheet-close"
          aria-label={closeLabel}
          onClick={onClose}
          className={CLOSE_CLASS}
        >
          <OverlayCloseGlyph />
        </button>
      </div>
    </section>,
    document.body
  )
  return (
    <>
      {anchor}
      {panel}
    </>
  )
}

/** The modal sheet's inside: its title, the record body, and its close button. */
function DialogSheetPanel({
  title,
  header,
  body,
  closeLabel,
}: {
  readonly title: string
  readonly header: SheetHeaderParts | undefined
  readonly body: ReactElement
  readonly closeLabel: string
}): ReactElement {
  return (
    <div className={PANEL_CLASS}>
      <SheetHeader
        title={title}
        header={header}
        modal
      />
      {body}
      <Dialog.Close
        data-component-type="button"
        data-overlay-close=""
        data-slot="sheet-close"
        aria-label={closeLabel}
        className={CLOSE_CLASS}
      >
        <OverlayCloseGlyph />
      </Dialog.Close>
    </div>
  )
}

/** The default modal `dialog` surface (the historical record-drawer behavior). */
export function DialogSurface({
  title,
  header,
  body,
  closeLabel,
  open,
  onOpenChange,
  className,
}: {
  readonly title: string
  readonly header?: SheetHeaderParts | undefined
  readonly body: ReactElement
  /** Interpreter string (SSR-resolved): the icon button's whole accessible name. */
  readonly closeLabel: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly className?: string | undefined
}): ReactElement {
  const { id, anchor } = useHostControls(open, undefined)
  // A save in flight holds the reader's dismissals; a control inside may close it (overlay-pending.ts).
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const pending = useOverlayPending(onOpenChange, close)
  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={pending.onOpenChange}
    >
      {anchor}
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="sheet-overlay"
          className={computeSheetOverlayClasses()}
        />
        <Dialog.Popup
          ref={pending.panelRef}
          id={id}
          data-slot="sheet-content"
          data-side="right"
          className={popupClass(className)}
          aria-label={title}
        >
          <DialogSheetPanel
            title={title}
            header={header}
            body={body}
            closeLabel={closeLabel}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
