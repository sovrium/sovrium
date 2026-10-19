/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { fetchUserDirectoryPage, USER_DIRECTORY_SOURCE_KEY } from '../../parts/user-directory'
import { useGridString } from '../island/grid-strings'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { FetchingPicker } from './fetching-picker'
import type { CandidatePage } from '../../parts/use-candidate-search'
import type { ReactElement } from 'react'

/**
 * The `user` cell editor. Its candidate read is the shared
 * {@link fetchUserDirectoryPage}, which the form's people picker uses too; its
 * search and list names follow the page language (`datatable.picker.*`).
 */
export function UserPickerEditor(props: CellEditorProps): ReactElement {
  const { allowMultiple } = editMetaOf(props.fieldMeta)
  const people = useGridString('datatable.picker.people', 'People')

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
      searchLabel={useGridString('datatable.picker.searchPeople', 'Search people')}
      searchPlaceholder={useGridString('datatable.picker.searchByName', 'Search by name')}
      listLabel={props.fieldName ?? people}
      emptyLabel={useGridString('picker.noMatchingPeople', 'No matching people')}
      failedLabel={useGridString('picker.directoryFailed', 'Could not load the directory')}
    />
  )
}
