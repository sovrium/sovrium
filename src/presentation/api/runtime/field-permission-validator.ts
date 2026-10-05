/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  forbiddenWriteFields,
  type FieldWriter,
} from '@/domain/models/app/tables/field-write-permission-service'
import type { App } from '@/domain/models/app'

/**
 * Check if user has permission to write to specific fields
 *
 * Returns the fields the caller cannot write to — the shared domain rule
 * (`forbiddenWriteFields`): a field the caller may not read is writable only
 * through an explicit `write` grant. An admin-equivalent role bypasses it.
 *
 * @param app - Application configuration
 * @param tableName - Name of the table
 * @param writer - The caller's role and groups
 * @param fields - Fields being updated
 * @returns Array of field names user cannot write to (empty if all allowed)
 */
export function validateFieldWritePermissions(
  app: App,
  tableName: string,
  writer: FieldWriter,
  fields: Readonly<Record<string, unknown>>
): readonly string[] {
  return forbiddenWriteFields(app, tableName, writer, fields)
}
