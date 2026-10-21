/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { computeSheetOverlayClasses } from '@/presentation/design/dialog-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { computeSheetContentClasses } from '@/presentation/design/sheet-default-classes'
import { bindRecordToDrawerForms } from './drawer-record-binding'
import { getSizeClass, getSizeInlineStyle } from './drawer-size'
import { useOverlayPending } from './overlay-pending'
import { DrawerPopupBody } from './sheet-parts'
import { hasExternalTrigger, useExternalOpenTrigger } from './use-external-open-trigger'
import type { OpenDrawerDetail } from '@/presentation/islands/runtime/event-bus'
import type { ReactElement } from 'react'

interface DrawerIslandProps {
  readonly title?: string
  readonly description?: string
  /** The close button's name, in the page language (`dialog.close`). */
  readonly closeLabel?: string
  readonly drawerSide?: 'left' | 'right' | 'top' | 'bottom'
  readonly drawerSize?: 'sm' | 'md' | 'lg' | 'full'
  readonly childrenHtml?: string
  readonly footerHtml?: string
  readonly showCloseButton?: boolean
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /**
   * Initial open state. Defaults to `true` to preserve the legacy
   * pre-hydration trigger contract (any `data-click-modal="<id>"` click fired
   * before hydration would otherwise be lost). PG-04 quick-edit drawers
   * referenced by an `onRowClick.action === 'openSheet'` dispatch override
   * this to `false` — the drawer remains hidden until a row click fires the
   * `sovrium:open-drawer` custom event (see {@link useExternalOpenTrigger}).
   */
  readonly defaultOpen?: boolean
}

/**
 * Wire the drawer's open state, the dispatched-record ref, external open
 * triggers, and the popup-body injection handler. Extracted from `DrawerIsland`
 * to keep that component under the `max-lines-per-function` cap.
 */
function useDrawerController(id: string | undefined, defaultOpen: boolean) {
  // Default `open=true` matches the legacy hydration contract: a pre-hydration
  // `data-click-modal` click would otherwise be lost on a non-portal placeholder.
  // PG-04 quick-edit drawers (referenced by an openSheet dispatch) opt out via
  // `defaultOpen={false}` so the drawer stays hidden until the dispatch fires.
  // `useExternalOpenTrigger` additionally re-opens after Escape/backdrop dismissal.
  //
  // A drawer with a TRIGGER mounts closed whatever `defaultOpen` says: the
  // trigger is how it opens, and one that opened itself on hydration covered
  // the page it was meant to wait beside — the same rule the dialog island
  // follows (`computeInitialOpen`). A click that beat hydration is replayed by
  // `useExternalOpenTrigger`, which is what the open default was guarding.
  const [open, setOpen] = useState(() => defaultOpen && !hasExternalTrigger(id))
  // PG-04: when `sovrium:open-drawer` fires, the dispatched record is
  // captured in this ref so the popup-body injection step can populate form
  // fields. The ref is updated *before* `setOpen(true)` triggers the
  // re-render, so the new popup body mounts with the record already in hand.
  const dispatchedRecordRef = useRef<OpenDrawerDetail | null>(null)
  // PG-04: only quick-edit drawers (those
  // referenced by an `onRowClick.action === 'openSheet'` dispatch, which
  // pass `defaultOpen={false}` to opt out of legacy auto-open) should close
  // themselves on `sovrium:crud-success`. Legacy `data-click-modal` drawers
  // (`defaultOpen={true}`) keep their own open lifecycle so a sibling form
  // mutation never closes them unexpectedly.
  const closeOnCrudSuccess = !defaultOpen
  useExternalOpenTrigger(id, setOpen, dispatchedRecordRef, closeOnCrudSuccess)
  const handleBodyInjected = useCallback((container: HTMLElement) => {
    const opened = dispatchedRecordRef.current
    if (opened) bindRecordToDrawerForms(container, opened.record, opened.table)
  }, [])
  return { open, setOpen, handleBodyInjected }
}

/**
 * Drawer island — wraps Base UI Dialog as a slide-in panel.
 *
 * Provides a side panel with focus trapping, escape-to-close,
 * backdrop dismissal, and slide animations from any edge.
 */
export default function DrawerIsland({
  title,
  description,
  closeLabel = 'Close',
  drawerSide = 'right',
  drawerSize = 'md',
  childrenHtml,
  footerHtml,
  showCloseButton,
  className,
  id,
  defaultOpen = true,
  'data-testid': testId,
}: DrawerIslandProps): ReactElement {
  const { open, setOpen, handleBodyInjected } = useDrawerController(id, defaultOpen)
  // A pending control inside holds the reader's dismissals (overlay-pending.ts).
  const { panelRef, onOpenChange } = useOverlayPending(setOpen)
  const sizeClass = getSizeClass(drawerSide, drawerSize)
  // Memoize to avoid creating a new style object every render (react-perf rule).
  const sizeInlineStyle = useMemo(
    () => getSizeInlineStyle(drawerSide, drawerSize),
    [drawerSide, drawerSize]
  )

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="sheet-overlay"
          className={computeSheetOverlayClasses()}
        />
        <Dialog.Popup
          ref={panelRef}
          data-slot="sheet-content"
          data-side={drawerSide}
          className={resolveClasses(cn(computeSheetContentClasses(), sizeClass), className)}
          style={sizeInlineStyle}
          id={id}
          data-testid={testId}
        >
          <DrawerPopupBody
            title={title}
            description={description}
            closeLabel={closeLabel}
            childrenHtml={childrenHtml}
            footerHtml={footerHtml}
            showCloseButton={showCloseButton}
            onInjected={handleBodyInjected}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
