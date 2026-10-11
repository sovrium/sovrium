/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { writeOnlyPresence } from '@/domain/models/app/tables/field-read-filter-service'
import type { App } from '@/domain/models/app'

/**
 * The `_writeOnly` block a records-API answer carries beside `fields`, as a
 * spread: `{ _writeOnly: { <field>: true | false } }` for the write-only fields
 * the caller could read under the ordinary field rules, judged on the STORED
 * row (the value itself never reaches the answer). Empty when the table has no
 * such field, or when no caller is named — a write answered as stored.
 */
export const writeOnlyBlock = (input: {
  readonly app?: App | undefined
  readonly tableName: string
  readonly userRole?: string | undefined
  readonly userGroups?: readonly string[] | undefined
  readonly record: Readonly<Record<string, unknown>>
}): { readonly _writeOnly?: Readonly<Record<string, boolean>> } => {
  const { app, tableName, userRole, record } = input
  if (app === undefined || userRole === undefined || userRole === '') return {}
  const caller = { role: userRole, groups: input.userGroups ?? [] }
  const presence = writeOnlyPresence({ app, tableName, caller, record })
  return presence === undefined ? {} : { _writeOnly: presence }
}
