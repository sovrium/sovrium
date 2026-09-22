/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { subscribe as subscribeIslandEvent } from '@/presentation/islands/runtime/event-bus'
import {
  computeDrawerHeaderClasses,
  computeDrawerPopupClasses,
  computeOverlayBackdropClasses,
} from './overlay-default-classes'
import type { ReactElement } from 'react'

interface DrawerIslandProps {
  readonly title?: string
  readonly description?: string
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

/**
 * Wires external open triggers for this drawer:
 *
 * 1. The legacy `data-click-modal="<id>"` click contract used by the existing
 *    `<button data-click-modal="...">` schema authoring path. The legacy
 *    openModal handler in `PageBodyScripts` only toggles `display` on the
 *    placeholder div, which has no effect on a hydrated Base UI portal —
 *    so the island owns the trigger wiring for itself.
 *
 * 2. The `sovrium:open-drawer` CustomEvent dispatched by the data-table
 *    island when a row click resolves to an `action: 'openDrawer'` action
 *    (PG-04 quick-edit drawer pattern). The event's `detail.id` matches the
 *    drawer component id, and `detail.record` carries the clicked row's
 *    record so the drawer's child form can be populated client-side. The
 *    record is stored in a ref so the post-mount effect can find input
 *    elements matching each record key and set their value attribute.
 *
 * 3. The `sovrium:crud-success` CustomEvent dispatched by the embedded
 *    crud-form's `submitCrudForm` after a successful update / create
 *. This closes the drawer so the user
 *    returns to the underlying data-table view with the updated row.
 */
function useExternalOpenTrigger(
  id: string | undefined,
  setOpen: (open: boolean) => void,
  recordRef: { current: Record<string, unknown> | null },
  closeOnCrudSuccess: boolean
): void {
  useEffect(() => {
    if (!id) return
    const clickHandler = (event: Event): void => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest(`[data-click-modal="${id}"]`)
      if (trigger) setOpen(true)
    }
    document.addEventListener('click', clickHandler)
    const unsubscribeOpenDrawer = subscribeIslandEvent('sovrium:open-drawer', (detail) => {
      if (detail.id !== id) return
      // eslint-disable-next-line functional/immutable-data, no-param-reassign -- ref mutation is the documented React pattern for late-arriving data
      recordRef.current = detail.record
      setOpen(true)
    })
    const unsubscribeCrudSuccess = subscribeIslandEvent('sovrium:crud-success', () => {
      if (!closeOnCrudSuccess) return
      setOpen(false)
    })
    return () => {
      document.removeEventListener('click', clickHandler)
      unsubscribeOpenDrawer()
      unsubscribeCrudSuccess()
    }
  }, [id, setOpen, recordRef, closeOnCrudSuccess])
}

/**
 * After the drawer opens with a record dispatched via `sovrium:open-drawer`,
 * walk the form's named inputs and populate their `value` from the record.
 * Also stamps `data-action-record-id` on the parent `<form>` so the
 * `crud-form` island's update mutation has a target record id.
 *
 * Runs from the popup body's mount effect so the DOM nodes exist by the time
 * we query for them. Subsequent close/reopen cycles re-run on each open,
 * keeping the displayed values in sync with the most recently clicked row.
 */
function populateFormFromRecord(container: HTMLElement, record: Record<string, unknown>): void {
  const recordId = record['id']
  if (recordId !== undefined && recordId !== null) {
    const form = container.querySelector(
      'form[data-action-method="update"]'
    ) as HTMLFormElement | null
    if (form) {
      form.setAttribute('data-action-record-id', String(recordId))
      const currentAction = form.getAttribute('action')
      // PG-04: the SSR form action URL produced
      // by `buildUpdateFormAction` carries the empty-recordId fallback path
      // `/api/tables/<tbl>/records/update` (no double slash, no record id) —
      // because no record is resolved at SSR time for drawer-hosted forms.
      // Patch it in place so a native form POST (the path taken when the
      // crud-form island has been blown away by the drawer's
      // dangerouslySetInnerHTML re-mount) lands on the per-record endpoint.
      // We also keep handling the older double-slash shape just in case any
      // other SSR path still emits it.
      if (currentAction) {
        const patched = currentAction
          .replace('/records//update', `/records/${String(recordId)}/update`)
          .replace(/\/records\/update$/, `/records/${String(recordId)}/update`)
        if (patched !== currentAction) form.setAttribute('action', patched)
      }
    }
  }
  const inputs = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[name], textarea[name]'
  )
  inputs.forEach((el) => {
    const key = el.getAttribute('name')
    if (!key || !(key in record)) return
    const value = record[key]
    if (value === null || value === undefined) {
      // eslint-disable-next-line functional/immutable-data, no-param-reassign -- DOM mutation is the contract here
      el.value = ''
    } else {
      // eslint-disable-next-line functional/immutable-data, no-param-reassign -- DOM mutation is the contract here
      el.value = String(value)
    }
  })
}

const SIDE_CLASSES = {
  left: 'inset-y-0 left-0 data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full',
  right:
    'inset-y-0 right-0 data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full',
  top: 'inset-x-0 top-0 data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full',
  bottom:
    'inset-x-0 bottom-0 data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full',
} as const

/**
 * Standard Tailwind size classes for each drawer size. `lg` augments the class
 * with an inline-style fallback because Sovrium's runtime CSS compiler does not
 * emit arbitrary-value classes (e.g. `w-[32rem]`) — see `SIZE_INLINE_STYLES`.
 */
const SIZE_CLASSES = {
  sm: { horizontal: 'w-64', vertical: 'h-48' }, // 256px / 192px
  md: { horizontal: 'w-80', vertical: 'h-64' }, // 320px / 256px
  lg: { horizontal: 'w-96', vertical: 'h-80' }, // 384px / 320px (overridden via inline style to 512px)
  full: { horizontal: 'w-full', vertical: 'h-full' },
} as const

/**
 * Inline-style width/height overrides for sizes whose target value would
 * otherwise require an arbitrary-value Tailwind class that the runtime CSS
 * compiler does not always emit.
 */
const SIZE_INLINE_STYLES: Record<keyof typeof SIZE_CLASSES, { width?: string; height?: string }> = {
  sm: {},
  md: {},
  lg: { width: '32rem', height: '24rem' }, // 512px / 384px
  full: {},
} as const

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

function getSizeClass(
  drawerSide: 'left' | 'right' | 'top' | 'bottom',
  drawerSize: keyof typeof SIZE_CLASSES
): string {
  const isHorizontal = drawerSide === 'left' || drawerSide === 'right'
  return isHorizontal ? SIZE_CLASSES[drawerSize].horizontal : SIZE_CLASSES[drawerSize].vertical
}

/**
 * Returns inline-style width/height for sizes whose target Tailwind class
 * would otherwise need an arbitrary value the runtime CSS compiler skips.
 * Only the relevant axis (horizontal vs vertical) is set so the perpendicular
 * dimension still inherits from the side class (`inset-y-0`, `inset-x-0`).
 */
function getSizeInlineStyle(
  drawerSide: 'left' | 'right' | 'top' | 'bottom',
  drawerSize: keyof typeof SIZE_CLASSES
): React.CSSProperties {
  const override = SIZE_INLINE_STYLES[drawerSize]
  const isHorizontal = drawerSide === 'left' || drawerSide === 'right'
  if (isHorizontal && override.width) return { width: override.width }
  if (!isHorizontal && override.height) return { height: override.height }
  return {}
}

interface DrawerPopupBodyProps {
  readonly title?: string
  readonly description?: string
  readonly childrenHtml?: string
  readonly onMount?: (container: HTMLElement) => void
}

/**
 * Renders the contents of the drawer popup. Extracted so the parent
 * island stays under the `max-lines-per-function` ESLint cap.
 *
 * `onMount` fires once the inner content container mounts so the parent
 * island can populate form fields from a dispatched record (PG-04
 * quick-edit drawer).
 */
function DrawerPopupBody({
  title,
  description,
  childrenHtml,
  onMount,
}: DrawerPopupBodyProps): ReactElement {
  const contentRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (contentRef.current && onMount) onMount(contentRef.current)
  }, [onMount])
  return (
    <div className="flex h-full flex-col">
      <DrawerHeader
        title={title}
        description={description}
      />
      <div className="flex-1 overflow-auto p-4">
        {childrenHtml && (
          <div
            ref={contentRef}
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves SSR skeleton HTML on initial paint; drawer re-render cost dominated by open/close
            dangerouslySetInnerHTML={{ __html: childrenHtml }}
          />
        )}
      </div>
      <Dialog.Close className="text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4 transition-colors">
        ✕
      </Dialog.Close>
    </div>
  )
}

/**
 * Wire the drawer's open state, the dispatched-record ref, external open
 * triggers, and the popup-body mount handler. Extracted from `DrawerIsland`
 * to keep that component under the `max-lines-per-function` cap.
 */
function useDrawerController(id: string | undefined, defaultOpen: boolean) {
  // Default `open=true` matches the legacy hydration contract: a pre-hydration
  // `data-click-modal` click would otherwise be lost on a non-portal placeholder.
  // PG-04 quick-edit drawers (referenced by an openDrawer dispatch) opt out via
  // `defaultOpen={false}` so the drawer stays hidden until the dispatch fires.
  // `useExternalOpenTrigger` additionally re-opens after Escape/backdrop dismissal.
  const [open, setOpen] = useState(defaultOpen)
  // PG-04: when `sovrium:open-drawer` fires, the dispatched record is
  // captured in this ref so the popup-body mount effect can populate form
  // fields. The ref is updated *before* `setOpen(true)` triggers the
  // re-render, so the new popup body mounts with the record already in hand.
  const dispatchedRecordRef = useRef<Record<string, unknown> | null>(null)
  // PG-04: only quick-edit drawers (those
  // referenced by an `onRowClick.action === 'openDrawer'` dispatch, which
  // pass `defaultOpen={false}` to opt out of legacy auto-open) should close
  // themselves on `sovrium:crud-success`. Legacy `data-click-modal` drawers
  // (`defaultOpen={true}`) keep their own open lifecycle so a sibling form
  // mutation never closes them unexpectedly.
  const closeOnCrudSuccess = !defaultOpen
  useExternalOpenTrigger(id, setOpen, dispatchedRecordRef, closeOnCrudSuccess)
  const handleBodyMount = useCallback((container: HTMLElement) => {
    const record = dispatchedRecordRef.current
    if (record) populateFormFromRecord(container, record)
  }, [])
  return { open, setOpen, handleBodyMount }
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
  drawerSide = 'right',
  drawerSize = 'md',
  childrenHtml,
  className,
  id,
  defaultOpen = true,
  'data-testid': testId,
}: DrawerIslandProps): ReactElement {
  const { open, setOpen, handleBodyMount } = useDrawerController(id, defaultOpen)
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
            childrenHtml={childrenHtml}
            onMount={handleBodyMount}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
