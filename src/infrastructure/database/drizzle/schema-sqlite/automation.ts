/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * Automation tables — sqlite-core mirror of `schema/automation.ts`.
 */

/**
 * Automation Definitions Table
 *
 * Stores automation configurations (trigger, actions, retry, status).
 * Each row represents a registered automation in the system.
 */
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

/**
 * Automation Pauses Table
 *
 * sqlite-core mirror of `schema/automation.ts` → `automationPauses`. See that
 * file for the full rationale (why the pause is name-keyed, in its own table,
 * and not a column on `automation_definitions` nor a runtime write to the
 * config's `automations[].enabled`).
 *
 * The two dialect trees are kept in sync BY HAND — there is no parity test —
 * so any change here must be mirrored there in the same commit, with a new
 * incremental migration generated for BOTH dialects.
 */
export const automationPauses = systemTable(
  'automation_pauses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** UNIQUE — see the Postgres mirror: it is what makes "pause twice" idempotent. */
    automationName: text('automation_name').notNull().unique(),
    pausedByUserId: text('paused_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    pausedAt: integer('paused_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    /**
     * Why the automation is paused. `NULL` is a pause an operator set from the
     * console; `'consecutive-failures'` is a pause the platform set itself after
     * the automation's last N final failures in a row
     * (`SOVRIUM_AUTOMATION_AUTOPAUSE`). A column of its own rather than a NULL
     * `paused_by_user_id`, which already means "that operator was deleted".
     */
    reason: text('reason'),
  },
  (table) => [index('automation_pauses_automationName_idx').on(table.automationName)]
)

/**
 * Automation Runs Table
 *
 * Tracks execution history of automations including status, duration, and errors.
 */
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
    /**
     * The user whose action caused this run, or SQL NULL when the system
     * caused it (cron, `automation:call`). Never the empty string and never a
     * sentinel, so `WHERE triggered_by_user_id IS NULL` is the whole of the
     * system-initiated predicate.
     *
     * `ON DELETE SET NULL` mirrors `automation_approval_requests.requested_by_id`
     * and `audit_log.actor_id`: erasing a user sheds the identifier while the
     * run history itself survives (GDPR Art. 17).
     */
    triggeredByUserId: text('triggered_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /**
     * Whether a person started this run by hand (a manual trigger, a table
     * button, an MCP action template or automation tool, the chat). Its record
     * actions then write as `triggered_by_user_id`, and a run that pauses on an
     * approval resumes the same way. A hand-started run whose caller was since
     * erased (the id set to NULL) resumes writing nothing.
     */
    startedByHand: integer('started_by_hand', { mode: 'boolean' }).notNull().default(false),
    /**
     * The name of the trigger entry that started the run (its own `name`, else
     * its type). NULL for a run recorded before an automation could declare
     * several triggers: it reads as its automation's first trigger.
     */
    triggerName: text('trigger_name'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    durationMs: integer('duration_ms'),
    error: text('error'),
    /**
     * The run that handed this one its trigger data — a call's caller, a
     * failure handler's failed run — and how many of its steps had run when it
     * did, as `{ run, through }`; `{ outside: true }` for a replay an admin
     * supplied new trigger data for. Ids only, never a value: who may read the
     * relayed data is judged at read time by what that run had read. NULL for
     * every other run, and for a call or failure run recorded before 0.30.0.
     */
    relay: text('relay', { mode: 'json' }),
    /**
     * While the run waits on a long delay (`waiting-delay`): the instant it
     * resumes at, and where it paused — one frame per level of loop and path
     * nesting, the last one the wait step. Both NULL once the run moves on.
     */
    resumeAt: integer('resume_at', { mode: 'timestamp_ms' }),
    resumeCursor: text('resume_cursor', { mode: 'json' }),
    /**
     * When the values this run captured were erased with the account of a
     * person they named: trigger data, step inputs, outputs, errors and logs,
     * and the run's own error emptied; steps, statuses and timings kept. NULL
     * otherwise.
     */
    valuesErasedAt: integer('values_erased_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('automation_runs_automationId_idx').on(table.automationId),
    index('automation_runs_status_idx').on(table.status),
    index('automation_runs_createdAt_idx').on(table.createdAt),
    index('automation_runs_triggeredByUserId_idx').on(table.triggeredByUserId),
    index('automation_runs_status_resumeAt_idx').on(table.status, table.resumeAt),
  ]
)

/**
 * Automation Run Steps Table
 *
 * Per-step execution detail (input, output, duration, error) within a run.
 */
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
    /** `context.log` entries a code step wrote, redacted, in call order. */
    logs: text('logs', { mode: 'json' }),
    /**
     * What a step read as it ran, when that is recorded rather than classified
     * from its declaration: the actions a script called (each classified at the
     * sandbox's dispatch), the run a synchronous call started, the records an
     * agent's tool calls named. NULL for every other step.
     */
    reads: text('reads', { mode: 'json' }),
    /** A path or loop step's paths or items, each with the steps run inside, masked. */
    nested: text('nested', { mode: 'json' }),
  },
  (table) => [index('automation_run_steps_runId_idx').on(table.runId)]
)

/**
 * Automation Run Refs Table
 *
 * Which records each run read, by id — never a value: a record trigger's
 * captured record and the rows it links, a record step's records, an agent's
 * tool calls, a script's calls, and what a synchronous call's run read. Erasing
 * an account scrubs exactly the runs that read one of its records, a record
 * naming it, or a record removed with its own. `record_id` is `'*'` when a run
 * read a whole table, or read more than the per-run cap; a row with an empty
 * `table_name` marks a run recorded before runs kept refs.
 */
export const automationRunRefs = systemTable(
  'automation_run_refs',
  {
    runId: text('run_id')
      .notNull()
      .references(() => automationRuns.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.tableName, table.recordId] }),
    index('automation_run_refs_record_idx').on(table.tableName, table.recordId),
  ]
)

/**
 * Automation Scheduled Jobs Table
 *
 * Tracks cron-scheduled automation next-run times.
 * @public Live schema, reached only by drizzle-kit through the string path in
 * `drizzle.config.ts` — a consumer no TypeScript import can express. It has no
 * TS importer because no dialect-branching caller needs the SQLite object yet.
 * Deleting it would drop the table from the next generated SQLite migration.
 */
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

/**
 * Automation Delayed Steps Table
 *
 * Tracks paused delay actions awaiting resume time.
 * @public Live schema, reached only by drizzle-kit through the string path in
 * `drizzle.config.ts` — a consumer no TypeScript import can express. It has no
 * TS importer because no dialect-branching caller needs the SQLite object yet.
 * Deleting it would drop the table from the next generated SQLite migration.
 */
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

/**
 * Automation Approval Requests Table
 *
 * Pending human approval requests with timeout and escalation. Used both by
 * automation steps (where `runId` references an automation run) and by AI
 * agent action approvals (where `runId` is null and `agentName` identifies
 * the requesting agent). The `stepIndex` column is 0 for agent approvals.
 */
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
    /**
     * Who may resolve an automation-step request, as rendered when it was
     * created: the string `all-admins` or an array of emails and role names.
     * Null for agent approvals and for requests recorded before the column
     * existed, both of which read as `all-admins`.
     */
    approvers: text('approvers', { mode: 'json' }),
    /** Agent name when this approval is for an AI agent action (null for automation steps) */
    agentName: text('agent_name'),
    /** JSON-encoded agent action descriptor (action, table, recordId, fields) */
    actionPayload: text('action_payload', { mode: 'json' }),
    /** True once the underlying action has been executed */
    actionExecuted: integer('action_executed', { mode: 'boolean' }).notNull().default(false),
    /** Identity the action executed as (the agent name) */
    executedAs: text('executed_as'),
    /** Approval timeout in seconds */
    timeoutSeconds: integer('timeout_seconds'),
    /** True once the request has been escalated */
    escalated: integer('escalated', { mode: 'boolean' }).notNull().default(false),
    /** Role the request was escalated to */
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

// Type inference
