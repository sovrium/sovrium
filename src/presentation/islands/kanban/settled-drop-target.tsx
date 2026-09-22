/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useDndContext } from '@dnd-kit/core'
import { useLayoutEffect } from 'react'
import type { UniqueIdentifier } from '@dnd-kit/core'
import type { MutableRefObject } from 'react'

/** The mutable slot a settled drop target is published into. */
export type DropTargetRef = MutableRefObject<UniqueIdentifier | undefined>

/**
 * Records dnd-kit's current drop target into a ref, from INSIDE the context.
 *
 * ─── WHY THE DROP TARGET CANNOT BE READ OFF THE DRAG-END EVENT ─────────────
 *
 * `DragEndEvent.over` is not computed at drop time. dnd-kit derives it in three
 * steps — a render resolves a collision from the dragged rect, a passive effect
 * turns that collision into `over`, and a layout effect of the following render
 * publishes `over` to the sensor context the end handler reads. A drop that
 * lands before that chain finishes reports the cell the card STARTED in, and
 * the move is silently discarded.
 *
 * The window is small and the consequence is total, which is the worst
 * combination to leave in: measured against this board, a `dragTo` (one
 * `mousemove`, then `mouseup` on the next round trip) and a keyboard
 * `ArrowDown`+`Space` both land inside it often enough to fail outright — 7 to
 * 8 runs in 10 on an idle machine, and reliably WORSE once the worker is busy,
 * because every step of that chain is scheduled work.
 *
 * Waiting does not rescue `over`, because the end handler does not re-read it:
 * it builds the whole `DragEndEvent` — `over` included — synchronously, and only
 * THEN awaits `cancelDrop`. The value is frozen before the wait begins.
 *
 * ─── THE FIX, AND WHY IT IS NOT A SECOND COLLISION DETECTOR ────────────────
 *
 * This component sits inside the `DndContext` and copies `over.id` into a ref,
 * so the ref always holds dnd-kit's own latest answer rather than a second
 * opinion about it. The board then delays the drop — through `cancelDrop`,
 * whose return value dnd-kit awaits — until the chain has had its frames, and
 * reads the target from the ref, which unlike the event is read AFTER the wait.
 * One collision detector, read a moment later.
 *
 * ─── AND WHY THE PUBLICATION IS A LAYOUT EFFECT ────────────────────────────
 *
 * It has to be one. A passive effect is SCHEDULED at commit, not run at it,
 * while the wait it races is measured in animation frames — so on a busy main
 * thread the frames elapse first and the drop reads a target one move stale.
 * That is the same silent discard as above, moved one step later in the chain:
 * the board has already drawn the card in its new cell, the reader sees the
 * move, and confirming it writes nothing.
 *
 * Measured by snapshotting the ref in the microtask after the commit that draws
 * the drop placeholder — the first frame on which the reader can see the move:
 * published from a passive effect the ref still named the cell the card came
 * from, 6 times in 6; published from a layout effect it named the cell under the
 * card, 6 times in 6. The window is not narrowed, it is closed — a layout effect
 * runs inside the commit, and no wait measured in frames can precede it.
 *
 * End to end, confirming the move the instant the placeholder appeared, under 12
 * parallel workers: 1 loss in 96 from the passive effect, none in 288 from this.
 */
export function SettledDropTarget({ overIdRef }: { readonly overIdRef: DropTargetRef }): null {
  const { over } = useDndContext()
  const overId = over?.id

  useLayoutEffect(() => {
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- a ref cell is the sanctioned mutable slot, and publishing into it is this component's entire job
    overIdRef.current = overId
  }, [overId, overIdRef])

  // eslint-disable-next-line unicorn/no-null -- React components must return null (not undefined) to render nothing
  return null
}
