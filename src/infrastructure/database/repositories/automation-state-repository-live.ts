/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, like, or, gt, isNull, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationStateDatabaseError,
  AutomationStateRepository,
} from '@/application/ports/repositories/automation-state-repository'
import { db } from '@/infrastructure/database'
import { automationState } from '@/infrastructure/database/drizzle/schema/automation-state'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new AutomationStateDatabaseError({ cause }))

export const AutomationStateRepositoryLive = Layer.succeed(AutomationStateRepository, {
  set: ({ automationId, key, value, ttlMs }) =>
    wrap(async () => {
      const ttlAt = ttlMs === undefined ? undefined : new Date(Date.now() + ttlMs)
      await db
        .insert(automationState)
        .values({
          automationId,
          key,
          value,
          ...(ttlAt !== undefined ? { ttl: ttlAt } : {}),
        })
        .onConflictDoUpdate({
          target: [automationState.automationId, automationState.key],
          set: {
            value,
            ttl: ttlAt,
            updatedAt: new Date(),
          },
        })
    }),

  get: ({ automationId, key }) =>
    wrap(async () => {
      const rows = await db
        .select({ value: automationState.value })
        .from(automationState)
        .where(
          and(
            eq(automationState.automationId, automationId),
            eq(automationState.key, key),
            or(isNull(automationState.ttl), gt(automationState.ttl, new Date()))
          )
        )
        .limit(1)
      return rows[0]?.value ?? null
    }),

  list: ({ automationId, prefix }) =>
    wrap(async () => {
      const rows = await db
        .select({ key: automationState.key, value: automationState.value })
        .from(automationState)
        .where(
          and(
            eq(automationState.automationId, automationId),
            like(automationState.key, `${prefix}%`),
            or(isNull(automationState.ttl), gt(automationState.ttl, new Date()))
          )
        )
      return rows.map((row) => ({ key: row.key, value: row.value }))
    }),

  delete: ({ automationId, key }) =>
    wrap(async () => {
      await db
        .delete(automationState)
        .where(and(eq(automationState.automationId, automationId), eq(automationState.key, key)))
    }),

  increment: ({ automationId, key, amount }) =>
    wrap(async () => {
      const rows = await db
        .insert(automationState)
        .values({
          automationId,
          key,
          value: amount,
        })
        .onConflictDoUpdate({
          target: [automationState.automationId, automationState.key],
          set: {
            value: sql`(((${automationState.value} #>> '{}')::numeric) + ${amount})::text::jsonb`,
            updatedAt: new Date(),
          },
        })
        .returning({ value: automationState.value })
      const next = Number(rows[0]?.value ?? 0)
      return Number.isFinite(next) ? next : 0
    }),
})
