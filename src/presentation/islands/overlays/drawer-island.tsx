/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subscribe as subscribeIslandEvent } from '@/presentation/islands/_shared/event-bus'
import { cn } from '@/presentation/islands/lib/cn'
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
  readonly defaultOpen?: boolean
}

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

function populateFormFromRecord(container: HTMLElement, record: Record<string, unknown>): void {
  const recordId = record['id']
  if (recordId !== undefined && recordId !== null) {
    const form = container.querySelector(
      'form[data-action-method="update"]'
    ) as HTMLFormElement | null
    if (form) {
      form.setAttribute('data-action-record-id', String(recordId))
      const currentAction = form.getAttribute('action')
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
      el.value = ''
    } else {
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

const SIZE_CLASSES = {
  sm: { horizontal: 'w-64', vertical: 'h-48' },
  md: { horizontal: 'w-80', vertical: 'h-64' },
  lg: { horizontal: 'w-96', vertical: 'h-80' },
  full: { horizontal: 'w-full', vertical: 'h-full' },
} as const

const SIZE_INLINE_STYLES: Record<keyof typeof SIZE_CLASSES, { width?: string; height?: string }> = {
  sm: {},
  md: {},
  lg: { width: '32rem', height: '24rem' },
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
        <Dialog.Title className="text-foreground text-lg font-semibold">{title}</Dialog.Title>
      )}
      {description && (
        <Dialog.Description className="text-foreground-muted mt-1 text-sm">
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

function useDrawerController(id: string | undefined, defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen)
  const dispatchedRecordRef = useRef<Record<string, unknown> | null>(null)
  const closeOnCrudSuccess = !defaultOpen
  useExternalOpenTrigger(id, setOpen, dispatchedRecordRef, closeOnCrudSuccess)
  const handleBodyMount = useCallback((container: HTMLElement) => {
    const record = dispatchedRecordRef.current
    if (record) populateFormFromRecord(container, record)
  }, [])
  return { open, setOpen, handleBodyMount }
}

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
          className={cn(
            computeDrawerPopupClasses({ side: drawerSide }),
            SIDE_CLASSES[drawerSide],
            sizeClass,
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
