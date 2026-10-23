/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import type { GalleryViewerRows } from './gallery-classes-context'
import type { TableRecord } from '../runtime/types'

/** The reader's own rows as the server stamped them (`dataSource.mine`). */
export type GalleryViewerRowsStamp = Omit<GalleryViewerRows, 'setRow'>

/**
 * The reader's own rows, kept as her toggles switch them, and the records with
 * the one each points at joined as `<as>` (`null` without one).
 */
export function useViewerRows(stamp: GalleryViewerRowsStamp | undefined) {
  const [rows, setRows] = useState(stamp?.rows ?? {})
  const control: GalleryViewerRows | undefined =
    stamp === undefined
      ? undefined
      : {
          ...stamp,
          rows,
          setRow: (item, row) => setRows((current) => ({ ...current, [item]: row })),
        }
  const join = (records: readonly TableRecord[]): readonly TableRecord[] =>
    stamp === undefined
      ? records
      : records.map((record) => ({ ...record, [stamp.as]: rows[String(record.id)] ?? null }))
  return { control, join }
}
