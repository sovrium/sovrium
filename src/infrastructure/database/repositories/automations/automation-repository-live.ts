/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationDatabaseError,
  AutomationRepository,
} from '@/application/ports/repositories/automations/automation-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { automationDefinitions as automationDefinitionsPg } from '@/infrastructure/database/drizzle/schema/automation'
import { automationDefinitions as automationDefinitionsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/**
 * Dialect-aware schema object for `system.automation_definitions`. See
 * `resolveDialectSchema` for the why and the rules — every PG-typed Drizzle
 * import in this directory follows the same pattern.
 */
const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)

/** Wrap a DB promise, adapting failures to AutomationDatabaseError. */
const wrap = makeDbWrap((cause) => new AutomationDatabaseError({ cause }))

/**
 * Automation Repository Implementation (Drizzle).
 *
 * Backs `system.automation_definitions` — the catalogue of automations the
 * runtime knows about. Currently the only writer; the runtime lazily
 * upserts a row on first webhook trigger via `findByName` then `create` if
 * absent (see `run-automation.ts`). All FK-bearing tables (`automation_runs`,
 * `automation_state`, `automation_run_steps`, etc.) join back here by `id`.
 */
export const AutomationRepositoryLive = Layer.succeed(AutomationRepository, {
  findById: (id) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(automationDefinitions)
        .where(eq(automationDefinitions.id, id))
        .limit(1)
      return rows[0] as Record<string, unknown> | undefined
    }),

  findByName: (name) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(automationDefinitions)
        .where(eq(automationDefinitions.name, name))
        .limit(1)
      return rows[0] as Record<string, unknown> | undefined
    }),

  list: wrap(async () => {
    const rows = await db.select().from(automationDefinitions)
    return rows as readonly Record<string, unknown>[]
  }),

  create: (definition) =>
    wrap(async () => {
      const [row] = await db
        .insert(automationDefinitions)
        .values({
          name: definition.name,
          trigger: definition.trigger,
          actions: definition.actions as readonly Record<string, unknown>[],
          enabled: definition.enabled ?? true,
        })
        .returning()
      return row as Record<string, unknown>
    }),

  update: (id, data) =>
    wrap(async () => {
      const [row] = await db
        .update(automationDefinitions)
        .set(data)
        .where(eq(automationDefinitions.id, id))
        .returning()
      return row as Record<string, unknown>
    }),

  delete: (id) =>
    wrap(async () => {
      // eslint-disable-next-line functional/no-expression-statements
      await db.delete(automationDefinitions).where(eq(automationDefinitions.id, id))
    }),
})
