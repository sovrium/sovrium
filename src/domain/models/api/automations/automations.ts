/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coercedNumber } from '@/domain/models/api/combinators/coerce'
import { describedUnknown } from '@/domain/models/api/combinators/described-ref'
import { looseIsoDateTime, uuid } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ─── Run Status ──────────────────────────────────────────────────────────────

/**
 * Every status a run row can carry.
 *
 * `queued` (waiting for a concurrency slot), `waiting-approval` (paused on
 * an approval step) and `waiting-delay` (parked on a long wait until its
 * `resumeAt`) are written by the engine, so the list must admit them:
 * a run in either state would otherwise fail to encode and turn the whole
 * runs listing into a server error.
 *
 * `rejected` is written when an approval step's request is rejected and the
 * run stops there; like the two above, a rejected run must decode or its
 * detail and every listing holding it answer a server error.
 *
 * `pending` and `retrying` are never written by the engine. They stay in the
 * list for API compatibility, so a client that switches on them keeps
 * compiling.
 */
export const runStatusSchema = Schema.Literals([
  'pending',
  'queued',
  'running',
  'waiting-approval',
  'waiting-delay',
  'completed',
  'failed',
  'skipped',
  'cancelled',
  'rejected',
  'retrying',
  'timed-out',
  'exhausted',
  'completed-with-errors',
]).annotate({
  description:
    "Automation run status. 'queued' waits for a concurrency slot, 'waiting-approval' waits on an approval step and 'waiting-delay' waits on a delay longer than one minute until its resumeAt. 'rejected' is written when an approval step's request is rejected and the run stops there. 'pending' and 'retrying' are never written by the engine and are kept for API compatibility.",
})

export type RunStatus = typeof runStatusSchema.Type

// ─── Step Result ─────────────────────────────────────────────────────────────

export const stepLogEntrySchema = Schema.Struct({
  level: Schema.Literals(['debug', 'info', 'warn', 'error']).annotate({
    description: 'Level the code action logged at (context.log.debug, info, warn or error)',
  }),
  message: Schema.String.annotate({
    description: 'The logged arguments joined with spaces, cut at 2 000 characters',
  }),
}).annotate({ description: 'One entry a code action wrote with context.log' })

/**
 * The fields every recorded step carries, at the top level of a run and
 * inside a path or a loop alike.
 */
const stepResultBaseSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Action step name' }),
  type: Schema.String.annotate({ description: 'Action type (code, http, record, etc.)' }),
  status: Schema.Literals([
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'filtered',
    'waiting',
  ]).annotate({
    description:
      'Step execution status (filtered = intentionally stopped by filter action; waiting = a loop or a path the run is parked inside, completed when it resumes)',
  }),
  startedAt: Schema.NullOr(looseIsoDateTime({ description: 'Step start timestamp' })),
  completedAt: Schema.NullOr(looseIsoDateTime({ description: 'Step completion timestamp' })),
  durationMs: Schema.NullOr(
    Schema.Int.annotate({ description: 'Step execution duration in milliseconds' })
  ),
  output: optionalField(describedUnknown('Step output data (null if failed or pending)')),
  error: Schema.NullOr(Schema.String.annotate({ description: 'Error message if step failed' })),
  logs: optionalField(
    Schema.Array(stepLogEntrySchema).annotate({
      description:
        "Entries a code action wrote with context.log, in call order, with the app's secrets masked. Absent for steps that log nothing.",
    })
  ),
})

type StepResultBase = typeof stepResultBaseSchema.Type

/** One path a `path/branch` step ran, with the steps executed inside it. */
export interface StepPathRun {
  readonly name: string
  readonly steps: readonly StepResult[]
}

/** One item a `loop/each` step ran, with the steps executed for it. */
export interface StepIterationRun {
  readonly index: number
  readonly steps: readonly StepResult[]
}

/**
 * A recorded step. A `path/branch` step also carries the paths it ran and a
 * `loop/each` step the items it ran, each with the steps executed inside —
 * recorded, and masked, exactly like the run's top-level steps, so a failure
 * deep inside a branch is readable from the run detail alone.
 */
export interface StepResult extends StepResultBase {
  readonly paths?: readonly StepPathRun[] | undefined
  readonly iterations?: readonly StepIterationRun[] | undefined
}

// The explicit annotation is what makes the recursion typeable, and the
// `identifier` is what turns it into a `$ref` cycle in the OpenAPI document
// instead of an endless inline walk (see `viewFilterNodeResponseSchema`).
export const stepResultSchema: Schema.Codec<StepResult> = Schema.suspend(
  (): Schema.Codec<StepResult> =>
    Schema.Struct({
      ...stepResultBaseSchema.fields,
      paths: optionalField(
        Schema.Array(
          Schema.Struct({
            name: Schema.String.annotate({ description: 'Name of the path that ran' }),
            steps: Schema.Array(stepResultSchema).annotate({
              description: 'The steps executed inside this path, in the order they ran',
            }),
          }).annotate({ description: 'One path a path/branch step ran' })
        ).annotate({
          description:
            'Present on a path/branch step: each path it ran, in the order it ran them, with the steps executed inside. Absent on other steps.',
        })
      ),
      iterations: optionalField(
        Schema.Array(
          Schema.Struct({
            index: Schema.Int.annotate({ description: 'Zero-based position of the item' }),
            steps: Schema.Array(stepResultSchema).annotate({
              description: 'The steps executed for this item, in the order they ran',
            }),
          }).annotate({ description: 'One item a loop/each step ran' })
        ).annotate({
          description:
            'Present on a loop/each step: each item it ran, in order, with the steps executed for it. Absent on other steps.',
        })
      ),
    }) as never
).annotate({ identifier: 'AutomationRunStep', description: 'One recorded step of a run' })

// ─── Run Schema ──────────────────────────────────────────────────────────────

export const runSchema = Schema.Struct({
  id: uuid({ description: 'Unique run identifier' }),
  automationName: Schema.String.annotate({
    description: 'Name of the automation that was executed',
  }),
  status: runStatusSchema,
  triggerType: Schema.String.annotate({ description: 'Trigger type that started this run' }),
  triggerName: Schema.String.annotate({
    description:
      "Name of the trigger that started this run: the trigger's own `name`, else its type. A run recorded before triggers had names reads as its automation's first trigger.",
  }),
  triggerData: optionalField(describedUnknown('Trigger payload data')),
  startedAt: Schema.NullOr(
    looseIsoDateTime({
      description:
        'When the run left the queue and began executing. Null while the run is still queued for a concurrency slot',
    })
  ),
  completedAt: Schema.NullOr(looseIsoDateTime({ description: 'Run completion timestamp' })),
  durationMs: Schema.NullOr(
    Schema.Int.annotate({
      description:
        'Active execution time in milliseconds, from startedAt to completion — time spent queued is excluded',
    })
  ),
  attempt: Schema.Int.annotate({ description: 'Retry attempt number (1 = first attempt)' }),
  error: Schema.NullOr(
    Schema.String.annotate({ description: 'Top-level error message if run failed' })
  ),
  valuesErasedAt: optionalField(
    Schema.NullOr(
      looseIsoDateTime({
        description:
          'When the values this run captured were erased with the account of a person they named (ISO 8601); null otherwise. Steps, statuses and timings are kept.',
      })
    )
  ),
  resumeAt: optionalField(
    Schema.NullOr(
      looseIsoDateTime({
        description:
          'While the run is waiting-delay: when it resumes (ISO 8601, UTC), within about a minute. Null otherwise.',
      })
    )
  ),
})

export type Run = typeof runSchema.Type

// ─── Run Detail Schema ───────────────────────────────────────────────────────

const runAttemptSchema = Schema.Struct({
  attemptNumber: Schema.Int.annotate({ description: 'Attempt number, 1 for the first try' }),
  timestamp: looseIsoDateTime({ description: 'When the attempt settled' }),
  error: optionalField(
    Schema.String.annotate({ description: 'Why the attempt failed, with secrets masked' })
  ),
}).annotate({ description: 'One attempt of a step retried under a retry policy' })

export const runDetailSchema = Schema.Struct({
  ...runSchema.fields,
  attempts: Schema.Array(runAttemptSchema).annotate({
    description:
      'Attempt history of the last step that ran under a retry policy, oldest first. Empty when no step was retried.',
  }),
  steps: Schema.Array(stepResultSchema).annotate({ description: 'Step-by-step execution results' }),
  approvalId: optionalField(
    Schema.NullOr(
      uuid({
        description:
          'Id of the approval request this run is waiting on, to post to its approve or reject endpoint. Null when the run has no approval step.',
      })
    )
  ),
})

export type RunDetail = typeof runDetailSchema.Type

// ─── Automation Approvals ────────────────────────────────────────────────────

/** Every status an automation approval request can carry. */
const approvalStatusSchema = Schema.Literals(['pending', 'approved', 'rejected']).annotate({
  description:
    'pending: waiting for an approver; approved: the run resumed; rejected: the run was terminated',
})

/**
 * One automation approval request, as `GET /api/automations/approvals` lists it.
 *
 * Carries the two ids the resolution endpoint
 * `POST /api/automations/runs/:runId/approvals/:approvalId/{approve,reject}`
 * needs, so a page can post to it from a row.
 */
export const automationApprovalSchema = Schema.Struct({
  approvalId: uuid({ description: 'Id of the approval request' }),
  runId: uuid({ description: 'Id of the run paused on this request' }),
  automationName: Schema.String.annotate({
    description: 'Name of the automation whose run is paused',
  }),
  status: approvalStatusSchema,
  message: Schema.NullOr(
    Schema.String.annotate({
      description:
        "The request's message as shown to approvers, templates rendered; null when the reader may not read what fed it.",
    })
  ),
  approvers: Schema.Union([
    Schema.Literal('all-admins'),
    Schema.Array(Schema.String.annotate({ description: 'An email address or a role name' })),
  ]).annotate({
    description:
      'Who may resolve the request: all-admins, or the email addresses and role names it names, as rendered when the request was created',
  }),
  requestedAt: looseIsoDateTime({ description: 'When the request was created' }),
  expiresAt: Schema.NullOr(
    looseIsoDateTime({ description: 'When the timeout fires. Null when the request has none' })
  ),
  resolvedAt: Schema.NullOr(
    looseIsoDateTime({ description: 'When an approver resolved it. Null while pending' })
  ),
})

export type AutomationApproval = typeof automationApprovalSchema.Type

/**
 * Query string of `GET /api/automations/approvals`.
 */
export const listAutomationApprovalsQuerySchema = Schema.Struct({
  status: optionalField(
    approvalStatusSchema.annotate({
      description: 'Which requests to list (default: pending)',
    })
  ),
})

export type ListAutomationApprovalsQuery = typeof listAutomationApprovalsQuerySchema.Type

/**
 * Response of `GET /api/automations/approvals`: only the requests the caller
 * may resolve, newest first.
 */
export const listAutomationApprovalsResponseSchema = Schema.Struct({
  approvals: Schema.Array(automationApprovalSchema).annotate({
    description: 'The approval requests the signed-in caller may resolve, newest first',
  }),
})

export type ListAutomationApprovalsResponse = typeof listAutomationApprovalsResponseSchema.Type

// ─── List Runs Response ──────────────────────────────────────────────────────

/**
 * Forward-looking shape for `GET /api/automations/runs` — declares the
 * paginated response we WILL ship once the runs listing supports paging.
 *
 * Drift note: the live route handler
 * (`routes/automations/index.ts:handleListRuns`) currently emits
 * `{ runs: [...] }` without a `pagination` envelope. Pagination wiring is
 * tracked separately and will land alongside the `?page` / `?pageSize`
 * query params already declared in `listRunsQuerySchema` below.
 *
 * Until that lands, callers should treat `pagination` as forward-compatible
 * documentation and not rely on it at runtime. Once pagination ships, the
 * route will start emitting the `pagination` envelope and this schema will
 * become consumable for OpenAPI validation.
 */
export const listRunsResponseSchema = Schema.Struct({
  runs: Schema.Array(runSchema).annotate({ description: 'List of automation runs' }),
  pagination: optionalField(
    Schema.Struct({
      total: Schema.Int.annotate({ description: 'Total count of matching runs' }),
      page: Schema.Int.annotate({ description: 'Current page number' }),
      pageSize: Schema.Int.annotate({ description: 'Items per page' }),
      totalPages: Schema.Int.annotate({ description: 'Total number of pages' }),
    }).annotate({
      description:
        'Pagination metadata. Currently optional (forward-looking): the live route omits this envelope until pagination wiring lands. Will become required once `?page`/`?pageSize` query params are honored.',
    })
  ),
})

export type ListRunsResponse = typeof listRunsResponseSchema.Type

// ─── List Runs Query Params ──────────────────────────────────────────────────

export const listRunsQuerySchema = Schema.Struct({
  automationName: optionalField(
    Schema.String.annotate({ description: 'Filter by automation name' })
  ),
  status: optionalField(runStatusSchema.annotate({ description: 'Filter by run status' })),
  triggerName: optionalField(
    Schema.String.annotate({
      description: 'Filter by the name of the trigger that started the run (its type when unnamed)',
    })
  ),
  page: optionalField(
    coercedNumber
      .annotate({ description: 'Page number (default: 1)' })
      .pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)))
  ),
  pageSize: optionalField(
    coercedNumber
      .annotate({ description: 'Items per page (default: 20)' })
      .pipe(
        Schema.check(
          Schema.isInt(),
          Schema.isGreaterThanOrEqualTo(1),
          Schema.isLessThanOrEqualTo(100)
        )
      )
  ),
})

export type ListRunsQuery = typeof listRunsQuerySchema.Type

// ─── Replay Run Request ──────────────────────────────────────────────────────

export const replayRunRequestSchema = Schema.Struct({
  /** Override trigger data for replay (optional — uses original if omitted) */
  triggerData: optionalField(describedUnknown('Override trigger data for replay')),
  /** Step name to re-run from (optional — skips already-succeeded steps before this point) */
  fromStep: optionalField(
    Schema.String.annotate({
      description:
        'Step name to re-run from. Steps before this that succeeded are skipped. If omitted, re-runs from first failed step.',
    })
  ),
})

export type ReplayRunRequest = typeof replayRunRequestSchema.Type

// ─── Trigger Response ────────────────────────────────────────────────────────

/**
 * The status a run is answered with, on the webhook and on the manual
 * trigger alike. `completed` is a clean run; `completed-with-errors` a run
 * that kept going past a step declaring `continueOnError`; `skipped`,
 * `cancelled` and `waiting-approval` (a run paused on an approval request)
 * surface verbatim; every engine-internal failure label (failure, exhausted,
 * timed-out) collapses to `failed`.
 */
export const publicRunStatusSchema = Schema.Literals([
  'completed',
  'completed-with-errors',
  'failed',
  'skipped',
  'cancelled',
  'waiting-approval',
  'waiting-delay',
]).annotate({
  description:
    'Run status. `completed` = every action succeeded; `completed-with-errors` = an action failed under `continueOnError` and the run went on; `failed` = an action failed and the run stopped (the run still records); `skipped`, `cancelled`, `waiting-approval` (paused on an approval request) and `waiting-delay` (parked on a wait longer than one minute) surface as such.',
})

export type PublicRunStatus = typeof publicRunStatusSchema.Type

/**
 * Default synchronous body of `/api/automations/:name/webhook`: the run's id
 * and status, and nothing the run read.
 *
 * A webhook's caller is whoever holds its URL — usually a third-party service
 * signed in to nothing — so the default answer names the run and never carries
 * a step's output or error. An author who wants data returned declares it with
 * a `webhook/response` action (or `trigger.response`), which replaces this body
 * entirely. The key list lives HERE: the handler builds a value of
 * {@link WebhookDefaultResponse}, so adding or removing a key is one edit.
 */
export const webhookDefaultResponseSchema = Schema.Struct({
  id: uuid({ description: 'ID of the created run (matches runs API)' }),
  status: publicRunStatusSchema,
})

export type WebhookDefaultResponse = typeof webhookDefaultResponseSchema.Type

/**
 * Response body of the MANUAL trigger, `POST /api/automations/:name/trigger`
 * (and of a replay). It differs from the webhook's default answer
 * ({@link webhookDefaultResponseSchema}) on purpose: the manual trigger's caller
 * is signed in, started the run herself, and every step's reach is intersected
 * with hers, so the run can hand her back its last output.
 *
 * the last-action-output webhook response rule: the response surfaces only the **last
 * action's output** as `output`, mirroring n8n's "When Last Node Finishes"
 * mode. Per-action visibility lives at the runs detail endpoint
 * (`GET /api/automations/runs/:id` → `runDetailSchema.steps[]`).
 *
 * Exported for documentation / OpenAPI — the route handler does not validate
 * against this schema.
 */
export const triggerResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({
    description: 'Run was dispatched (downstream failures still produce true)',
  }),
  id: uuid({ description: 'ID of the created run (matches runs API)' }),
  status: publicRunStatusSchema,
  output: optionalField(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'Output of the last action that produced non-empty output (n8n parity). Walks the executed-step list from the tail and returns the first `outcome.output` it finds — actions emitting nothing (filter, stop, state:set without return) are skipped over. Omitted when no action produced output. For per-action breakdown, call `GET /api/automations/runs/:id`.',
    })
  ),
  error: optionalField(
    Schema.String.annotate({
      description:
        'First action failure reason (already redacted by the secrets-redaction layer). Present only when `status === "failed"`. Surfaced inline so callers can distinguish auth failures from upstream HTTP errors without a follow-up GET to the runs endpoint.',
    })
  ),
})

export type TriggerResponse = typeof triggerResponseSchema.Type

// ─── Cancel Run Response ─────────────────────────────────────────────────────

export const cancelRunResponseSchema = Schema.Struct({
  id: uuid({ description: 'Run ID' }),
  status: Schema.Literal('cancelled').annotate({ description: 'New status' }),
  cancelledAt: looseIsoDateTime({ description: 'Cancellation timestamp' }),
})

export type CancelRunResponse = typeof cancelRunResponseSchema.Type

// ─── Deploy Intake (sovrium deploy ↔ a Sovrium Cloud app) ────────────────────

/**
 * The deploy contract `sovrium deploy` speaks to a hosting app.
 *
 * No route of the engine serves it: the host is an ordinary Sovrium app whose
 * config declares the intake, so every endpoint is one the engine already
 * ships. The contract fixes the SHAPES both sides agree on:
 *
 * 1. the archive is uploaded first, to the host's `deployments` bucket
 *    (`POST /api/buckets/deployments/files`, multipart, `application/gzip`);
 * 2. then a small request is posted to the host's `deploy` webhook
 *    (`POST /api/automations/deploy/webhook`, `auth: { type: session }`) —
 *    {@link deployRequestSchema}, with an `Idempotency-Key` header — and the
 *    webhook answers {@link deployResponseSchema};
 * 3. progress is read from the host's `deployments` table
 *    (`GET /api/tables/deployments/records/:id`), whose `fields` carry
 *    {@link deploymentRecordFieldsSchema}.
 *
 * Every call carries the user's API key as `x-api-key`. The bundle itself never
 * travels in a webhook body: a body is persisted with the run.
 */

const DEPLOY_SHA256_HEX = /^[0-9a-f]{64}$/

const deploySha256 = (description: string) =>
  Schema.String.annotate({ description }).check(Schema.isPattern(DEPLOY_SHA256_HEX))

/**
 * Every state a deployment moves through, in order, plus `failed`.
 * `waking-up` is the host starting the app's process after the switch: a cold
 * start takes a few seconds, and the CLI says so rather than looking stuck.
 *
 * @public
 */
export const deploymentStatusValues = [
  'queued',
  'validating',
  'applying',
  'waking-up',
  'live',
  'failed',
] as const

export const deploymentStatusSchema = Schema.Literals(deploymentStatusValues).annotate({
  description:
    "Where the deployment stands: 'queued' (recorded, not started), 'validating' (the host checks the archive and its config), 'applying' (the new revision is being switched in), 'waking-up' (the app is starting), 'live' (serving), or 'failed' (stopped; see report)",
})

/** @public */
export type DeploymentStatus = Schema.Schema.Type<typeof deploymentStatusSchema>

/**
 * Body of the deploy webhook call, posted after the archive is stored.
 *
 * Sent with the header `Idempotency-Key`: the lowercase hex sha256 of the
 * target app slug, a newline, and the bundle manifest serialised without its
 * `createdAt` — so deploying unchanged content to the same app twice is
 * recognised as the same deployment, whenever the archive was written.
 *
 * @public
 */
export const deployRequestSchema = Schema.Struct({
  app: Schema.String.annotate({
    description:
      "Slug of the hosted app to deploy to (the CLI's --app): 2 to 28 lowercase letters, digits and '-', starting and ending with a letter or digit. 28 is the longest name the host can run: each app runs as the system user sa-<slug>, and a system user name is at most 31 characters",
  }).check(Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,26}[a-z0-9]$/)),
  objectKey: Schema.String.annotate({
    description: "Key the host's deployments bucket returned when the archive was uploaded",
  }).check(Schema.isMinLength(1)),
  sha256: deploySha256('Lowercase hex SHA-256 of the uploaded archive bytes'),
  configHash: deploySha256(
    "The bundle manifest's configHash: lowercase hex SHA-256 of project/app.json"
  ),
  engineVersion: Schema.String.annotate({
    description:
      "The bundle manifest's engine.minVersion: the version of the engine that validated the config",
  }).check(Schema.isPattern(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)),
  manifest: Schema.String.annotate({
    description:
      "The exact UTF-8 text of the archive's manifest.json, byte for byte as it sits in the archive. The host signs these bytes for the machine that applies the release, which verifies a detached signature over them, so the text is sent as is rather than re-serialised: two serialisations of the same manifest need not be the same bytes",
  }).check(Schema.isMinLength(1)),
})

/** @public */
export type DeployRequest = Schema.Schema.Type<typeof deployRequestSchema>

/**
 * The deploy webhook's answer: 201 for a deployment it just recorded, 200 with
 * `replayed: true` for a known `Idempotency-Key` — the deployment recorded the
 * first time, unchanged.
 *
 * @public
 */
export const deployResponseSchema = Schema.Struct({
  deploymentId: Schema.String.annotate({
    description:
      'Id of the deployment record; also its revision, and the id read back at GET /api/tables/deployments/records/:id',
  }).check(Schema.isMinLength(1)),
  status: deploymentStatusSchema,
  url: Schema.String.annotate({
    description: 'Address the app is served at once the deployment is live',
  }),
  replayed: Schema.Boolean.annotate({
    description:
      'true when the Idempotency-Key was already recorded and this is that earlier deployment; nothing new was recorded',
  }),
})

/** @public */
export type DeployResponse = Schema.Schema.Type<typeof deployResponseSchema>

/**
 * The deploy webhook's refusal of a malformed request (422): nothing is
 * recorded.
 *
 * @public
 */
export const deployRefusalSchema = Schema.Struct({
  error: Schema.String.annotate({ description: 'Machine-readable refusal code' }),
  message: Schema.String.annotate({ description: 'What the request is missing, for a person' }),
})

/** @public */
export type DeployRefusal = Schema.Schema.Type<typeof deployRefusalSchema>

/**
 * The `fields` of a deployment record the CLI reads while it waits. Other
 * fields the host keeps (the object key, the hashes, who deployed) are ignored.
 *
 * @public
 */
export const deploymentRecordFieldsSchema = Schema.Struct({
  status: deploymentStatusSchema,
  url: optionalField(
    Schema.NullOr(Schema.String).annotate({
      description: 'Address the app is served at once live; null or absent before the host sets it',
    })
  ),
  report: optionalField(
    Schema.NullOr(Schema.String).annotate({
      description:
        "Why a 'failed' deployment stopped — for a config the host refused, the validation report, printed as is; null or absent otherwise",
    })
  ),
})

/** @public */
export type DeploymentRecordFields = Schema.Schema.Type<typeof deploymentRecordFieldsSchema>
