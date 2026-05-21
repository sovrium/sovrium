/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TableRecord } from '../shared/types'


export interface DetectedConflict {
  readonly recordId: string | number
  readonly overwrittenFields: readonly string[]
  readonly token: number
}

const SYSTEM_FIELDS = new Set(['updated_at', 'created_at', 'updated_by', 'created_by'])

function indexById(records: readonly TableRecord[]): ReadonlyMap<string, TableRecord> {
  return new Map(records.map((record) => [String(record.id), record]))
}

function changedFields(prev: TableRecord, next: TableRecord): readonly string[] {
  return Object.keys(next)
    .filter((key) => key !== 'id' && !SYSTEM_FIELDS.has(key))
    .filter((key) => JSON.stringify(prev[key]) !== JSON.stringify(next[key]))
}

function detectConflict(
  prevById: ReadonlyMap<string, TableRecord>,
  nextRecords: readonly TableRecord[]
): Omit<DetectedConflict, 'token'> | undefined {
  return nextRecords
    .map((next) => {
      const prev = prevById.get(String(next.id))
      if (!prev) return undefined
      const overwrittenFields = changedFields(prev, next)
      return overwrittenFields.length > 0
        ? { recordId: next.id as string | number, overwrittenFields }
        : undefined
    })
    .find((detected): detected is Omit<DetectedConflict, 'token'> => detected !== undefined)
}

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
  onConflictRef.current = onConflict
  const [conflict, setConflict] = useState<DetectedConflict | undefined>(undefined)

  useEffect(() => {
    if (!enabled) {
      prevRef.current = undefined
      return
    }

    const prevById = prevRef.current
    if (prevById === undefined) {
      prevRef.current = indexById(records)
      return
    }

    const detected = detectConflict(prevById, records)
    prevRef.current = indexById(records)

    if (detected) {
      tokenRef.current += 1
      setConflict({ ...detected, token: tokenRef.current })
      onConflictRef.current?.()
    }
  }, [enabled, records])

  const dismissConflict = useCallback(() => setConflict(undefined), [])

  return { conflict, dismissConflict }
}
