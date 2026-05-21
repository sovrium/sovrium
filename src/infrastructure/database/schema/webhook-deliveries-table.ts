/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'

const WEBHOOK_DELIVERIES_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "public"."_webhook_deliveries" (
  "id" SERIAL PRIMARY KEY,
  "webhook_name" TEXT NOT NULL,
  "table_name" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "request_headers" JSONB,
  "status" TEXT NOT NULL,
  "http_status" INTEGER,
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "retry_strategy" TEXT,
  "error" TEXT,
  "response_body" TEXT,
  "duration_ms" INTEGER NOT NULL DEFAULT 0,
  "is_test" BOOLEAN NOT NULL DEFAULT FALSE,
  "requested_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

const WEBHOOK_DELIVERIES_INDEX_NAME = `
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_webhook_name"
  ON "public"."_webhook_deliveries" ("webhook_name")
`.trim()

export const ensureWebhookDeliveriesTable = (
  tx: TransactionLike
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    yield* executeSQL(tx, WEBHOOK_DELIVERIES_TABLE_DDL)
    yield* executeSQL(tx, WEBHOOK_DELIVERIES_INDEX_NAME)
  })
