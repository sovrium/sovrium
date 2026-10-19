/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MouseSensor } from '@dnd-kit/core'
import { getEventCoordinates, getOwnerDocument } from '@dnd-kit/utilities'

/** `@dnd-kit/core` does not re-export its `Coordinates` type from the barrel. */
interface Coordinates {
  readonly x: number
  readonly y: number
}

/** The props dnd-kit constructs a mouse sensor with (`MouseSensorProps`, not re-exported). */
type MouseSensorProps = ConstructorParameters<typeof MouseSensor>[0]

/** The pointer's latest position while one press is in flight. */
interface PointerTracker {
  readonly latest: () => Coordinates | undefined
  readonly stop: () => void
}

/**
 * Follow the pointer on the document for one press.
 *
 * Listens in the CAPTURE phase, so it has recorded a move before the sensor's
 * own (bubbling) listener on the same document handles it — including the move
 * that activates the drag.
 */
function trackPointer(target: EventTarget | null): PointerTracker {
  const doc = getOwnerDocument(target)
  const state: { coordinates: Coordinates | undefined } = { coordinates: undefined }
  const onMove = (event: Event): void => {
    state.coordinates = getEventCoordinates(event) ?? undefined
  }
  doc.addEventListener('mousemove', onMove, { capture: true, passive: true })
  return {
    latest: () => state.coordinates,
    stop: () => doc.removeEventListener('mousemove', onMove, { capture: true }),
  }
}

/**
 * The board's mouse drag sensor — dnd-kit's `MouseSensor`, whose activating
 * move also MOVES the drag.
 *
 * ─── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 *
 * A press that does not travel must stay a click: with no activation distance
 * the sensor took every mouse press as a drag, and dnd-kit swallows the click
 * that ends a drag, so a card's `onClick` never ran from the mouse. The board
 * therefore declares an activation `distance`.
 *
 * dnd-kit then STARTS the drag on the move that crosses that distance without
 * reporting the move itself. A pointer that travels in steps does not notice —
 * the next step moves the drag — but a pointer that jumps from the card to its
 * destination in ONE move (a quick flick, or an automated drag) starts a drag
 * at the card and drops it there, so the card never leaves its column.
 *
 * ─── HOW, ON PUBLIC API ONLY ──────────────────────────────────────────────
 *
 * A sensor is constructed with `onStart` / `onMove` / `onEnd` / `onCancel`
 * callbacks — the documented custom-sensor contract. This one wraps `onStart`:
 * once the drag has started, it reports the pointer's current position as the
 * drag's first move. The position comes from its own capture-phase listener,
 * never from the sensor's internals, so a dnd-kit upgrade that reshapes its
 * private members cannot break it; at worst the replayed move is a no-op.
 */
export class KanbanMouseSensor extends MouseSensor {
  constructor(props: MouseSensorProps) {
    const tracker = trackPointer(props.event.target)
    super({
      ...props,
      onStart: (coordinates) => {
        props.onStart(coordinates)
        const current = tracker.latest()
        if (current !== undefined) props.onMove(current)
      },
      onEnd: () => {
        tracker.stop()
        props.onEnd()
      },
      onCancel: () => {
        tracker.stop()
        props.onCancel()
      },
    })
  }
}
