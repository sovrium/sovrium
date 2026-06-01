/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface DropdownStateOptions {
  readonly closeOnEscape?: boolean
}

export interface DropdownState {
  readonly open: boolean
  readonly rootRef: React.RefObject<HTMLDivElement | null>
  readonly onToggle: () => void
  readonly close: () => void
}

export function useDropdownState(options: DropdownStateOptions = {}): DropdownState {
  const { closeOnEscape = false } = options
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const onToggle = useCallback(() => setOpen((prev) => !prev), [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return undefined
    const onDocMouseDown = (event: MouseEvent) => {
      const { target } = event
      if (target instanceof Node && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const onKeyDown = closeOnEscape
      ? (event: KeyboardEvent) => {
          if (event.key === 'Escape') setOpen(false)
        }
      : undefined
    document.addEventListener('mousedown', onDocMouseDown)
    if (onKeyDown) document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      if (onKeyDown) document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, closeOnEscape])

  return { open, rootRef, onToggle, close }
}

export const DROPDOWN_TRIGGER_CLASS = 'hover:bg-background-subtle rounded border px-3 py-1 text-sm'
