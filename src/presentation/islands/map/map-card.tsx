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
import type { MapItem } from './map-types'

const BUTTON =
  'inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted'

export function MapCard({
  item,
  canOpen,
  onOpen,
  onClose,
}: {
  readonly item: MapItem
  readonly canOpen: boolean
  readonly onOpen: () => void
  readonly onClose: () => void
}): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus()
  }, [item.id])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={item.label}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
      className="bg-background border-border absolute top-3 right-3 z-10 flex w-64 flex-col gap-3 rounded-md border p-3 shadow-md"
    >
      <p className="text-sm font-medium">{item.label}</p>
      <div className="flex gap-2">
        {canOpen && (
          <button
            type="button"
            className={BUTTON}
            onClick={onOpen}
          >
            Open
          </button>
        )}
        <button
          type="button"
          className={BUTTON}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
