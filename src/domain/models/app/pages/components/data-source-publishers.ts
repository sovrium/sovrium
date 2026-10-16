/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FilterOperatorSchema } from './data-source'

/**
 * Shared-filter PUBLISHER — the half `SharedFilterBindingSchema` subscribes to.
 *
 * ─── WHY THE SUBSCRIBER HALF ALONE IS NOT A FEATURE ────────────────────────
 *
 * `bindTo` + `sharedFilter` describes a component that CONSUMES a published
 * param bag, and the only thing that publishes one today is either a
 * `search-input` (a scalar, under its own component id) or a bespoke island with
 * no component type at all — `shared-filter-select`, which the automation-runs
 * console mounts from TypeScript. So a config author can declare a subscriber
 * and has no way to declare what it listens to. This is the missing half.
 *
 * ─── ONE CHANNEL, MANY CONTRIBUTORS ────────────────────────────────────────
 *
 * `bindTo` here names the CHANNEL the control publishes on — deliberately the
 * same key name a subscriber uses, because it is deliberately the same string,
 * and a validator comparing `bindTo` to `bindTo` is one a reader can check by
 * eye. It is NOT the publisher's own component id: the runs directory needs TWO
 * selectors ("Filter by automation", "Filter by status") driving ONE grid, and a
 * subscriber's `bindTo` names a single channel. Both selectors publish on
 * `runs-filter`, each contributing its own `param`, and the grid merges the bag.
 *
 * Making the channel explicit rather than defaulting to the control's `props.id`
 * is the point: a select's id is also its form-control id, and overloading it
 * would silently make every id-bearing select a publisher, with collisions
 * decided by whichever rendered last.
 *
 * ─── PUBLISHED, NOT REQUESTED ──────────────────────────────────────────────
 *
 * The publisher emits on the client bus; the subscriber's own `sharedFilter`
 * decides which keys it merges. So a channel may carry more than any one
 * subscriber consumes, which is what lets a period channel drive a KPI strip
 * reading `[from, to]` beside a chart reading `[from, to, granularity]`.
 *
 * @example
 * ```yaml
 * # Two selects on one channel
 * - type: select
 *   props: { id: automation-filter, label: Filter by automation }
 *   dataSource:
 *     system: { endpoint: /api/admin/automations, rowsKey: automations }
 *     valueKey: name
 *     labelKey: name
 *   publishes: { bindTo: runs-filter, param: automationName }
 * - type: select
 *   props: { id: status-filter, label: Filter by status }
 *   options: [{ value: completed, label: Success }, { value: failed, label: Failed }]
 *   publishes: { bindTo: runs-filter, param: status }
 * # ...and the grid that merges both
 * - type: table
 *   dataSource:
 *     system:
 *       endpoint: /api/admin/automations/runs
 *       bindTo: runs-filter
 *       sharedFilter: {}
 * ```
 */
/** The channel a publisher writes on — shared by both publisher forms. */
const publisherChannel = Schema.String.pipe(
  Schema.annotate({
    description:
      "Shared-filter channel id this control publishes on (the string a subscriber's bindTo names)",
    examples: ['runs-filter', 'period'],
  }),
  Schema.check(Schema.isMinLength(1))
)

/**
 * Opt-in address-bar mirror of a publisher's contribution.
 *
 * Client-side only: the contribution is written as `?<channel>.<key>=` with
 * `history.replaceState` and read back on load, so a reload or a shared link
 * opens with the same narrowing. Nothing is remembered per user — no server
 * row, no browser storage — which is what keeps a reader's narrowing "stored
 * nowhere" beyond the address they can see and copy.
 */
const publisherUrl = Schema.optional(
  Schema.Boolean.annotate({
    description:
      'Mirror this control’s contribution in the page address as ?<channel>.<key>=, so a reload or a shared link opens with the same narrowing. Written in the browser with history.replaceState; nothing is stored per user.',
    defaultNote: 'false',
  })
)

/**
 * The PARAM form: the control's value is published as one request param.
 *
 * This is the shape every publisher had before the leaf form existed, and it
 * stays the right one for a subscriber that reads its own params — a system
 * endpoint answering `?status=`, a period bag `{ from, to }`.
 */
export const SharedFilterParamPublisherSchema = Schema.Struct({
  /**
   * The shared-filter CHANNEL this control publishes on — the same string a
   * subscriber's `bindTo` names. Several controls may share one channel, each
   * contributing its own `param`.
   */
  bindTo: publisherChannel,
  /**
   * The request-param key this control's current value is published under.
   *
   * Required, for the reason `labelKey` and `displayField` are: there is no
   * defensible default. Guessing the control's `props.id` would publish
   * `?automation-filter=` to an endpoint that reads `?automationName=`, which is
   * a filter that validates and quietly narrows nothing.
   */
  param: Schema.String.pipe(
    Schema.annotate({
      description: "Request-param key this control's value is published under",
      examples: ['automationName', 'status', 'period'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  url: publisherUrl,
}).annotate({
  identifier: 'SharedFilterParamPublisher',
  title: 'Shared Filter Param Publisher',
  description:
    "Publishes the control's value as one request param on the channel; a subscriber merges it into each request it makes.",
})

/**
 * The LEAF form: the control's value becomes one filter condition.
 *
 * ─── WHY A SECOND FORM ─────────────────────────────────────────────────────
 *
 * A table read by the records API is narrowed through ONE param, `filter`, a
 * condition tree. The param form can only fill that param whole, which is what
 * a `filter-bar` does and what no single-value control can do without erasing
 * every other contributor's conditions. The leaf form contributes exactly one
 * condition — `field operator <value>` — which the channel AND-merges with the
 * other publishers' leaves and with a filter bar's expression, one leaf per
 * publisher, never overwriting a sibling. Clearing the control withdraws its
 * leaf.
 *
 * `value` is read by a control whose own value is a boolean — a `switch` or a
 * `toggle` — as what it publishes while on (default `true`); turned off, it
 * withdraws its leaf. Every other control publishes the value it holds and
 * ignores `value`.
 */
/** @public */
export const SharedFilterLeafPublisherSchema = Schema.Struct({
  bindTo: publisherChannel,
  field: Schema.String.pipe(
    Schema.annotate({
      description: 'Field of the subscribers’ table the condition reads',
      examples: ['status', 'owner', 'amount'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  operator: FilterOperatorSchema,
  value: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description:
        'For a switch or a toggle: the value compared while it is on (default true). Turned off, the control withdraws its condition. Ignored by a control that holds a value of its own.',
      examples: ['open', true],
    })
  ),
  url: publisherUrl,
}).annotate({
  identifier: 'SharedFilterLeafPublisher',
  title: 'Shared Filter Condition Publisher',
  description:
    "Publishes the control's value as one filter condition (field, operator, value) on the channel, combined with AND with every other publisher's condition and with a filter bar's conditions.",
})

export const SharedFilterPublisherSchema = Schema.Union([
  SharedFilterParamPublisherSchema,
  SharedFilterLeafPublisherSchema,
]).annotate({
  identifier: 'SharedFilterPublisher',
  title: 'Shared Filter Publisher',
  description:
    'Marks a control as a shared-filter publisher on the named channel: either as one request param (`param`) or as one filter condition (`field` + `operator`). Every data component whose dataSource.bindTo names that channel merges what it publishes into each request.',
})

/**
 * The publisher a PERIOD control takes — a `date-range-picker`, whose value has
 * two ends.
 *
 * Either form of the one-value publisher would lose an end, so a range has its
 * own pair: `{ bindTo, field }` contributes two conditions on one date field —
 * `field gte <from>` and `field lte <to>`, both ends included — and
 * `{ bindTo, params: { from, to } }` publishes the two ends as two request
 * params, the shape a period-aware endpoint already reads. Clearing the period
 * withdraws both.
 */
export const SharedFilterRangePublisherSchema = Schema.Union([
  Schema.Struct({
    bindTo: publisherChannel,
    field: Schema.String.pipe(
      Schema.annotate({
        description:
          'Date field of the subscribers’ table the period narrows: kept are the records from the first day to the last, both included',
        examples: ['due_date', 'created_at'],
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    url: publisherUrl,
  }).annotate({
    identifier: 'SharedFilterRangeConditionPublisher',
    title: 'Period Condition Publisher',
    description:
      'Publishes the period as two conditions on one date field — from the first day, up to the last — combined with AND with the channel’s other conditions.',
  }),
  Schema.Struct({
    bindTo: publisherChannel,
    params: Schema.Struct({
      from: Schema.String.pipe(
        Schema.annotate({
          description: 'Request-param key the first day is published under',
          examples: ['from'],
        }),
        Schema.check(Schema.isMinLength(1))
      ),
      to: Schema.String.pipe(
        Schema.annotate({
          description: 'Request-param key the last day is published under',
          examples: ['to'],
        }),
        Schema.check(Schema.isMinLength(1))
      ),
    }).annotate({
      description: 'The two request-param keys the period’s ends are published under',
    }),
    url: publisherUrl,
  }).annotate({
    identifier: 'SharedFilterRangeParamsPublisher',
    title: 'Period Params Publisher',
    description:
      'Publishes the period’s first and last day as two request params, for a subscriber that reads its own period params.',
  }),
]).annotate({
  identifier: 'SharedFilterRangePublisher',
  title: 'Period Publisher',
  description:
    'Marks a period control as a shared-filter publisher: as two conditions on one date field, or as two request params.',
})

/** @public */
export type SharedFilterPublisher = Schema.Schema.Type<typeof SharedFilterPublisherSchema>
