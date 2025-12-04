/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Check if field should create a database column
 *
 * Some field types are UI-only and don't need database columns:
 * - button: UI-only action field (no data stored)
 * - count: Virtual/computed field (calculated from relationships)
 *
 * This utility is used by:
 * - table-operations.ts: CREATE TABLE generation
 * - schema-migration-helpers.ts: ALTER TABLE generation
 * - field-permission-generators.ts: Column-level permission grants
 *
 * @param field - Field configuration from table schema
 * @returns true if field needs a database column, false if UI-only/virtual
 */
export const shouldCreateDatabaseColumn = (field: Fields[number]): boolean =>
  field.type !== 'button' && field.type !== 'count'
