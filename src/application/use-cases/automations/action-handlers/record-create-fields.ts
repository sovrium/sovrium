/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildCreateAuthorshipOverrides } from '@/domain/models/app/tables/authorship-fields'
import { normalizeDateValuesIn } from '@/domain/models/app/tables/empty-date-service'
import type { App } from '@/domain/models/app'

/**
 * The fields an automation step creates a row with: an empty or blank date read
 * as "no date" (`null`), as every other write road reads it, then the actor's
 * authorship stamps. An automation step calls `createRecordProgram` without the
 * app, so the program cannot find the table's field types itself — a templated
 * `{{trigger.data.due}}` that resolved to `''` would otherwise store `""` on
 * SQLite and be refused on PostgreSQL.
 */
export const automationCreateFields = (
  app: App,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  actorId: string
): Readonly<Record<string, unknown>> => ({
  ...normalizeDateValuesIn(app.tables, tableName, fields),
  ...buildCreateAuthorshipOverrides(app.tables, tableName, actorId),
})
