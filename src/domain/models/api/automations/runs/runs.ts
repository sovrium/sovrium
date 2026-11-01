/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the automation and run routes answer, beside the single run detail
 * (`runDetailSchema`) and the trigger body (`triggerResponseSchema`).
 *
 * A listed run is read from a stored row, so these schemas promise what the
 * column does and no more: one row an older engine wrote must not turn a whole
 * list into a server error. A decode strips what a schema does not name, so
 * each one names every key its route writes, in the order the route writes it.
 */

import { Schema } from 'effect'
import { describedUnknown } from '@/domain/kernel/config-parsing/described-ref'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { stepResultSchema } from '../automations'

// ─── Automation list ─────────────────────────────────────────────────────────

/** One trigger of an automation, every secret field replaced. */
const listedTriggerSchema = Schema.Record(Schema.String, Schema.Unknown).annotate({
  description:
    'A trigger as the config declares it, every secret field replaced; a cron trigger also carries its next run',
})

/**
 * `GET /api/automations`: the automations the caller's role reaches, as a bare
 * array.
 */
export const listAutomationsResponseSchema = Schema.Array(
  Schema.Struct({
    name: Schema.String.annotate({ description: 'The automation name' }),
    enabled: Schema.Boolean.annotate({
      description: 'Whether the automation runs; true unless the config says otherwise',
    }),
    trigger: optionalField(
      listedTriggerSchema.annotate({
        description: 'The first of `triggers`, secrets redacted (kept for older clients)',
      })
    ),
    triggers: Schema.Array(listedTriggerSchema).annotate({
      description: 'Every trigger that starts the automation, secrets redacted',
    }),
  })
).annotate({ description: 'The automations the caller may list' })

export type ListAutomationsResponse = typeof listAutomationsResponseSchema.Type

// ─── Run lists ───────────────────────────────────────────────────────────────

/** The fields a run row carries on every list, before its attempts and steps. */
const listedRunFields = {
  id: Schema.String.annotate({ description: 'Unique run identifier' }),
  automationName: Schema.String.annotate({
    description: 'Name of the automation that was executed',
  }),
  status: Schema.String.annotate({
    description:
      "The status the run row stores: 'queued', 'running', 'waiting-approval', 'waiting-delay', 'completed', 'completed-with-errors', 'failed', 'skipped', 'cancelled', 'rejected', 'timed-out' or 'exhausted'.",
  }),
  triggerType: Schema.String.annotate({ description: 'Trigger type that started this run' }),
  triggerName: Schema.String.annotate({
    description:
      "Name of the trigger that started this run: the trigger's own `name`, else its type. A run recorded before triggers had names reads as its automation's first trigger.",
  }),
  triggerData: optionalField(
    describedUnknown(
      'Trigger payload data, credentials and write-only values hidden; null when the reader may not read it'
    )
  ),
  startedAt: Schema.NullOr(
    Schema.String.annotate({
      description:
        'When the run left the queue and began executing (ISO 8601). Null while the run is still queued for a concurrency slot',
    })
  ),
  completedAt: Schema.NullOr(
    Schema.String.annotate({ description: 'Run completion timestamp (ISO 8601)' })
  ),
  durationMs: Schema.NullOr(
    Schema.Finite.annotate({
      description:
        'Active execution time in milliseconds, from startedAt to completion; time spent queued is excluded',
    })
  ),
  attempt: Schema.Int.annotate({ description: 'Retry attempt number (1 = first attempt)' }),
}

/** The fields that close a run row: why it stopped, and what happened to its values. */
const listedRunTailFields = {
  error: Schema.NullOr(
    Schema.String.annotate({
      description:
        'Why the run failed, or why it was skipped; null when the reader may not read every value of the run',
    })
  ),
  valuesErasedAt: optionalField(
    Schema.NullOr(
      Schema.String.annotate({
        description:
          'When the values this run captured were erased with the account of a person they named (ISO 8601); null otherwise. Steps, statuses and timings are kept.',
      })
    )
  ),
  resumeAt: optionalField(
    Schema.NullOr(
      Schema.String.annotate({
        description:
          'While the run is waiting-delay: when it resumes (ISO 8601, UTC), within about a minute. Null otherwise.',
      })
    )
  ),
}

/** One run of `GET /api/automations/runs`. */
const listedRunSchema = Schema.Struct({ ...listedRunFields, ...listedRunTailFields }).annotate({
  identifier: 'ListedAutomationRun',
  description: 'One run as a list shows it: no steps',
})

/**
 * `GET /api/automations/runs`. `pagination` is present when the request sent
 * `pageSize`, and absent otherwise.
 */
export const listRunsResponseSchema = Schema.Struct({
  runs: Schema.Array(listedRunSchema).annotate({
    description: 'The runs the caller may read, newest first',
  }),
  pagination: optionalField(
    Schema.Struct({
      page: Schema.Finite.annotate({ description: 'Current page number' }),
      pageSize: Schema.Finite.annotate({ description: 'Items per page' }),
      total: Schema.Int.annotate({ description: 'Total count of matching runs' }),
      totalPages: Schema.Finite.annotate({ description: 'Total number of pages, at least 1' }),
    }).annotate({ description: 'Pagination metadata, present when `pageSize` was sent' })
  ),
})

export type ListRunsResponse = typeof listRunsResponseSchema.Type

/**
 * `GET /api/automations/:name/runs`: every run of one automation with its
 * steps, newest first, as a bare array.
 */
export const listRunsByNameResponseSchema = Schema.Array(
  Schema.Struct({
    ...listedRunFields,
    attempts: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)).annotate({
      description:
        'Attempt history of the last step that ran under a retry policy, oldest first. Empty when no step was retried.',
    }),
    ...listedRunTailFields,
    steps: Schema.Array(stepResultSchema).annotate({
      description: 'Step-by-step execution results',
    }),
  })
).annotate({ description: 'The runs of this automation the caller may read' })

/** @public */
export type ListRunsByNameResponse = typeof listRunsByNameResponseSchema.Type

// ─── Run control ─────────────────────────────────────────────────────────────

/** `POST /api/automations/runs/:id/cancel`. */
export const cancelRunResponseSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Run ID' }),
  status: Schema.Literal('cancelled').annotate({ description: 'New status' }),
})

export type CancelRunResponse = typeof cancelRunResponseSchema.Type

/**
 * `POST /api/automations/runs/:id/replay`: the replay command was honoured.
 * The new run may already have finished when this answers; read it by `id`.
 */
export const replayRunAcceptedResponseSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'ID of the new run' }),
  runId: Schema.String.annotate({ description: 'The same ID, under its other name' }),
  status: Schema.Literal('accepted').annotate({
    description: 'The replay was accepted; the status of the run is read from the runs API',
  }),
})

export type ReplayRunAcceptedResponse = typeof replayRunAcceptedResponseSchema.Type

/** `POST /api/automations/runs/:runId/approvals/:approvalId/{approve,reject}`. */
export const resolveApprovalResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'The request was resolved' }),
  runId: Schema.String.annotate({ description: 'ID of the run the request paused' }),
  approvalId: Schema.String.annotate({ description: 'ID of the approval request' }),
  status: Schema.Literals(['approved', 'rejected']).annotate({
    description: 'approved: the run resumed; rejected: the run was terminated',
  }),
})

export type ResolveApprovalResponse = typeof resolveApprovalResponseSchema.Type
