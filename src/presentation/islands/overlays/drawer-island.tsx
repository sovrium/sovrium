/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { bindRecordToDrawerForms } from './drawer-record-binding'
import { SIDE_CLASSES, getSizeClass, getSizeInlineStyle } from './drawer-size'
import { useLiveInjectedMarkup } from './live-injected-markup'
import {
  computeDrawerHeaderClasses,
  computeDrawerPopupClasses,
  computeOverlayBackdropClasses,
} from './overlay-default-classes'
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
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /**
   * Initial open state. Defaults to `true` to preserve the legacy
   * pre-hydration trigger contract (any `data-click-modal="<id>"` click fired
   * before hydration would otherwise be lost). PG-04 quick-edit drawers
   * referenced by an `onRowClick.action === 'openDrawer'` dispatch override
   * this to `false` — the drawer remains hidden until a row click fires the
   * `sovrium:open-drawer` custom event (see {@link useExternalOpenTrigger}).
   */
  readonly defaultOpen?: boolean
}

function DrawerHeader({
  title,
  description,
}: {
  readonly title?: string
  readonly description?: string
}): ReactElement | undefined {
  if (!title && !description) return undefined
  return (
    <div className={computeDrawerHeaderClasses()}>
      {title && (
        <Dialog.Title className="text-foreground text-xl font-semibold">{title}</Dialog.Title>
      )}
      {description && (
        <Dialog.Description className="text-foreground-muted text-md mt-1">
          {description}
        </Dialog.Description>
      )}
    </div>
  )
}

interface DrawerPopupBodyProps {
  readonly title?: string
  readonly description?: string
  readonly closeLabel: string
  readonly childrenHtml?: string
  readonly onInjected?: (container: HTMLElement) => void
}

/**
 * The drawer's body markup, brought to life: injected when the popup opens, its
 * scripts run and its island markers mounted — so a form placed in a drawer
 * submits through its action — and unmounted when the popup closes, so a
 * reopened drawer holds exactly one live copy.
 *
 * `onInjected` runs after injection and before the islands mount; the quick-
 * edit drawer binds the dispatched record to its form there.
 *
 * SECURITY: `html` is server-rendered from the app's configuration, not user
 * input.
 */
function DrawerChildren({
  html,
  onInjected,
}: {
  readonly html: string
  readonly onInjected?: (container: HTMLElement) => void
}): ReactElement {
  const ref = useLiveInjectedMarkup(html, onInjected)
  return <div ref={ref} />
}

/**
 * Renders the contents of the drawer popup. Extracted so the parent
 * island stays under the `max-lines-per-function` ESLint cap.
 */
function DrawerPopupBody({
  title,
  description,
  closeLabel,
  childrenHtml,
  onInjected,
}: DrawerPopupBodyProps): ReactElement {
  return (
    <div className="flex h-full flex-col">
      <DrawerHeader
        title={title}
        description={description}
      />
      <div className="flex-1 overflow-auto p-4">
        {childrenHtml && (
          <DrawerChildren
            html={childrenHtml}
            onInjected={onInjected}
          />
        )}
      </div>
      <Dialog.Close
        aria-label={closeLabel}
        className="text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4 transition-colors"
      >
        <span aria-hidden="true">✕</span>
      </Dialog.Close>
    </div>
  )
}

/**
 * Wire the drawer's open state, the dispatched-record ref, external open
 * triggers, and the popup-body injection handler. Extracted from `DrawerIsland`
 * to keep that component under the `max-lines-per-function` cap.
 */
function useDrawerController(id: string | undefined, defaultOpen: boolean) {
  // Default `open=true` matches the legacy hydration contract: a pre-hydration
  // `data-click-modal` click would otherwise be lost on a non-portal placeholder.
  // PG-04 quick-edit drawers (referenced by an openDrawer dispatch) opt out via
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
  // referenced by an `onRowClick.action === 'openDrawer'` dispatch, which
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
  className,
  id,
  defaultOpen = true,
  'data-testid': testId,
}: DrawerIslandProps): ReactElement {
  const { open, setOpen, handleBodyInjected } = useDrawerController(id, defaultOpen)
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
      onOpenChange={setOpen}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={computeOverlayBackdropClasses()} />
        <Dialog.Popup
          className={resolveClasses(
            cn(
              computeDrawerPopupClasses({ side: drawerSide }),
              SIDE_CLASSES[drawerSide],
              sizeClass
            ),
            className
          )}
          style={sizeInlineStyle}
          id={id}
          data-testid={testId}
        >
          <DrawerPopupBody
            title={title}
            description={description}
            closeLabel={closeLabel}
            childrenHtml={childrenHtml}
            onInjected={handleBodyInjected}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
