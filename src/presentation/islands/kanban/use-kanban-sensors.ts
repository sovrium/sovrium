/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { KanbanKeyboardSensor } from './kanban-keyboard-sensor'

/**
 * Configure dnd-kit sensors for the kanban board.
 *
 * MouseSensor with a tiny distance threshold so a click (mousedown →
 * mouseup at the same point, no movement) doesn't activate a drag.
 * Without this, `useSortable` applies a transform on mousedown that
 * shifts the card under the cursor — Playwright's `click()` then
 * detects the moving target and times out. Playwright's `dragTo()`
 * generates a single mousemove from source to target (default
 * `steps: 1`), and the source-to-target distance is always >> 5px in
 * these tests, so the drag still activates.
 *
 * The keyboard sensor is {@link KanbanKeyboardSensor} rather than dnd-kit's own:
 * upstream attaches its key listener in a `setTimeout`, and the first arrow key
 * after the pick-up lands in that window often enough that the WCAG 2.2 SC 2.5.7
 * alternative worked 4 times in 10. Its docstring carries the measurement.
 */
export function useKanbanSensors() {
  return useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KanbanKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}
