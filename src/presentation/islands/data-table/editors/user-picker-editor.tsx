/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { fetchUserDirectoryPage, USER_DIRECTORY_SOURCE_KEY } from '../../parts/user-directory'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { FetchingPicker } from './fetching-picker'
import type { CandidatePage } from '../../parts/use-candidate-search'
import type { ReactElement } from 'react'

/**
 * The `user` cell editor. Its candidate read is the shared
 * {@link fetchUserDirectoryPage}, which the form's people picker uses too.
 */
export function UserPickerEditor(props: CellEditorProps): ReactElement {
  const { allowMultiple } = editMetaOf(props.fieldMeta)

  const fetchCandidates = useCallback(
    (term: string, _page: number, signal: AbortSignal): Promise<CandidatePage> =>
      fetchUserDirectoryPage(term, signal),
    []
  )

  return (
    <FetchingPicker
      {...props}
      fetchCandidates={fetchCandidates}
      sourceKey={USER_DIRECTORY_SOURCE_KEY}
      allowMultiple={allowMultiple === true}
      searchLabel="Search people"
      searchPlaceholder="Search by name"
      listLabel={props.fieldName ?? 'People'}
      emptyLabel="No matching people"
      failedLabel="Could not load the directory"
    />
  )
}
