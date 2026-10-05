/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Field-level WRITE permission, as one pure function.
 *
 * One rule: a value the caller may not read is never theirs to change. So:
 *
 * - a field whose `permissions.fields[].write` names an audience may be written
 *   only by a role in it — readable or not (a suggestion box: members write a
 *   note only admins read);
 * - a field with no such entry is writable exactly when the caller may READ it,
 *   by the records read's own predicate (field grants, `group:` entries and the
 *   built-in default rules included). Before, it was writable by every role the
 *   table admits, so a member could overwrite a budget she could not see.
 *
 * An admin-equivalent role owns every field. Every door that writes a record
 * asks this question the same way — the records API, the MCP write tools, an
 * automation run someone started by hand, the record drawer's editable fields,
 * the AI chat's mutations and the permission map's `write` flags.
 *
 * The `write` audience is matched against the caller's ROLE only: a `group:`
 * entry in a field's `write` rule is not honoured yet. Only the read half takes
 * the caller's groups.
 */

import { hasPermission } from '@/domain/models/app/auth/permissions'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isFieldReadableByCaller } from './field-read-filter-service'
import type { App } from '@/domain/models/app'

/** Who is writing: the global role, and the groups the read half matches. */
export interface FieldWriter {
  readonly role: string
  readonly groups: readonly string[]
}

/** The names in `fields` the writer may not write on `tableName` (empty when all are writable). */
export const forbiddenWriteFields = (
  app: App,
  tableName: string,
  writer: FieldWriter,
  fields: Readonly<Record<string, unknown>>
): readonly string[] => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (table === undefined || isAdminEquivalent(writer.role, app)) return []
  return Object.keys(fields).filter((fieldName) => {
    const audience = table.permissions?.fields?.find((fp) => fp.field === fieldName)?.write
    if (audience !== undefined) return !hasPermission(audience, writer.role)
    return !isFieldReadableByCaller(app, tableName, writer, fieldName)
  })
}
