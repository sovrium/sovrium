/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useRef } from 'react'
import { waitForDropToSettle } from './wait-for-drop-to-settle'
import type { DropTargetRef } from './settled-drop-target'
import type { CancelDrop, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core'

export interface SettledDrop {
  /** Handed to `<SettledDropTarget>`, which publishes dnd-kit's target into it. */
  readonly overIdRef: DropTargetRef
  /** `undefined` when the board does not settle — dnd-kit then drops at once. */
  readonly cancelDrop: CancelDrop | undefined
  readonly handleDragEnd: (event: DragEndEvent) => void
}

/**
 * Wire the drop path so the target a drop applies is the one that has SETTLED.
 *
 * `settle` is the whole switch, and it is armed for the TWO-AXIS board only.
 * The race it answers is not exclusive to swimlanes — a single-axis board can
 * outrun dnd-kit's drop resolution too, and the symptom there is a card that
 * springs back to the column it came from. But that board has shipped, its
 * specs are green, and one of them reads the DOM the
 * instant `dragTo` returns, so adding two frames to its drop path would break a
 * passing test to fix a failure nobody has reported. Widening this is a
 * deliberate change with its own spec, not a side-effect of adding a lane axis.
 *
 * `cancelDrop` is dnd-kit's only AWAITED hook on the drop path. It exists to
 * let a board veto a drop, and returning `false` vetoes nothing — the wait is
 * the whole point, and it is what buys the collision chain its frames before
 * the target is read. See `settled-drop-target.tsx` for what that chain is.
 */
export function useSettledDrop(
  settle: boolean,
  onDragEnd: (event: DragEndEvent, overId: UniqueIdentifier | undefined) => void
): SettledDrop {
  const overIdRef = useRef<UniqueIdentifier | undefined>(undefined)

  const cancelDrop = useCallback<CancelDrop>(async () => {
    await waitForDropToSettle()
    return false
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => onDragEnd(event, settle ? overIdRef.current : event.over?.id),
    [onDragEnd, settle]
  )

  return { overIdRef, cancelDrop: settle ? cancelDrop : undefined, handleDragEnd }
}
