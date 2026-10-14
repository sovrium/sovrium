/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Popover } from '@base-ui/react/popover'
import { useCallback, useState } from 'react'
import { useLiveInjectedMarkup } from './live-injected-markup'
import { useOverlayPending } from './overlay-pending'
import {
  computeFloatingPositionerClasses,
  computePopoverContentClasses,
  computePopoverDescriptionClasses,
  computePopoverHeaderClasses,
  computePopoverTitleClasses,
} from './popover-default-classes'
import type { ReactElement } from 'react'

interface PopoverIslandProps {
  readonly title?: string
  readonly description?: string
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly triggerHtml?: string
  readonly triggerLabel?: string
  readonly triggerId?: string
  readonly childrenHtml?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/** SSR HTML placeholder rendered once during hydration. Isolated so the inline
 * `dangerouslySetInnerHTML` object lives in a tiny helper, not the island body. */
function SSRSkeletonSpan({ html }: { readonly html: string }): ReactElement {
  // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only first-paint skeleton
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * The popup body, brought to life: injected when the popover opens, its scripts
 * run and its island markers mounted — so a form placed in a popover submits
 * through its action — and unmounted when it closes.
 *
 * SECURITY: `html` is server-rendered from the app's configuration, not user
 * input.
 */
function PopoverChildren({ html }: { readonly html: string }): ReactElement {
  const ref = useLiveInjectedMarkup(html)
  return <div ref={ref} />
}

/** The `popover-header` slot, omitted when the author declared neither line. */
function PopoverHeading({
  title,
  description,
}: {
  readonly title?: string
  readonly description?: string
}): ReactElement | undefined {
  if (!title && !description) return undefined
  return (
    <div
      data-slot="popover-header"
      className={computePopoverHeaderClasses()}
    >
      {title && (
        <Popover.Title
          data-slot="popover-title"
          className={computePopoverTitleClasses()}
        >
          {title}
        </Popover.Title>
      )}
      {description && (
        <Popover.Description
          data-slot="popover-description"
          className={computePopoverDescriptionClasses()}
        >
          {description}
        </Popover.Description>
      )}
    </div>
  )
}

/**
 * Popover island — wraps Base UI Popover for floating content panels.
 *
 * Shows rich content in a floating panel triggered by click.
 * Supports positioning, close-on-outside-click, and focus management.
 */
export default function PopoverIsland({
  title,
  description,
  floatingSide = 'bottom',
  floatingAlign = 'center',
  triggerHtml,
  triggerLabel,
  triggerId,
  childrenHtml,
  className,
  id,
  'data-testid': testId,
}: PopoverIslandProps): ReactElement {
  // Controlled, so a pending control inside holds a press outside, and a control
  // inside can ask it to close (overlay-pending.ts).
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { panelRef, onOpenChange } = useOverlayPending(setOpen, close)
  return (
    <Popover.Root
      open={open}
      onOpenChange={onOpenChange}
    >
      <Popover.Trigger
        data-slot="popover-trigger"
        className={className}
        id={triggerId ?? id}
        data-testid={testId}
      >
        {triggerHtml ? (
          <SSRSkeletonSpan html={triggerHtml} />
        ) : (
          <span>{triggerLabel ?? 'Open'}</span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side={floatingSide}
          align={floatingAlign}
          sideOffset={4}
          className={computeFloatingPositionerClasses()}
        >
          <Popover.Popup
            ref={panelRef}
            data-slot="popover-content"
            className={computePopoverContentClasses()}
          >
            <PopoverHeading
              title={title}
              description={description}
            />
            {childrenHtml && <PopoverChildren html={childrenHtml} />}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
