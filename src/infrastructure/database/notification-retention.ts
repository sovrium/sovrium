/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { retentionDaysOf } from '@/domain/models/app/notifications/notifications-service'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { notifications as notificationsPg } from '@/infrastructure/database/drizzle/schema/notifications'
import { notifications as notificationsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/notifications'
import type { App } from '@/domain/models/app'

/** One day, in milliseconds. */
const DAY_MS = 86_400_000

/**
 * Delete, for good, the notifications past `notifications.retention.days` (90
 * by default): the ones read more than that many days ago, and the ones kept
 * for the digest alone — never listed, so never read — created more than that
 * many days ago. A notification she lists and has not read is never deleted.
 * Answers how many it deletes; an app without notifications deletes none.
 */
export const purgeReadNotifications = async (app: Pick<App, 'notifications'>): Promise<number> => {
  if (app.notifications === undefined) return 0
  const notifications = resolveDialectSchema(notificationsPg, notificationsSqlite)
  const cutoff = new Date(Date.now() - retentionDaysOf(app.notifications) * DAY_MS)
  const readLongAgo = and(isNotNull(notifications.readAt), lt(notifications.readAt, cutoff))
  const digestOnlyLongAgo = and(
    eq(notifications.inApp, false),
    eq(notifications.digest, true),
    isNull(notifications.readAt),
    lt(notifications.createdAt, cutoff)
  )
  const deleted = await db
    .delete(notifications)
    .where(or(readLongAgo, digestOnlyLongAgo))
    .returning({ id: notifications.id })
  return deleted.length
}
