/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'
import type { Action } from '@/domain/models/app/pages/components/action'

/**
 * Substitute `$record.fieldName` tokens against a record snapshot. Mirrors
 * the kanban card-template substituter so navigate paths like
 * `/events/$record.id` resolve to `/events/42`.
 */
export function substituteRecordTokens(text: string, record: TableRecord): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value === undefined || value === null ? '' : String(value)
  })
}

/** Imperative SPA navigation. Wrapped to keep mutating call out of JSX. */
export function navigateTo(path: string): void {
  if (typeof globalThis !== 'undefined' && globalThis.location) {
    globalThis.location.assign(path)
  }
}

/**
 * Pull the navigate path out of an action and resolve `$record.X` tokens
 * against the FullCalendar event's extended record snapshot. Returns
 * undefined for non-navigate action types.
 */
export function resolveEventNavigatePath(
  action: Action | undefined,
  record: TableRecord
): string | undefined {
  if (!action || action.type !== 'navigate') return undefined
  return substituteRecordTokens(action.path, record)
}

/** Two-digit zero-pad for slot-duration components. */
function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Convert `timeSlotInterval` minutes (e.g. 60) to FullCalendar's
 * `slotDuration` string format (`"HH:MM:SS"`). Falls back to the default
 * 30-minute slot when the input is missing or invalid.
 */
export function minutesToSlotDuration(minutes: number | undefined): string | undefined {
  if (minutes === undefined || minutes <= 0) return undefined
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${padTwo(hours)}:${padTwo(mins)}:00`
}

/**
 * Build a CRUD update payload for a dropped event. FullCalendar passes us
 * the new `start` (and optionally `end`) as ISO strings; we mirror them
 * onto the configured date fields so the persisted record reflects the
 * drop position.
 */
export function buildDropPatch(args: {
  readonly dateField: string
  readonly endDateField: string | undefined
  readonly start: string
  readonly end: string | undefined
}): Record<string, string> {
  const { dateField, endDateField, start, end } = args
  const startEntry = { [dateField]: start }
  const endEntry = endDateField && end ? { [endDateField]: end } : {}
  return { ...startEntry, ...endEntry }
}

/**
 * Persist an event drag-drop by issuing a PATCH to the records endpoint.
 * Returns `{ ok }` so callers can surface failure (and optionally revert
 * the optimistic UI update on the FullCalendar side).
 */
export async function persistEventDrop(args: {
  readonly tableName: string
  readonly recordId: string
  readonly patch: Record<string, string>
}): Promise<{ readonly ok: boolean }> {
  const { tableName, recordId, patch } = args
  const url = `/api/tables/${tableName}/records/${recordId}`
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
