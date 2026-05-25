/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
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
}

function useExternalOpenTrigger(id: string | undefined, setOpen: (open: boolean) => void): void {
  useEffect(() => {
    if (!id) return
    const handler = (event: Event): void => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest(`[data-click-modal="${id}"]`)
      if (trigger) setOpen(true)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [id, setOpen])
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
    <div className="border-border border-b p-4">
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
}

function DrawerPopupBody({ title, description, childrenHtml }: DrawerPopupBodyProps): ReactElement {
  return (
    <div className="flex h-full flex-col">
      <DrawerHeader
        title={title}
        description={description}
      />
      <div className="flex-1 overflow-auto p-4">
        {childrenHtml && (
          <div dangerouslySetInnerHTML={{ __html: childrenHtml }} />
        )}
      </div>
      <Dialog.Close className="text-foreground-subtle hover:text-foreground-muted absolute top-4 right-4 transition-colors">
        ✕
      </Dialog.Close>
    </div>
  )
}

export default function DrawerIsland({
  title,
  description,
  drawerSide = 'right',
  drawerSize = 'md',
  childrenHtml,
  className,
  id,
  'data-testid': testId,
}: DrawerIslandProps): ReactElement {
  const [open, setOpen] = useState(true)
  const sizeClass = getSizeClass(drawerSide, drawerSize)
  const sizeInlineStyle = useMemo(
    () => getSizeInlineStyle(drawerSide, drawerSize),
    [drawerSide, drawerSize]
  )
  useExternalOpenTrigger(id, setOpen)

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={setOpen}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-scrim/50 fixed inset-0 z-40 transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            `bg-background-overlay text-foreground fixed z-50 shadow-xl transition-transform duration-300 ${SIDE_CLASSES[drawerSide]} ${sizeClass}`,
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
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
