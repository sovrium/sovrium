/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  EmailDeliverabilityDatabaseError,
  EmailDeliverabilityRepository,
} from '@/application/ports/repositories/automations/email-deliverability-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  emailMessages as messagesPg,
  emailSuppressions as suppressionsPg,
} from '@/infrastructure/database/drizzle/schema/email-deliverability'
import {
  emailMessages as messagesSqlite,
  emailSuppressions as suppressionsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/email-deliverability'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const suppressions = resolveDialectSchema(suppressionsPg, suppressionsSqlite)
const messages = resolveDialectSchema(messagesPg, messagesSqlite)

const wrap = makeDbWrap((cause) => new EmailDeliverabilityDatabaseError({ cause }))

/** The rows matching a campaign and/or a category. */
const messageFilter = (input: {
  readonly campaign?: string
  readonly category?: string
}): SQL | undefined =>
  and(
    ...(input.campaign === undefined ? [] : [eq(messages.campaign, input.campaign)]),
    ...(input.category === undefined ? [] : [eq(messages.category, input.category)])
  )

/** `count(<column>)` as a number on both dialects (null columns are not counted). */
const countOf = (column: SQL | typeof messages.id): SQL<number> =>
  sql<number>`cast(count(${column}) as integer)`

/**
 * Drizzle implementation of {@link EmailDeliverabilityRepository}, both
 * dialects. A suppression is written once per address and category: a second
 * identical suppression changes nothing.
 */
export const EmailDeliverabilityRepositoryLive = Layer.succeed(EmailDeliverabilityRepository, {
  suppressedAmong: ({ addresses, category }) =>
    wrap(async () => {
      const lowered = [...new Set(addresses.map((address) => address.toLowerCase()))]
      if (lowered.length === 0) return new Set<string>()
      const rows = await db
        .select({ address: suppressions.address })
        .from(suppressions)
        .where(
          and(
            inArray(suppressions.address, lowered),
            or(isNull(suppressions.category), eq(suppressions.category, category))
          )
        )
      return new Set(rows.map((row) => row.address))
    }),

  suppress: ({ address, reason, category }) =>
    wrap(async () => {
      const lowered = address.toLowerCase()
      const sameCategory =
        category === undefined ? isNull(suppressions.category) : eq(suppressions.category, category)
      const existing = await db
        .select({ id: suppressions.id })
        .from(suppressions)
        .where(and(eq(suppressions.address, lowered), sameCategory))
        .limit(1)
      if (existing.length > 0) return
      await db.insert(suppressions).values({
        id: crypto.randomUUID(),
        address: lowered,
        category: category ?? null,
        reason,
        createdAt: new Date(),
      })
    }),

  recordMessage: ({ ref, messageId, category, campaign }) =>
    wrap(async () => {
      await db.insert(messages).values({
        id: ref,
        messageId: messageId ?? null,
        category: category ?? null,
        campaign: campaign ?? null,
        sentAt: new Date(),
      })
    }),

  markOpened: (ref) =>
    wrap(async () => {
      await db
        .update(messages)
        .set({ openedAt: new Date() })
        .where(and(eq(messages.id, ref), isNull(messages.openedAt)))
    }),

  markUnsubscribed: (ref) =>
    wrap(async () => {
      await db
        .update(messages)
        .set({ unsubscribedAt: new Date() })
        .where(and(eq(messages.id, ref), isNull(messages.unsubscribedAt)))
    }),

  markReported: ({ messageId, reason }) =>
    wrap(async () => {
      const column = reason === 'bounce' ? messages.bouncedAt : messages.complainedAt
      await db
        .update(messages)
        .set(reason === 'bounce' ? { bouncedAt: new Date() } : { complainedAt: new Date() })
        .where(and(eq(messages.messageId, messageId), isNull(column)))
    }),

  countMessages: (input) =>
    wrap(async () => {
      const [row] = await db
        .select({
          sent: countOf(messages.id),
          opened: countOf(sql`${messages.openedAt}`),
          bounced: countOf(sql`${messages.bouncedAt}`),
          complained: countOf(sql`${messages.complainedAt}`),
          unsubscribed: countOf(sql`${messages.unsubscribedAt}`),
        })
        .from(messages)
        .where(messageFilter(input))
      return {
        sent: Number(row?.sent),
        opened: Number(row?.opened),
        bounced: Number(row?.bounced),
        complained: Number(row?.complained),
        unsubscribed: Number(row?.unsubscribed),
      }
    }),
})
