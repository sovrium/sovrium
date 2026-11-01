/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isGuestSession, SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  buildCreateAuthorshipOverrides,
  buildCurrentUserDefaults,
  buildUpdateAuthorshipOverrides,
} from '@/domain/models/app/tables/authorship-fields'
import type { App } from '@/domain/models/app'

/**
 * Stamp every `created-by`/`updated-by`-typed column BY NAME with the
 * authenticated actor. The infra authorship injection only fills the LITERAL
 * `created_by`/`updated_by` columns (discovered via DB introspection); a
 * custom-named field (e.g. `author`, generated TEXT NOT NULL under auth) would
 * otherwise be left NULL and 500 the INSERT. Resolving by FIELD TYPE here (the
 * application layer, where the table schema is available) mirrors
 * `writeBoundTableRecord` in submit-form.ts.
 *
 * `phase: 'create'` stamps both created-by AND updated-by fields (a fresh row
 * is created-and-last-modified by the same actor); `phase: 'update'` re-stamps
 * only updated-by fields. Guest sessions are skipped — no real actor exists to
 * stamp a custom-named field, and the infra normalizes the literal columns to
 * NULL. On create, the literal `created_by` is still re-overridden downstream
 * by the infra, so a user-supplied value for it is still ignored.
 */
export const applyAuthorshipOverrides = (input: {
  readonly phase: 'create' | 'update'
  readonly fields: Readonly<Record<string, unknown>>
  readonly tables: App['tables'] | undefined
  readonly tableName: string
  readonly userId: string
}): Readonly<Record<string, unknown>> => {
  const { phase, fields, tables, tableName, userId } = input
  if (isGuestSession(userId)) return { ...fields }
  const overrides =
    phase === 'create'
      ? buildCreateAuthorshipOverrides(tables, tableName, userId)
      : buildUpdateAuthorshipOverrides(tables, tableName, userId)
  // A `user` field defaulting to `$currentUser` is filled with a person, so
  // the system actor — which is no account — leaves it empty. The defaults
  // name only the fields the caller left empty (absent, null or ''), so they
  // go after the fields: a value the caller names always stays.
  const defaults =
    phase === 'create' && userId !== SYSTEM_USER_ID
      ? buildCurrentUserDefaults(tables, tableName, userId, fields)
      : {}
  return { ...fields, ...defaults, ...overrides }
}
