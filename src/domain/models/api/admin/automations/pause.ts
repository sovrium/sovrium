/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the automation operational-pause surface:
 *
 *   - `GET  /api/admin/automations`               — the catalog the console binds to
 *   - `POST /api/admin/automations/:name/pause`   — stop new runs
 *   - `POST /api/admin/automations/:name/resume`  — allow new runs again
 *
 * Source story: [internal ref]
 *
 * These are the FIRST audited automation mutations — the sibling
 * `POST /runs/:runId/retry` emits no audit event today, so there is no
 * in-file precedent; the closest is `BUCKET_FILE_UPLOADED` in
 * `presentation/api/routes/admin/buckets.ts`.
 *
 * NOTE: nothing here is an `AppSchema` config option. A pause is OPERATIONAL
 * data (a row in `system.automation_pauses`), never config — [internal ref] D2 keeps
 * the Admin Space out of the configuration entirely. That is also why pausing
 * does not write `automations[].enabled`.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The operator-visible state of one automation.
 *
 * MUST stay identical to the domain type `AutomationOperationalState`
 * (`@/domain/models/app/automations/automation-operational-state`), which is the same value the
 * twelve-gate predicate derives its verdict from. The console's Pause/Resume
 * row actions gate on this field via `visibleWhen`, so a fourth value added
 * here without a matching `visibleWhen` clause would render a row with no
 * controls at all.
 */
export const automationOperationalStateSchema = Schema.Literals([
  'active',
  'paused',
  'disabled',
]).annotate({
  description:
    "Operator-visible state. 'active' runs normally; 'paused' is an operational pause held in system.automation_pauses and clearable from the console; 'disabled' is enabled:false in the app config and can only be changed by editing config.",
})

/** @public */
export type AutomationOperationalStateResponse = typeof automationOperationalStateSchema.Type

/**
 * One row of the automations catalog.
 *
 * `pausedBy` / `pausedAt` are present ONLY when `state === 'paused'`. They are
 * omitted for active and config-disabled rows so the console's Paused column
 * renders blank without a client-side conditional.
 *
 * `pausedBy` is nullable, not merely optional: `automation_pauses.paused_by_user_id`
 * is `ON DELETE SET NULL`, so erasing the operator who paused an automation
 * sheds the identifier while the pause itself survives (GDPR Art. 17). A pause
 * whose author was erased renders with an unknown actor, never as un-paused.
 */
export const automationCatalogItemSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'The config automation name (kebab-case) — the stable identity',
  }),
  label: optionalField(
    Schema.String.annotate({ description: 'Human-readable label from config, when set' })
  ),
  trigger: Schema.String.annotate({
    description: "Trigger type discriminator, e.g. 'webhook', 'cron', 'record', 'form'",
  }),
  state: automationOperationalStateSchema,
  pausedBy: optionalField(
    Schema.NullOr(
      Schema.String.annotate({
        description:
          'Display name of the operator who paused it. Null when that account has since been deleted. Absent unless state is paused.',
      })
    )
  ),
  pausedAt: optionalField(
    looseIsoDateTime({
      description: 'ISO 8601 timestamp of the pause. Absent unless state is paused.',
    })
  ),
}).annotate({ identifier: 'AutomationCatalogItem' })

/** @public */
export type AutomationCatalogItem = typeof automationCatalogItemSchema.Type

/**
 * `GET /api/admin/automations` response.
 *
 * `items` (not a bare array) because the console's `table` binds via
 * `dataSource.system` with `rowsKey: 'items'`, matching every sibling admin
 * list endpoint. Uncursored by design: the catalog enumerates CONFIG, which is
 * bounded by the app file — unlike run history, it cannot grow unboundedly at
 * runtime.
 */
export const automationsCatalogResponseSchema = Schema.Struct({
  items: Schema.Array(automationCatalogItemSchema).annotate({
    description: 'Every automation declared in config, in config order',
  }),
}).annotate({ identifier: 'AutomationsCatalogResponse' })

/** @public */
export type AutomationsCatalogResponse = typeof automationsCatalogResponseSchema.Type

/**
 * Path parameters for the pause/resume mutations.
 *
 * Keyed on NAME, not id, because `system.automation_definitions` rows are
 * seeded lazily on an automation's FIRST RUN — an automation that has never
 * run has no id to address, and pausing exactly such an automation (one that
 * is about to misbehave) is the primary incident use case.
 */
export const automationPauseParamsSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The config automation name' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({ identifier: 'AutomationPauseParams' })

/** @public */
export type AutomationPauseParams = typeof automationPauseParamsSchema.Type

/**
 * `POST /api/admin/automations/:name/{pause,resume}` success response.
 *
 * Echoes the resulting state so the console can reconcile without a second
 * round-trip, though the shipped surface refetches the grid instead.
 *
 * STATUS CODES (the whole contract):
 *   - `200` — state changed, OR was already in the requested state. Pause and
 *     resume are IDEMPOTENT: an operator hammering Pause during an incident
 *     must not be handed an error for succeeding twice.
 *   - `404` — no automation of that name in config. Also the response for a
 *     non-admin or unauthenticated caller (anti-enumeration, S1).
 *   - `409` — the automation is `disabled` in config. The caller is an
 *     authenticated admin who can SEE the row, so hiding it behind a 404 would
 *     be a lie; but neither pausing nor resuming can change a config-disabled
 *     automation's behaviour, so the request cannot be honoured. 409 says
 *     precisely that: understood, addressed to a real resource, incoherent
 *     with its current state.
 */
export const automationPauseResponseSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The config automation name' }),
  state: automationOperationalStateSchema,
  pausedBy: optionalField(
    Schema.NullOr(Schema.String.annotate({ description: 'Absent unless state is paused' }))
  ),
  pausedAt: optionalField(looseIsoDateTime({ description: 'Absent unless state is paused' })),
}).annotate({ identifier: 'AutomationPauseResponse' })

/** @public */
export type AutomationPauseResponse = typeof automationPauseResponseSchema.Type
