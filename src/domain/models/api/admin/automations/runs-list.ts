/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/automations/runs` and the sibling detail
 * endpoint `GET /api/admin/automations/runs/:runId`.
 *
 * **The keystone of the admin list-endpoint pattern.**
 *
 * This is the first list-shape admin endpoint in Phase-0 with a public
 * counterpart at `/api/automations/runs`. It locks three [internal ref] binding
 * decisions simultaneously:
 *
 * - **D2** — soft-delete visibility default off. `?include_deleted=false` is
 *   the canonical default; opting in requires `?include_deleted=true`. The
 *   parameter parses without 400 even on tables that do not yet have a
 *   soft-delete column (forward contract per plan §4.3 risk #5) — the day
 *   `automation_runs` gains `deleted_at`, the AC sharpens.
 * - **D3** — `_admin` envelope as the canonical operator-extras namespace.
 *   Each item in the response carries `_admin: { lastModifiedBy,
 *   lastModifiedBy, deletedAt }` (plus optional `metadata`). The shape is
 *   defined once in `envelope/admin-envelope.ts` (CC-1) and consumed via
 *   `.extend({ _admin: adminEnvelopeSchema })` here.
 * - **D9** — a canonical `createAdminListEndpoint` helper, planned at
 *   `src/presentation/api/admin/_shared/list-endpoint.ts`. It was never
 *   authored: that path does not exist and nothing in `src/` names the symbol.
 *   The runs-list endpoint is hand-wired in
 *   `src/presentation/api/routes/admin/automations.ts` (`handleListRuns`), which
 *   reads this schema directly through `decodeSafe`. The D9 lock is therefore
 * still OPEN, not satisfied — `[internal ref]`
 * and `[internal ref]` both still describe the helper as
 *   existing.
 *
 * **Schema-drift mitigation** (plan §6.5): the public `runSchema` from
 * `src/domain/models/api/automations/automations.ts` is the canonical source
 * of truth for the run row shape. This admin module **extends** it with the
 * `_admin` block — it does NOT redefine `id`, `status`, `startedAt`, etc.
 * Future field additions to the public schema flow through automatically;
 * drift is structurally impossible.
 *
 * Source story: [internal ref]
 *
 * ## What `?q=` searches, and what it deliberately does not
 *
 * `automationName` is the column the operator reads in the grid. `error` is the
 * failure message and is **not a rendered column** (the run-history grid shows
 * Automation / Status / Started / Duration and nothing else) — which is exactly
 * why the response must echo {@link appliedQuerySchema}: a client that re-ran its
 * own in-memory filter over the visible cells would discard the very row the
 * server just matched on `error`. "Which runs blew up on ECONNREFUSED" is the
 * question this search exists to answer, and it is unanswerable from the cells.
 *
 * Deliberately EXCLUDED, each for its own reason:
 *
 * - `status` — it already has a precise filter (`?status`) AND a dedicated
 *   combobox on the surface. Folding it into free text would make `?q=failed`
 *   return every failed run in the app, burying the one the operator was looking
 *   for under a category match they did not ask for. The two knobs compose with
 *   AND instead. It is also rendered through a client-side localizer
 *   (`localizeRunStatusRows` maps `failed` → `Failed`), so a free-text status
 *   match would agree with the cell only by accident of language.
 * - `startedAt` — bounded by `?from` / `?to`, which is the honest shape for a
 *   time window; substring-matching a formatted timestamp is not a search.
 * - `triggerData` — an unbounded JSON blob whose text form differs per dialect.
 *   A substring hit inside serialized JSON is not a fact about the run.
 * - `id` — the detail endpoint (`/runs/:runId`) addresses a run by id exactly;
 *   a substring match over a UUID is noise, not recall.
 *
 * @see [internal ref] D2, D3, D9 — locked by this story
 * @see ../../combinators/search.ts — the shared `?q=` / `appliedQuery` contract
 * @see plan §4.3 — per-story design for the admin automations runs list requirement
 * @see plan §5.1 — CC-1 shared `_admin` envelope (authored alongside)
 * @see plan §6.5 — schema reuse rule (extend, never duplicate)
 */

import { Schema } from 'effect'
import { adminEnvelopeSchema } from '@/domain/models/api/admin/envelope/admin-envelope'
import { runSchema, runStatusSchema, stepLogEntrySchema } from '@/domain/models/api/automations'
import { booleanFlag, coercedNumber } from '@/domain/models/api/combinators/coerce'
import {
  cursorPaginationQuerySchema,
  cursorPaginationResponseSchema,
} from '@/domain/models/api/combinators/cursor-pagination'
import { describedUnknown } from '@/domain/models/api/combinators/described-ref'
import { looseIsoDateOrDateTime, uuid } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { appliedQuerySchema, searchTermSchema } from '@/domain/models/api/combinators/search'
import { withDefault } from '../../combinators/schema-defaults'

/**
 * Filter query parameters accepted by `GET /api/admin/automations/runs`.
 *
 * Extends the shared cursor pagination query (`cursor`, `limit`) with the
 * runs-specific filters: `status`, `automationName`, `triggerName`, `from`/`to`, and the
 * D2-locked `include_deleted` opt-in.
 *
 * **Default `include_deleted=false`** is the D2 lock. The dashboard never
 * surfaces soft-deleted rows by default; operators with a compliance need
 * pass `?include_deleted=true` explicitly. The default is applied at the schema
 * layer — `.pipe(withDefault(false))` — so handlers never see `undefined`.
 * `withDefault` is Effect 4's spelling of Zod's `.default(false)`: it wraps the
 * value in `Effect.succeed` and orders `annotate` BEFORE the default, which is
 * what keeps `"default": false` in the emitted OpenAPI document. See
 * `combinators/schema-defaults.ts`.
 *
 * Adding `?automationId=` (the public counterpart filters by name; admin
 * gets the id-shaped variant for stable cross-referencing with audit log
 * `resource.id`) is non-breaking — appending a sibling field on the query.
 */
export const automationsRunsListQuerySchema = Schema.Struct({
  ...cursorPaginationQuerySchema.fields,
  page: optionalField(
    coercedNumber
      .annotate({
        description:
          'Read the history by page NUMBER instead of by cursor: `?page=2&limit=25` answers the runs 26 to 50 of the matching runs, newest first, with `nextCursor: null`. 1-based. A request carrying a `cursor` is read by the cursor and `page` is ignored; a request carrying neither starts at the first page by cursor. `total` on the response counts every matching run, so a reader can number the pages.',
      })
      .pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)))
  ),
  status: optionalField(
    runStatusSchema.annotate({
      description:
        'Filter by run status. Mirrors the public `?status` filter on `/api/automations/runs` so admin and public callers share one vocabulary.',
    })
  ),
  automationName: optionalField(
    Schema.String.annotate({
      description:
        'Filter by automation definition name (matches the `name` field in the app schema `automations[]` array). Mirrors the public `?automationName` filter.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  triggerName: optionalField(
    Schema.String.annotate({
      description:
        "Filter by the name of the trigger that started the run: the trigger's own `name`, else its type. Mirrors the public `?triggerName` filter, including its reading of a run recorded before triggers had names as its automation's first trigger. AND-combined with every other filter.",
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  automationId: optionalField(
    Schema.String.annotate({
      description:
        'Filter by automation definition UUID. Admin-only — operators reading audit log entries scope by `resource.id` and the id is the stable cross-reference. Co-existing with `?automationName` is fine; both are AND-combined when both are provided.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  from: optionalField(
    looseIsoDateOrDateTime({
      description:
        'Start of the period, inclusive, on `startedAt`: a calendar day (`2026-10-17`) or an ISO 8601 date-time. A day means from the first instant of that day, counted in the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset). Pair with `to` to read one period; leave both out to read the whole history (subject to retention).',
    })
  ),
  to: optionalField(
    looseIsoDateOrDateTime({
      description:
        'End of the period on `startedAt`: a calendar day (`2026-10-17`) or an ISO 8601 date-time. A day is INCLUDED — the period runs through the last instant of that day, in the operator timezone — so `?from=2026-10-17&to=2026-10-17` reads that one day. A date-time is EXCLUSIVE: a run started at exactly that instant is left out. Days and date-times may be mixed. Returns 400 when the period ends before it starts.',
    })
  ),
  include_deleted: booleanFlag
    .annotate({
      description:
        'Include soft-deleted runs. Default `false` — the D2 lock. Pass `?include_deleted=true` to surface tombstones for compliance review. The flag parses without 400 even when the underlying table has no soft-delete column yet (forward-contract — see story §risks).',
    })
    .pipe(withDefault(false)),
  onDemand: optionalField(
    Schema.Literals(['true', 'false']).annotate({
      description:
        'Keep only the runs an operator started by hand from a schedule (`true`: the run reads `invokedOnDemand: true`) or only the others (`false`). Exactly `true` or `false`; any other value is a 400, never a filter silently ignored. AND-combined with every other filter.',
    })
  ),
  q: searchTermSchema.annotate({
    description:
      'Optional free-text search over the run `automationName` and the failure `error` message, as a case-insensitive literal substring. Composes with every other filter (AND) and with the cursor, so a page is a page of MATCHES. `status`, `startedAt` and `triggerData` are intentionally NOT searched — see the searchable-field contract in the module docstring. Empty / whitespace-only means "no search".',
  }),
}).annotate({ identifier: 'AutomationsRunsListQuery' })

/**
 * Resolved query parameter values (post-default-fill, post-coercion).
 *
 * Derived from `.Type` — Effect 4's counterpart to Zod's `z.infer`, not
 * `z.input` — so call sites see the DECODED type: `cursor: string | undefined`,
 * `limit: number` (default applied), and `include_deleted: boolean` (default
 * applied). The encoded side (`Codec.Encoded`) would report the pre-default
 * wire shape, which is the Story-#1 regression where a transitive input type
 * made the helper config too narrow.
 * @public
 */
export type AutomationsRunsListQuery = typeof automationsRunsListQuerySchema.Type

/**
 * Single admin run item — public `runSchema` extended with the `_admin`
 * envelope.
 *
 * The order of `.extend()` matters for OpenAPI naming: the resulting schema
 * is registered under `AutomationRunAdminItem` so client SDKs generate a
 * type that says "this is an automation run with admin extras", not just
 * "extended Run". The canonical fields (`id`, `status`, `startedAt`, ...)
 * are inherited verbatim from the public `runSchema`. The admin additions are
 * derived facts a run history reads at a glance — `automationLabel` (the
 * automation as a person reads it, beside the `automationName` every filter
 * takes), `recordTable` + `recordId`
 * (the record the run concerns; two flat facts rather than one object, because
 * a console addresses one field at a time, as `$record.recordId` in a link) and
 * `stepsRun` + `stepCount` (how far it got), with `stepsLabel` reading the two
 * as one phrase in the operator's language because a console cell shows one
 * field — and the `_admin` block.
 */
export const automationRunAdminItemSchema = Schema.Struct({
  ...runSchema.fields,
  automationLabel: optionalField(
    Schema.String.annotate({
      description:
        'What a person reads for the automation this run belongs to: its declared `label`, else its `name` made readable — hyphens and underscores read as spaces, a camelCase boundary as a space, the first letter capitalised (`weekly-digest` reads `Weekly digest`). Read from the live configuration; for an automation no longer declared, the stored `automationName` made readable. Display text only; `automationName` stays the identifier every filter and address takes.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  recordTable: Schema.NullOr(
    Schema.String.annotate({
      description:
        'Table of the record a `record` or `comment` trigger started this run about, as the configuration declares it. Null for every other trigger, and for a record-triggered run whose payload carries no record id. Null exactly when `recordId` is.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  recordId: Schema.NullOr(
    Schema.String.annotate({
      description:
        "Id of that record, read from the run's own trigger payload, as the records API names it (a string on every engine). Null exactly when `recordTable` is.",
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  stepsRun: Schema.Int.annotate({
    description:
      'How many steps of this run ran: the top-level steps it executed, finished or failed. A step recorded as skipped never ran and is not counted. A step nested inside a path or a loop counts with the step that holds it.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  stepCount: Schema.NullOr(
    Schema.Int.annotate({
      description:
        'How many top-level steps the automation declares today, so a reader can say 3 of 5. Read from the live configuration, not from the run: an automation edited since reports its current count. Null when the automation is no longer declared.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  stepsLabel: Schema.String.annotate({
    description:
      'How far the run got, as one reading built on the server from `stepsRun` and `stepCount` in the operator’s language: `2 of 3` in English, `2 sur 3` in French. Just the number of steps that ran (`2`) when `stepCount` is null. The language is the operator’s own — their account language, else the `sovrium_language` preference — and English otherwise. The two figures stay on the row beside it.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  durationLabel: optionalField(
    Schema.String.annotate({
      description:
        'How long the run took, as one readout built on the server from `durationMs` in the operator’s language, the way a `duration` column prints an elapsed time: `180 ms` under a second, one decimal under ten seconds (`1.4 s`, « 1,4 s » in French), whole seconds under a minute (`42 s`), then minutes and seconds (`2 min 18 s`) and hours and minutes (`1 h 05 min`). Absent while `durationMs` is null — a run still going has no duration yet. The figure stays on the row beside it.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  recordLabel: Schema.NullOr(
    Schema.String.annotate({
      description:
        'What a person calls the record this run concerns: its first text field holding a value, in the order the table declares its fields (a line of text, an email, a web address or a phone number; never a write-only field), else its id. The same name a record sheet heads itself with. Read at the time of the request, so a record renamed since reads its current name. Null exactly when `recordId` is.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  triggerLabel: Schema.String.annotate({
    description:
      'What started the run, as one reading in the operator’s language, composed on the server from the trigger the configuration declares today: a schedule as `Schedule · daily 06:00`, `Schedule · every 15 min`, `Schedule · Mon 07:30` (the expression itself when it reads as none of these); a record trigger as the table and what it watches, `Quotes · status → Signed` for a condition that one field equals one value, `Quotes · status changed` for watched fields, `Quotes · created` for events alone; a form as `Form · ` and its title. Any other trigger reads as its kind (`Webhook`, `Manual`). An entry its author named reads its name after the description (`Manual · on-demand`), so two entries of one kind stay apart. A schedule an operator started by hand ends with ` · run on demand` (` · lancée à la demande` in French): `Schedule · daily 03:00 · run on demand`. For an automation no longer declared, the stored trigger name made readable. Display text only; `triggerName` stays what the filter takes.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  invokedOnDemand: Schema.Boolean.annotate({
    description:
      'Whether an operator started this run by hand from a schedule ("run now") rather than the schedule firing by itself, read from the run’s own trigger data. `false` for every run its trigger started: a fired schedule, a webhook, a record or form trigger. A run started by hand reads its schedule in `triggerLabel` followed by `run on demand`.',
  }),
  _admin: adminEnvelopeSchema,
}).annotate({ identifier: 'AutomationRunAdminItem' })

/** @public */
export type AutomationRunAdminItem = typeof automationRunAdminItemSchema.Type

/**
 * Cursor-paginated response shape for the list endpoint.
 *
 * Wraps the admin item schema with the canonical `{ items, nextCursor }`
 * envelope from `combinators/cursor-pagination.ts`. `nextCursor === null`
 * signals stream end; non-null is an opaque base64 token for the next
 * `?cursor=...` request.
 */
export const automationsRunsListResponseSchema = Schema.Struct({
  ...cursorPaginationResponseSchema(automationRunAdminItemSchema).fields,
  appliedQuery: appliedQuerySchema,
  total: Schema.Int.annotate({
    description:
      'How many runs match the request’s filters and search, across every page — the same figure on every page of one query, so a reader can number the pages. Pagination parameters do not change it.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  counts: Schema.Struct({
    failed: Schema.Int.annotate({
      description:
        'How many of the matching runs failed, retries exhausted included. Pagination parameters do not change it.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    waiting: Schema.Int.annotate({
      description:
        'How many of the matching runs are waiting: for an approval, or to resume after a delay. Pagination parameters do not change it.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  }).annotate({
    description: 'Status counts over every matching run, the facts `resultSummary` reads.',
  }),
  resultSummary: Schema.String.annotate({
    description:
      'The matching runs as one sentence in the operator’s language, composed on the server from `total` and `counts`: `35 runs · 3 failed · 1 waiting` in English, `35 exécutions · 3 en échec · 1 en attente` in French, with a zero count left out (`35 runs` when none failed or waits) and the singular for one (`1 run`). A data-table bound to this endpoint prints it in its pager in place of its own range.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({ identifier: 'AutomationsRunsListResponse' })

/** @public */
export type AutomationsRunsListResponse = typeof automationsRunsListResponseSchema.Type

/**
 * Path parameter for the detail endpoint `GET /api/admin/automations/runs/:runId`.
 *
 * Validates the `:runId` placeholder as a UUID — the public `runSchema.id`
 * is `z.string().uuid()`, so the admin detail endpoint shares that constraint.
 * Invalid UUIDs return 400 (parameter validation) rather than 404; the
 * 404-vs-400 distinction is OK here because the parameter shape is publicly
 * known via the OpenAPI document and a 400 leaks no extra information about
 * which run ids exist.
 */
export const automationsRunsDetailParamsSchema = Schema.Struct({
  runId: uuid({ description: 'Run id (UUID) — matches `runSchema.id` from the public runs API.' }),
}).annotate({ identifier: 'AutomationsRunsDetailParams' })

/** @public */
export type AutomationsRunsDetailParams = typeof automationsRunsDetailParamsSchema.Type

/**
 * Detail endpoint response shape — a single admin run item.
 *
 * Re-exports the item schema under a distinct OpenAPI name so the detail
 * endpoint's response is documented separately from the list endpoint's
 * item shape, even though the runtime types are equal. Future evolution of
 * the detail-only fields (e.g. step traces, prompt/response capture) will
 * branch this schema; for now it is structurally identical to the list
 * item.
 */
export const automationsRunsDetailResponseSchema = automationRunAdminItemSchema.annotate({
  identifier: 'AutomationsRunsDetailResponse',
})

/** @public */
export type AutomationsRunsDetailResponse = typeof automationsRunsDetailResponseSchema.Type

/**
 * Per-step I/O row surfaced by the admin run-detail endpoint for the dashboard
 * run-detail panel (the admin dashboard automations runs requirement, [internal ref]).
 *
 * The run model already persists each step's `input` (the action's `props`) and
 * `output` (`run-persistence.ts:108-109`); this row projects those persisted
 * fields so the dashboard renders the per-step Input/Output panels without a new
 * backend. `input`/`output` are `z.unknown()` (arbitrary JSON), nullable for
 * steps that produced neither.
 */
const adminRunStepBaseSchema = Schema.Struct({
  /**
   * The step's position in the run, from the persisted `step_index` column.
   *
   * A FACT the row carries, not a rendering. It is published because a console
   * that draws a step rail needs to number its markers, and the alternatives
   * were both worse: synthesising the number from the array position ties the
   * label to a client-side index the config cannot name, and inventing an
   * `$index` interpolation token adds a second grammar for a number the row can
   * simply carry. Publishing a pre-composed label instead would be the
   * the facts-not-strings rule and two-key Data-surface design violation this deliberately avoids — an endpoint publishes
   * facts, the console composes.
   */
  index: Schema.Finite.annotate({
    description: 'Zero-based position of this step within the run (persisted `step_index`).',
  }),
  name: Schema.String.annotate({ description: 'Action step name (the automation action `name`).' }),
  label: optionalField(
    Schema.String.annotate({
      description:
        'What a person reads for this step: the `label` the action declares, else its `name` made readable — a camelCase boundary, a hyphen or an underscore read as a space, the first letter capitalised (`renderInvoice` reads `Render invoice`). Read from the live configuration, so a step renamed since the run reads its current label. Display text only; `name` stays the identifier.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  status: Schema.String.annotate({
    description: 'Step execution status (e.g. completed / failed / skipped).',
  }),
  input: optionalField(describedUnknown('Step input — the action `props` (Input panel).')),
  output: optionalField(describedUnknown('Step output data (Sortie panel; null when none).')),
  error: Schema.NullOr(
    Schema.String.annotate({ description: 'Error message if the step failed.' })
  ),
  startedAt: optionalField(
    Schema.NullOr(
      Schema.String.annotate({
        description:
          'When the step started, as an ISO 8601 instant; null when the step never ran. Present on every top-level step; a step nested in a path or a loop carries no timing of its own.',
      })
    )
  ),
  completedAt: optionalField(
    Schema.NullOr(
      Schema.String.annotate({
        description:
          'When the step ended, finished or failed, as an ISO 8601 instant; null while it runs or when it never ran.',
      })
    )
  ),
  durationMs: optionalField(
    Schema.NullOr(
      Schema.Int.annotate({
        description:
          'How long the step took, in whole milliseconds; null while it runs or when it never ran.',
      }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
    )
  ),
  /**
   * Always present, even for a silent step: the console lists the array and
   * draws its own "nothing logged" line, so absence would be a second empty
   * state to handle. Malformed stored entries are dropped by the use-case
   * before they reach this schema, never surfaced as a failed read.
   */
  logs: Schema.Array(stepLogEntrySchema).annotate({
    description:
      'Entries the step wrote with context.log, in call order, secrets masked; empty when the step logged nothing.',
  }),
})

type AdminRunStepBase = typeof adminRunStepBaseSchema.Type

/**
 * A step of the admin run detail. A `path/branch` step also carries the paths
 * it ran, and a `loop/each` step the items it ran, each with its nested steps
 * in this same shape — `index` is then the step's position inside its path or
 * item, `input` its resolved props, and both are masked like the top level.
 */
export interface AdminRunStep extends AdminRunStepBase {
  readonly paths?:
    readonly { readonly name: string; readonly steps: readonly AdminRunStep[] }[] | undefined
  readonly iterations?:
    readonly { readonly index: number; readonly steps: readonly AdminRunStep[] }[] | undefined
}

// Recursive, so typed by hand and given an `identifier`: the identifier turns
// the self-reference into a `$ref` cycle in the OpenAPI document instead of an
// endless inline walk.
export const adminRunStepSchema: Schema.Codec<AdminRunStep> = Schema.suspend(
  (): Schema.Codec<AdminRunStep> =>
    Schema.Struct({
      ...adminRunStepBaseSchema.fields,
      paths: optionalField(
        Schema.Array(
          Schema.Struct({
            name: Schema.String.annotate({ description: 'Name of the path that ran' }),
            steps: Schema.Array(adminRunStepSchema).annotate({
              description: 'The steps executed inside this path, in the order they ran',
            }),
          })
        ).annotate({
          description:
            'Present on a path/branch step: each path it ran, in the order it ran them, with the steps executed inside. Absent on other steps.',
        })
      ),
      iterations: optionalField(
        Schema.Array(
          Schema.Struct({
            index: Schema.Int.annotate({ description: 'Zero-based position of the item' }),
            steps: Schema.Array(adminRunStepSchema).annotate({
              description: 'The steps executed for this item, in the order they ran',
            }),
          })
        ).annotate({
          description:
            'Present on a loop/each step: each item it ran, in order, with the steps executed for it. Absent on other steps.',
        })
      ),
    }) as never
).annotate({ identifier: 'AdminRunStep' })

/**
 * Whose fault a failed run is, as a FACT the console can gate on.
 *
 * A run page draws one of two failure callouts: a run the engine stopped on an
 * internal error is Sovrium's to fix, and offers a bug report; a run that
 * failed on its own step is the author's or the operator's, and points at what
 * to fix. A declarative page cannot infer the split from the report read (a
 * `404` there also means "not an admin"), so the run read carries it, and the
 * page chooses each callout with a plain `visibility.record` gate.
 *
 * The split is the defect guard's, and only its: `defect` exactly when the run
 * report read (`GET /api/admin/reports/runs/:runId`) answers an address for the
 * run. A run whose action died on a cause the operator can fix (a table missing
 * from the database, an unreachable database, an unset variable) is a `step`
 * failure, as the defect guard records it.
 */
const runFailureKindSchema = Schema.Literals(['defect', 'step']).annotate({
  description:
    'Whose fault the failure is, present only on a run that ended in failure (`failed`, `exhausted` or `timed-out`): `defect` when the engine stopped the run on an internal error of its own, which is Sovrium’s to fix and the one failure a bug report is offered for (exactly when the run report read answers an address); `step` when the run failed on one of its own steps, including a cause the operator can fix such as a missing table or an unset variable. Absent on a run that did not fail.',
})

/**
 * Run-detail response WITH the per-step I/O list — the shape the dashboard's
 * run-detail panel consumes. Extends the canonical detail item (run row +
 * `_admin`) with a `steps` array so the per-step Input/Output panels resolve.
 *
 * The bare {@link automationsRunsDetailResponseSchema} stays the documented
 * Phase-0 contract (it is forward-compatible — `steps` is an additive field that
 * `.parse()` on the bare schema simply strips); this richer variant is what
 * `BuildAdminRunDetail` now emits.
 */
export const automationsRunsDetailWithStepsResponseSchema = Schema.Struct({
  ...automationRunAdminItemSchema.fields,
  steps: Schema.Array(adminRunStepSchema).annotate({
    description: 'Per-step execution rows with input (props) + output, ordered by step index.',
  }),
  failedStep: Schema.NullOr(
    Schema.Struct({
      index: Schema.Finite.annotate({
        description: "The failed step's `index`, as its row in `steps` carries it.",
      }),
      number: Schema.Finite.annotate({
        description:
          'The failed step counted from 1 among the run’s top-level steps, in the order they ran: `2` for the second step, so a page prints "Step 2 failed" with no arithmetic of its own.',
      }).pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))),
      label: Schema.String.annotate({
        description: "The failed step's `label`, as its row in `steps` carries it.",
      }).pipe(Schema.check(Schema.isMinLength(1))),
    })
  ).annotate({
    description:
      'The top-level step a failed run stopped on, by the index and the label its row in `steps` carries and its position counted from 1, so a console can title its callout "Step N failed · <step>". `null` for a run that did not fail, and for a failed run no step of which failed.',
  }),
  failureKind: optionalField(runFailureKindSchema),
}).annotate({ identifier: 'AutomationsRunsDetailWithStepsResponse' })

/** @public */
export type AutomationsRunsDetailWithStepsResponse =
  typeof automationsRunsDetailWithStepsResponseSchema.Type
