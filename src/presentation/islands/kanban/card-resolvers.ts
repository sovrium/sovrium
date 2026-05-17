/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substitute } from './card-template'
import type { TableRecord } from '../shared/types'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'

/**
 * Pull the navigate path out of a card.onClick action and substitute
 * $record.X tokens. Returns undefined when the action isn't a navigate.
 */
export function resolveNavigatePath(
  onClick: KanbanCard['onClick'],
  record: TableRecord
): string | undefined {
  if (!onClick || onClick.type !== 'navigate') return undefined
  return substitute(onClick.path, record)
}

/** Resolve `colorField` to a stringified value or undefined when missing. */
export function resolveDataColor(card: KanbanCard, record: TableRecord): string | undefined {
  if (card.colorField === undefined) return undefined
  const colorValue = record[card.colorField]
  if (colorValue === null || colorValue === undefined || colorValue === '') return undefined
  return String(colorValue)
}

/** Resolve `coverImage` template to a usable URL or undefined. */
export function resolveCoverImage(card: KanbanCard, record: TableRecord): string | undefined {
  if (card.coverImage === undefined) return undefined
  const resolved = substitute(card.coverImage, record)
  // Drop empty string (e.g. when thumbnail field is null) so we don't render a
  // broken `<img src="">` element that would still trip toBeVisible() checks.
  return resolved === '' ? undefined : resolved
}

/** Imperative SPA navigation. Wrapped to keep mutating call out of JSX. */
export function navigateTo(path: string): void {
  if (typeof globalThis !== 'undefined' && globalThis.location) {
    globalThis.location.assign(path)
  }
}
