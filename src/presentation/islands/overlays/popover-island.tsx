/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Popover } from '@base-ui/react/popover'
import { useLiveInjectedMarkup } from './live-injected-markup'
import {
  computePopoverDescriptionClasses,
  computePopoverPopupClasses,
  computePopoverTitleClasses,
} from './overlay-default-classes'
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
  return (
    <Popover.Root>
      <Popover.Trigger
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
          sideOffset={8}
        >
          <Popover.Popup className={computePopoverPopupClasses()}>
            {title && (
              <Popover.Title className={computePopoverTitleClasses()}>{title}</Popover.Title>
            )}
            {description && (
              <Popover.Description className={computePopoverDescriptionClasses()}>
                {description}
              </Popover.Description>
            )}
            {childrenHtml && <PopoverChildren html={childrenHtml} />}
            <Popover.Arrow className="text-background-overlay">
              <svg
                width="12"
                height="6"
                viewBox="0 0 12 6"
                fill="currentColor"
              >
                <path d="M0 6L6 0L12 6" />
              </svg>
            </Popover.Arrow>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
