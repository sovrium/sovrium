/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

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
 */
export function useKanbanSensors() {
  return useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}
