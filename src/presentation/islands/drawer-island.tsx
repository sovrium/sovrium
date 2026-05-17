/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useState } from 'react'
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

function DrawerHeader({
  title,
  description,
}: {
  readonly title?: string
  readonly description?: string
}): ReactElement | undefined {
  if (!title && !description) return undefined
  return (
    <div className="border-b border-gray-200 p-4">
      {title && (
        <Dialog.Title className="text-lg font-semibold text-gray-900">{title}</Dialog.Title>
      )}
      {description && (
        <Dialog.Description className="mt-1 text-sm text-gray-600">
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
  'data-testid': testId,
}: DrawerIslandProps): ReactElement {
  const [open, setOpen] = useState(true)
  const sizeClass = getSizeClass(drawerSide, drawerSize)

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={setOpen}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={`fixed z-50 bg-white shadow-xl transition-transform duration-300 ${SIDE_CLASSES[drawerSide]} ${sizeClass} ${className ?? ''}`}
          id={id}
          data-testid={testId}
        >
          <div className="flex h-full flex-col">
            <DrawerHeader
              title={title}
              description={description}
            />
            <div className="flex-1 overflow-auto p-4">
              {childrenHtml && (
                // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves SSR skeleton HTML on initial paint; drawer re-render cost dominated by open/close
                <div dangerouslySetInnerHTML={{ __html: childrenHtml }} />
              )}
            </div>
            <Dialog.Close className="absolute top-4 right-4 text-gray-400 transition-colors hover:text-gray-600">
              ✕
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
