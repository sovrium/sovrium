/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * Audit-log severity classification.
 *
 * Operators filter the audit log by severity to focus on what matters during
 * triage. Severity is determined at write-time by the emitter:
 *
 * - `debug`    — verbose tracing, off by default in production
 * - `info`     — normal successful operations (record.created, session.created)
 * - `warning`  — recoverable failures (webhook delivery retried, AI budget at 80%)
 * - `error`    — failed operations (run.failed, delivery.dead-lettered)
 * - `critical` — security/compliance events (PII reveal, role escalation, banned-user
 *                login attempt, AI budget exceeded with hard cap)
 *
 * Severity is independent of HTTP status — a 200 OK can still emit a `critical`
 * audit entry if the action is sensitive (e.g. body reveal).
 */
export const severitySchema = z
  .enum(['debug', 'info', 'warning', 'error', 'critical'])
  .describe('Severity classification used for filtering and alerting')

/** @public */
export type Severity = z.infer<typeof severitySchema>
