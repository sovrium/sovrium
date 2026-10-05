/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an editable drawer's choice controls offer — see
 * `record-drawer-choice-input.tsx`.
 */

import { useQuery } from '@tanstack/react-query'
import { fetchUserDirectoryPage, USER_DIRECTORY_SOURCE_KEY } from '../parts/user-directory'

/** One choice of a drawer select: the value written and the text shown. */
export interface DrawerChoice {
  readonly value: string
  readonly label: string
}

/** Field types an editable drawer offers as a choice of options. */
const OPTION_FIELD_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

/** Whether an editable entry is a choice control rather than a text box. */
export const isChoiceField = (field: {
  readonly type: string
  readonly options?: ReadonlyArray<DrawerChoice>
}): boolean =>
  field.type === 'user' || (OPTION_FIELD_TYPES.has(field.type) && field.options !== undefined)

/**
 * Whether an editable entry is a single-valued link the drawer offers as a
 * picker of named records (see `record-drawer-link-input.tsx`) — the SSR host
 * resolves `relatedTable` only for such a link.
 */
export const isLinkField = (field: {
  readonly type: string
  readonly relatedTable?: string
}): boolean => field.type === 'relationship' && field.relatedTable !== undefined

const NO_CHOICES: ReadonlyArray<DrawerChoice> = []

/**
 * The accounts a `user` entry may hold — the directory the form's people
 * picker reads, so the two cannot disagree about who is offered or how an
 * account is named. Read only while the drawer is open and edits one.
 */
export function useAccountChoices(enabled: boolean): ReadonlyArray<DrawerChoice> {
  const query = useQuery({
    queryKey: [USER_DIRECTORY_SOURCE_KEY, 'record-drawer'],
    queryFn: async ({ signal }) =>
      (await fetchUserDirectoryPage('', signal)).candidates.map(({ value, label }) => ({
        value,
        label,
      })),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })
  return query.data ?? NO_CHOICES
}
