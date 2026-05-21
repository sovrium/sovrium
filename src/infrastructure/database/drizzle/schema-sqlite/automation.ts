/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'


export const automationDefinitions = systemTable(
  'automation_definitions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    label: text('label'),
    description: text('description'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    trigger: text('trigger', { mode: 'json' }).notNull(),
    actions: text('actions', { mode: 'json' }).notNull(),
    retry: text('retry', { mode: 'json' }),
    timeout: integer('timeout'),
    tags: text('tags', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index('automation_definitions_name_idx').on(table.name)]
)

export const automationRuns = systemTable(
  'automation_runs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    triggerData: text('trigger_data', { mode: 'json' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    durationMs: integer('duration_ms'),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('automation_runs_automationId_idx').on(table.automationId),
    index('automation_runs_status_idx').on(table.status),
    index('automation_runs_createdAt_idx').on(table.createdAt),
  ]
)

export const automationRunSteps = systemTable(
  'automation_run_steps',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text('run_id')
      .notNull()
      .references(() => automationRuns.id, { onDelete: 'cascade' }),
    actionName: text('action_name').notNull(),
    stepIndex: integer('step_index').notNull(),
    status: text('status').notNull().default('pending'),
    input: text('input', { mode: 'json' }),
    output: text('output', { mode: 'json' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    durationMs: integer('duration_ms'),
    error: text('error'),
  },
  (table) => [index('automation_run_steps_runId_idx').on(table.runId)]
)

export const automationScheduledJobs = systemTable(
  'automation_scheduled_jobs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' })
      .unique(),
    cronExpression: text('cron_expression').notNull(),
    nextRunAt: integer('next_run_at', { mode: 'timestamp_ms' }).notNull(),
    lastRunAt: integer('last_run_at', { mode: 'timestamp_ms' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('automation_scheduled_jobs_nextRunAt_idx').on(table.nextRunAt)]
)

export const automationDelayedSteps = systemTable(
  'automation_delayed_steps',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text('run_id')
      .notNull()
      .references(() => automationRuns.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    resumeAt: integer('resume_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status').notNull().default('waiting'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('automation_delayed_steps_resumeAt_idx').on(table.resumeAt)]
)

export const automationApprovalRequests = systemTable(
  'automation_approval_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text('run_id').references(() => automationRuns.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    requestedById: text('requested_by_id').references(() => users.id, { onDelete: 'set null' }),
    approvedById: text('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    message: text('message'),
    agentName: text('agent_name'),
    actionPayload: text('action_payload', { mode: 'json' }),
    actionExecuted: integer('action_executed', { mode: 'boolean' }).notNull().default(false),
    executedAs: text('executed_as'),
    timeoutSeconds: integer('timeout_seconds'),
    escalated: integer('escalated', { mode: 'boolean' }).notNull().default(false),
    escalatedTo: text('escalated_to'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    respondedAt: integer('responded_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('automation_approval_requests_runId_idx').on(table.runId),
    index('automation_approval_requests_status_idx').on(table.status),
    index('automation_approval_requests_agentName_idx').on(table.agentName),
  ]
)

export type AutomationDefinition = typeof automationDefinitions.$inferSelect
export type NewAutomationDefinition = typeof automationDefinitions.$inferInsert
export type AutomationRun = typeof automationRuns.$inferSelect
export type NewAutomationRun = typeof automationRuns.$inferInsert
export type AutomationRunStep = typeof automationRunSteps.$inferSelect
export type AutomationScheduledJob = typeof automationScheduledJobs.$inferSelect
export type AutomationDelayedStep = typeof automationDelayedSteps.$inferSelect
export type AutomationApprovalRequest = typeof automationApprovalRequests.$inferSelect
