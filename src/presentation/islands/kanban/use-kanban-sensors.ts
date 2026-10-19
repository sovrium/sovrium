/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { KanbanKeyboardSensor } from './kanban-keyboard-sensor'
import { KanbanMouseSensor } from './kanban-mouse-sensor'

/**
 * Configure dnd-kit sensors for the kanban board.
 *
 * The mouse sensor activates only once the pointer has travelled 5px, so a
 * click — press and release on the same point — stays a click and reaches the
 * card's `onClick` (dnd-kit swallows the click that ends a drag). It is
 * {@link KanbanMouseSensor} rather than dnd-kit's own, so the move that crosses
 * the threshold also moves the drag: a pointer that jumps straight to the
 * target column in one move still drops there.
 *
 * The keyboard sensor is {@link KanbanKeyboardSensor} rather than dnd-kit's own:
 * upstream attaches its key listener in a `setTimeout`, and the first arrow key
 * after the pick-up lands in that window often enough that the WCAG 2.2 SC 2.5.7
 * alternative worked 4 times in 10. Its docstring carries the measurement.
 */
export function useKanbanSensors() {
  return useSensors(
    useSensor(KanbanMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KanbanKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}
