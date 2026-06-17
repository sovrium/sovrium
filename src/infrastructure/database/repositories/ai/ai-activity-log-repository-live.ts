/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import {
  AiActivityLogDatabaseError,
  AiActivityLogRepository,
} from '@/application/ports/repositories/ai/ai-activity-log-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { aiActivityLogs as aiActivityLogsPg } from '@/infrastructure/database/drizzle/schema/ai'
import { aiActivityLogs as aiActivityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const aiActivityLogs = resolveDialectSchema(aiActivityLogsPg, aiActivityLogsSqlite)

const wrap = makeDbWrap((cause) => new AiActivityLogDatabaseError({ cause }))

export const AiActivityLogRepositoryLive = Layer.succeed(AiActivityLogRepository, {
  append: (row) =>
    wrap(() =>
      db
        .insert(aiActivityLogs)
        .values({
          actorType: row.actorType,
          actorName: row.actorName,
          action: row.action,
          targetTable: row.targetTable,
          userEmail: row.userEmail,
        })
        .then(() => undefined)
    ),
})
