/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TableRecord } from '../shared/types'

/**
 * Server-wins reconciliation + conflict detection for a realtime data table.
 *
 * When a data source declares `refreshMode: 'realtime'`, the bound island
 * re-fetches its records on every SSE `change` event (and on the resilience
 * fallback poll). This hook compares each freshly-fetched record against the
 * value the client previously displayed: any field whose value changed under
 * the client is a field the server's authoritative state has *overwritten*.
 *
 * The reconciliation strategy is **server-wins**: the hook
 * never mutates the records — the data table always renders the latest
 * server state — it only surfaces a {@link DetectedConflict} so the island
 * can raise a conflict toast naming the overwritten
 * field(s).
 *
 * The first records snapshot establishes a baseline and never raises a
 * conflict; only subsequent changes to an already-displayed record do.
 */

export interface DetectedConflict {
  /** Identifier of the record whose displayed values were overwritten. */
  readonly recordId: string | number
  /** Field name(s) whose displayed value the server state overwrote. */
  readonly overwrittenFields: readonly string[]
  /** Monotonic token so a fresh conflict supersedes a still-shown toast. */
  readonly token: number
}

/** System columns that change on every write and are not user-facing edits. */
const SYSTEM_FIELDS = new Set(['updated_at', 'created_at', 'updated_by', 'created_by'])

/** Index a records array by stringified id for O(1) prior-value lookup. */
function indexById(records: readonly TableRecord[]): ReadonlyMap<string, TableRecord> {
  return new Map(records.map((record) => [String(record.id), record]))
}

/**
 * Compute the field names whose value differs between a previously-displayed
 * record and its freshly-fetched counterpart. System columns (`updated_at`
 * etc.) are excluded — they churn on every write and are not a user-visible
 * overwrite. Values are compared by JSON identity so nested shapes diff
 * correctly.
 */
function changedFields(prev: TableRecord, next: TableRecord): readonly string[] {
  return Object.keys(next)
    .filter((key) => key !== 'id' && !SYSTEM_FIELDS.has(key))
    .filter((key) => JSON.stringify(prev[key]) !== JSON.stringify(next[key]))
}

/**
 * Detect the first record whose displayed field values were overwritten by an
 * incoming server snapshot. Returns `undefined` when nothing a user could see
 * actually changed.
 */
function detectConflict(
  prevById: ReadonlyMap<string, TableRecord>,
  nextRecords: readonly TableRecord[]
): Omit<DetectedConflict, 'token'> | undefined {
  return nextRecords
    .map((next) => {
      const prev = prevById.get(String(next.id))
      // A brand-new record is an insert, not an overwrite of displayed values.
      if (!prev) return undefined
      const overwrittenFields = changedFields(prev, next)
      return overwrittenFields.length > 0
        ? { recordId: next.id as string | number, overwrittenFields }
        : undefined
    })
    .find((detected): detected is Omit<DetectedConflict, 'token'> => detected !== undefined)
}

/**
 * Track the displayed records and surface a {@link DetectedConflict} whenever
 * an incoming server snapshot overwrites a field the user could already see.
 *
 * `enabled` is `false` for non-realtime data sources, in which case the hook
 * is inert (no snapshot, no conflicts). `onConflict` is invoked once per
 * freshly-detected conflict — the island uses it to discard a stale optimistic
 * editor so the cell renders the authoritative server state (server-wins).
 */
export function useRealtimeReconciliation(params: {
  readonly enabled: boolean
  readonly records: readonly TableRecord[]
  readonly onConflict?: () => void
}): {
  readonly conflict: DetectedConflict | undefined
  readonly dismissConflict: () => void
} {
  const { enabled, records, onConflict } = params
  const prevRef = useRef<ReadonlyMap<string, TableRecord> | undefined>(undefined)
  const tokenRef = useRef(0)
  const onConflictRef = useRef(onConflict)
  // eslint-disable-next-line functional/immutable-data -- Ref keeps the latest callback without retriggering the effect
  onConflictRef.current = onConflict
  const [conflict, setConflict] = useState<DetectedConflict | undefined>(undefined)

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line functional/immutable-data -- Ref reset when realtime disabled
      prevRef.current = undefined
      return
    }

    const prevById = prevRef.current
    // The first snapshot is the baseline — record it without raising a conflict.
    if (prevById === undefined) {
      // eslint-disable-next-line functional/immutable-data -- Ref holds the displayed-records baseline
      prevRef.current = indexById(records)
      return
    }

    const detected = detectConflict(prevById, records)
    // eslint-disable-next-line functional/immutable-data -- Ref advances to the latest server snapshot
    prevRef.current = indexById(records)

    if (detected) {
      // eslint-disable-next-line functional/immutable-data -- Ref bumps the monotonic conflict token
      tokenRef.current += 1
      setConflict({ ...detected, token: tokenRef.current })
      onConflictRef.current?.()
    }
  }, [enabled, records])

  const dismissConflict = useCallback(() => setConflict(undefined), [])

  return { conflict, dismissConflict }
}
