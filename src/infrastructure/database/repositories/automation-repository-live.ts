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
} from '@/application/ports/repositories/automation-repository'
import { db } from '@/infrastructure/database'
import { automationDefinitions } from '@/infrastructure/database/drizzle/schema/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new AutomationDatabaseError({ cause }))

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

  list: () =>
    wrap(async () => {
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
      await db.delete(automationDefinitions).where(eq(automationDefinitions.id, id))
    }),
})
