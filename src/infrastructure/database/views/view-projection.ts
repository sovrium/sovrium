/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import type { Table } from '@/domain/models/app/tables'
import type { View } from '@/domain/models/app/tables/views'

/**
 * The SELECT list of a config view. A `button` field stores nothing, so it has
 * no column anywhere — not in the table, not in its lookup view — and listing
 * it in `fields` only tells a grid to draw the button. It is left out of the
 * projection. When nothing else is listed the view projects `id` rather than
 * `*`, so leaving the button out never widens what the view exposes.
 */
export const viewProjection = (table: Table, view: View): string => {
  if (!view.fields || view.fields.length === 0) return '*'
  const buttons = new Set(
    table.fields.filter((field) => field.type === 'button').map((field) => field.name)
  )
  const stored = view.fields.filter((name) => !buttons.has(name))
  return stored.length > 0 ? stored.map(quoteSqlIdentifier).join(', ') : quoteSqlIdentifier('id')
}
