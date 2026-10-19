/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CALLER_READ_ONLY_KEY } from '@/domain/models/app/auth/console-table-view-service'
import { callerTableOf, updatableFieldsOf } from '@/presentation/render/props/caller-table-inputs'
import type { CallerTableView } from '@/application/ports/services/page-renderer'

/** Whether the console marked the bound table read-only for the reader. */
const callerReadOnly = (tables: readonly unknown[] | undefined, name: unknown): boolean =>
  (tables ?? []).some(
    (table) =>
      (table as { readonly name?: unknown }).name === name &&
      (table as Readonly<Record<string, unknown>>)[CALLER_READ_ONLY_KEY] === true
  )

/**
 * Whether the drawer edits: not over a system source (read-only), not turned
 * off by its author, not over a table the console marked read-only for its
 * caller (`consoleTableView`), and — Save following the fields the reader may write —
 * only when at least one entry is one she may send.
 */
export const drawerCanEdit = (
  comp: Readonly<Record<string, unknown>>,
  entries: unknown,
  tables: readonly unknown[] | undefined
): boolean => {
  const dataSource = comp['dataSource'] as
    { readonly system?: unknown; readonly table?: unknown } | undefined
  if (dataSource?.system !== undefined || comp['canEdit'] === false) return false
  if (callerReadOnly(tables, dataSource?.table)) return false
  return writesAny(entries, callerTableOf(comp as Parameters<typeof callerTableOf>[0]))
}

/**
 * `true` when at least one drawer entry is an input its reader may send: not
 * read-only, and — when the drawer was stamped with its reader's table
 * (`props._callerTable`) — on a field she may update (`updatableFieldsOf`).
 */
const writesAny = (entries: unknown, callerTable: CallerTableView | undefined): boolean => {
  if (!Array.isArray(entries)) return true
  const updatable = callerTable === undefined ? undefined : new Set(updatableFieldsOf(callerTable))
  return entries.some((entry) => {
    const { readOnly, name } = (entry ?? {}) as {
      readonly readOnly?: unknown
      readonly name?: unknown
    }
    return readOnly !== true && (updatable === undefined || updatable.has(String(name)))
  })
}
