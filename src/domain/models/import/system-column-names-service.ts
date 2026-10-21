/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Imported field names that would take a column the engine writes itself —
 * `id`, `created_at`, `updated_at`, `deleted_at` and the authorship columns.
 * A plain field under such a name would have its values overwritten by the
 * engine on every write (a migrated "Created by" kept as text would read
 * `system`), so it is renamed `source_<name>` and the report says so.
 */

import {
  AUTHORSHIP_TABLE_COLUMNS,
  INTRINSIC_TABLE_COLUMNS,
} from '@/domain/models/app/tables/system-fields'
import { lookupFieldType } from './field-type-mappings'
import { toSnakeName } from './import-names-service'
import type { CanonicalField } from './canonical-base'
import type { TableSourceTool } from './field-type-mappings'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/** The prefix a source field's name gets when it would take a column the engine owns. */
export const SOURCE_PREFIX = 'source_'

/** The columns the engine writes itself, by name: never a plain imported field's. */
const SYSTEM_COLUMNS: ReadonlySet<string> = new Set([
  ...INTRINSIC_TABLE_COLUMNS,
  ...AUTHORSHIP_TABLE_COLUMNS,
])

/** The authorship type that owns each authorship column. */
const AUTHORSHIP_TYPE_OF: Readonly<Record<string, FieldType>> = {
  created_by: 'created-by',
  updated_by: 'updated-by',
  deleted_by: 'deleted-by',
}

/**
 * Whether a source field named `name` would take a column the engine stamps on
 * its own. Only the authorship field of that very column, in an app with
 * accounts, may keep the name; any other field would have its values
 * overwritten on every write, so it is renamed and reported.
 */
export const isSystemColumnClash = (
  name: string,
  field: CanonicalField,
  context: { readonly tool: TableSourceTool; readonly accounts?: boolean }
): boolean => {
  if (!SYSTEM_COLUMNS.has(name)) return false
  const looked = lookupFieldType(context.tool, field.sourceType)
  const owner = AUTHORSHIP_TYPE_OF[name]
  return !(
    owner !== undefined &&
    (context.accounts ?? true) &&
    looked.outcome !== 'unmapped' &&
    looked.sovrium === owner
  )
}

/**
 * The engine column whose name a field gave up, or `undefined` when its
 * name is its own. `sourceLabel` is the field's name in the source tool.
 */
export const renamedSystemColumn = (name: string, sourceLabel: string): string | undefined => {
  if (!name.startsWith(SOURCE_PREFIX)) return undefined
  const column = name.slice(SOURCE_PREFIX.length)
  return SYSTEM_COLUMNS.has(column) && toSnakeName(sourceLabel) === column ? column : undefined
}
