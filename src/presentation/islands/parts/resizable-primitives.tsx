/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui resizable (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The resizable panel group shadcn's `resizable` is: react-resizable-panels'
 * `Group`, `Panel` and `Separator` (version 4's names) with base-nova's
 * classes ([internal ref] D3). The only departure is the class join: no `cn`, so a
 * `className` adds to the slot's classes.
 */

import { Group, Panel, Separator } from 'react-resizable-panels'
import type { ComponentProps, ReactElement } from 'react'

const join = (...classes: ReadonlyArray<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ')

const HANDLE = [
  'relative flex w-px items-center justify-center bg-border ring-offset-background',
  'after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
  'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden',
  'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full',
  'aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1',
  'aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0',
  'aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
].join(' ')

/** The group: lays its panels out along `orientation` and owns the drag. */
export function ResizablePanelGroup({
  className,
  ...props
}: ComponentProps<typeof Group>): ReactElement {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={join('flex h-full w-full aria-[orientation=vertical]:flex-col', className)}
      {...props}
    />
  )
}

/** One panel, sized by the group within its `minSize` / `maxSize`. */
export function ResizablePanel(props: ComponentProps<typeof Panel>): ReactElement {
  return (
    <Panel
      data-slot="resizable-panel"
      {...props}
    />
  )
}

/** The handle between two panels: a `separator` that drags and takes the arrow keys. */
export function ResizableHandle({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof Separator> & { readonly withHandle?: boolean }): ReactElement {
  return (
    <Separator
      data-slot="resizable-handle"
      className={join(HANDLE, className)}
      {...props}
    >
      {withHandle === true && <div className="bg-border z-10 flex h-6 w-1 shrink-0 rounded-lg" />}
    </Separator>
  )
}
