/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * Automation Definitions Table
 *
 * Stores automation configurations (trigger, actions, retry, status).
 * Each row represents a registered automation in the system.
 */
export const automationDefinitions = systemSchema.table(
  'automation_definitions',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    label: text('label'),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    trigger: jsonb('trigger').notNull(),
    actions: jsonb('actions').notNull(),
    retry: jsonb('retry'),
    timeout: integer('timeout'),
    tags: jsonb('tags'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('automation_definitions_name_idx').on(table.name)]
)

/**
 * Automation Runs Table
 *
 * Tracks execution history of automations including status, duration, and errors.
 */
export const automationRuns = systemSchema.table(
  'automation_runs',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    triggerData: jsonb('trigger_data'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('automation_runs_automationId_idx').on(table.automationId),
    index('automation_runs_status_idx').on(table.status),
    index('automation_runs_createdAt_idx').on(table.createdAt),
  ]
)

/**
 * Automation Run Steps Table
 *
 * Per-step execution detail (input, output, duration, error) within a run.
 */
export const automationRunSteps = systemSchema.table(
  'automation_run_steps',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: text('run_id')
      .notNull()
      .references(() => automationRuns.id, { onDelete: 'cascade' }),
    actionName: text('action_name').notNull(),
    stepIndex: integer('step_index').notNull(),
    status: text('status').notNull().default('pending'),
    input: jsonb('input'),
    output: jsonb('output'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    error: text('error'),
  },
  (table) => [index('automation_run_steps_runId_idx').on(table.runId)]
)

/**
 * Automation Scheduled Jobs Table
 *
 * Tracks cron-scheduled automation next-run times.
 */
export const automationScheduledJobs = systemSchema.table(
  'automation_scheduled_jobs',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    automationId: text('automation_id')
      .notNull()
      .references(() => automationDefinitions.id, { onDelete: 'cascade' })
      .unique(),
    cronExpression: text('cron_expression').notNull(),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    enabled: boolean('enabled').notNull().default(true),
  },
  (table) => [index('automation_scheduled_jobs_nextRunAt_idx').on(table.nextRunAt)]
)

/**
 * Automation Delayed Steps Table
 *
 * Tracks paused delay actions awaiting resume time.
 */
export const automationDelayedSteps = systemSchema.table(
  'automation_delayed_steps',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: text('run_id')
      .notNull()
      .references(() => automationRuns.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    resumeAt: timestamp('resume_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('waiting'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('automation_delayed_steps_resumeAt_idx').on(table.resumeAt)]
)

/**
 * Automation Approval Requests Table
 *
 * Pending human approval requests with timeout and escalation.
 */
export const automationApprovalRequests = systemSchema.table(
  'automation_approval_requests',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: text('run_id')
      .notNull()
      .references(() => automationRuns.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    requestedById: text('requested_by_id').references(() => users.id, { onDelete: 'set null' }),
    approvedById: text('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    message: text('message'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('automation_approval_requests_runId_idx').on(table.runId),
    index('automation_approval_requests_status_idx').on(table.status),
  ]
)

// Type inference
export type AutomationDefinition = typeof automationDefinitions.$inferSelect
export type NewAutomationDefinition = typeof automationDefinitions.$inferInsert
export type AutomationRun = typeof automationRuns.$inferSelect
export type NewAutomationRun = typeof automationRuns.$inferInsert
export type AutomationRunStep = typeof automationRunSteps.$inferSelect
export type AutomationScheduledJob = typeof automationScheduledJobs.$inferSelect
export type AutomationDelayedStep = typeof automationDelayedSteps.$inferSelect
export type AutomationApprovalRequest = typeof automationApprovalRequests.$inferSelect
