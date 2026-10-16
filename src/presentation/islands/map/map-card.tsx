/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A pin's card: the record's name, and Open when the map says what opening
 * does. A small dialog inside the map frame, focused when it opens and closed
 * with Escape, so a keyboard reader arriving from the twin lands in it and
 * goes back to where she was.
 */

import { useEffect, useRef, type ReactElement } from 'react'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { computePopoverContentClasses } from '../overlays/popover-default-classes'
import type { MapItem } from './map-types'

/** The card's actions: base-nova's outline `sm` button. */
const BUTTON = computePartButtonClasses({ variant: 'outline', size: 'sm' })

/** The pin card: the popover surface, held in the frame's corner. */
const CARD = `absolute top-3 right-3 ${computePopoverContentClasses()}`

export function MapCard({
  item,
  canOpen,
  onOpen,
  onClose,
  words,
}: {
  readonly item: MapItem
  readonly canOpen: boolean
  readonly onOpen: () => void
  readonly onClose: () => void
  readonly words?: Readonly<Record<string, string>> | undefined
}): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => ref.current?.querySelector<HTMLElement>('button')?.focus(), [item.id])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={item.label}
      data-slot="popover-content"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
      className={CARD}
    >
      <p
        data-slot="popover-title"
        className="font-medium"
      >
        {item.label}
      </p>
      <div className="flex gap-2">
        {canOpen && (
          <button
            type="button"
            data-slot="button"
            data-variant="outline"
            className={BUTTON}
            onClick={onOpen}
          >
            {words?.['map.open'] ?? 'Open'}
          </button>
        )}
        <button
          type="button"
          data-slot="button"
          data-variant="outline"
          className={BUTTON}
          onClick={onClose}
        >
          {words?.['map.close'] ?? 'Close'}
        </button>
      </div>
    </div>
  )
}
