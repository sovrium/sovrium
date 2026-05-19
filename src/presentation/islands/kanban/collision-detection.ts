/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'

export const COLUMN_DROP_PREFIX = 'kanban-column:'

export function isColumnDropId(id: string | number): boolean {
  return typeof id === 'string' && id.startsWith(COLUMN_DROP_PREFIX)
}

export function columnDropId(value: string): string {
  return `${COLUMN_DROP_PREFIX}${value}`
}

export function decodeColumnDropId(id: string): string {
  return id.slice(COLUMN_DROP_PREFIX.length)
}

export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers } = args
  const columnsOnly = droppableContainers.filter((c) => c.id !== active.id && isColumnDropId(c.id))
  const columnArgs = { ...args, droppableContainers: columnsOnly }

  const pointer = pointerWithin(columnArgs)
  if (pointer.length) return pointer

  const intersection = rectIntersection(columnArgs)
  if (intersection.length) return intersection

  return closestCenter(columnArgs)
}
