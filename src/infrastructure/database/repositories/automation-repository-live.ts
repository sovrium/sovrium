/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AutomationDatabaseError,
  AutomationRepository,
} from '@/application/ports/repositories/automation-repository'
import { db } from '@/infrastructure/database'
import { automationDefinitions } from '@/infrastructure/database/drizzle/schema/automation'

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
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(automationDefinitions)
          .where(eq(automationDefinitions.id, id))
          .limit(1)
        return rows[0] as Record<string, unknown> | undefined
      },
      catch: (cause) => new AutomationDatabaseError({ cause }),
    }),

  findByName: (name) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(automationDefinitions)
          .where(eq(automationDefinitions.name, name))
          .limit(1)
        return rows[0] as Record<string, unknown> | undefined
      },
      catch: (cause) => new AutomationDatabaseError({ cause }),
    }),

  list: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.select().from(automationDefinitions)
        return rows as readonly Record<string, unknown>[]
      },
      catch: (cause) => new AutomationDatabaseError({ cause }),
    }),

  create: (definition) =>
    Effect.tryPromise({
      try: async () => {
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
      },
      catch: (cause) => new AutomationDatabaseError({ cause }),
    }),

  update: (id, data) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .update(automationDefinitions)
          .set(data)
          .where(eq(automationDefinitions.id, id))
          .returning()
        return row as Record<string, unknown>
      },
      catch: (cause) => new AutomationDatabaseError({ cause }),
    }),

  delete: (id) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db.delete(automationDefinitions).where(eq(automationDefinitions.id, id))
      },
      catch: (cause) => new AutomationDatabaseError({ cause }),
    }),
})
