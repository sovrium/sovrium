/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { createRelatedRecord, fetchCandidatePage } from '../../parts/record-candidates'
import { RECORD_PICKER_COPY } from '../../runtime/picker-contract'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { FetchingPicker } from './fetching-picker'
import type { CandidatePage } from '../../parts/use-candidate-search'
import type { ReactElement } from 'react'

/**
 * The `relationship` cell editor.
 *
 * Searches the related table on the field's declared `displayField` — the one
 * property that names a human-readable column on the other side. It was
 * declared with zero readers repo-wide until this editor; a picker without it
 * can only offer primary keys, which is what the operator was being asked to
 * type before.
 *
 * Searching "every readable text column" was refused: it makes the query shape
 * depend on the related table's width, and a match on a column the caller
 * cannot read would leak that column's contents through the result set. One
 * declared column is predictable and auditable. When `displayField` is absent
 * the picker offers ids and says so, rather than guessing a column.
 *
 * The candidate query, the row→candidate mapping and the inline create all live
 * in `shared/record-candidates.ts` rather than here, because the FORM renders a
 * picker for the same column and the two had drifted to the point where only
 * one of them was a picker at all.
 *
 * `limitToView` does not participate. It is also dead, and waking it means
 * resolving a named view with its filters and sort at query time — a larger
 * feature with its own permission surface. It stays tracked.
 *
 * `many-to-many` is out of scope by construction: it creates a junction table
 * rather than a column, so there is nothing on this record to write.
 */

/**
 * The picker's own copy, derived from what the field declares.
 *
 * Pulled out of the component so its branches count against a helper rather
 * than against the render, which is what `complexity` is protecting.
 */
function pickerLabels(args: {
  readonly relatedTable: string | undefined
  readonly displayField: string | undefined
  readonly fieldName: string | undefined
}) {
  const { relatedTable, displayField, fieldName } = args
  return {
    sourceKey: `${relatedTable ?? ''}:${displayField ?? ''}`,
    searchLabel: `Search ${relatedTable ?? 'records'}`,
    searchPlaceholder: displayField ? `Search by ${displayField}` : 'Search by id',
    listLabel: fieldName ?? 'Linked records',
  }
}

export function RecordPickerEditor(props: CellEditorProps): ReactElement {
  const { relatedTable, displayField, allowMultiple, allowCreate, maxLinked, canCreateRelated } =
    editMetaOf(props.fieldMeta)

  const fetchCandidates = useCallback(
    async (term: string, page: number, signal: AbortSignal): Promise<CandidatePage> =>
      relatedTable
        ? fetchCandidatePage({ relatedTable, displayField, term, page, signal })
        : { candidates: [], hasMore: false },
    [relatedTable, displayField]
  )

  const createFromTerm = useCallback(
    async (term: string) =>
      relatedTable
        ? createRelatedRecord({ relatedTable, displayField, term })
        : ({ ok: false, message: 'This field declares no related table' } as const),
    [relatedTable, displayField]
  )

  // BOTH halves must hold. `allowCreate` is what the AUTHOR declared;
  // `canCreateRelated` is what this CALLER may do, resolved server-side where
  // the session role is known. `undefined` on the second means auth is not
  // configured, which is the full-access model — the same absent-value default
  // the grid toolbar's own create gate uses.
  const offersCreate =
    allowCreate === true && canCreateRelated !== false && relatedTable !== undefined

  const optional = {
    ...(offersCreate && { createFromTerm }),
    ...(maxLinked !== undefined && { maxLinked }),
    ...(relatedTable === undefined && {
      unconfiguredLabel: RECORD_PICKER_COPY.unconfigured,
    }),
  }

  return (
    <FetchingPicker
      {...props}
      fetchCandidates={fetchCandidates}
      allowMultiple={allowMultiple === true}
      emptyLabel={RECORD_PICKER_COPY.empty}
      failedLabel={RECORD_PICKER_COPY.failed}
      {...pickerLabels({ relatedTable, displayField, fieldName: props.fieldName })}
      {...optional}
    />
  )
}
