/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automations CATALOG and its two operational mutations.
 *
 * Backs three endpoints:
 *
 *   - `GET  /api/admin/automations`              → {@link BuildAutomationsCatalog}
 *   - `POST /api/admin/automations/:name/pause`  → {@link PauseAutomation}
 *   - `POST /api/admin/automations/:name/resume` → {@link ResumeAutomation}
 *
 * The catalog enumerates CONFIG, not runtime history — it is bounded by the app
 * file and therefore uncursored, unlike the cursor-paginated
 * `GET /api/admin/automations/runs` it sits beside.
 *
 * Every displayed state comes from {@link resolveAutomationOperationalState} —
 * the SAME predicate the eleven runtime gates reduce to. The console cannot
 * report "Paused" for an automation the engine would still run, because there
 * is only one decision function.
 */

import { Effect } from 'effect'
import { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import { resolveAutomationOperationalState } from '@/domain/models/app/automations/automation-operational-state'
import type {
  AutomationPauseDatabaseError,
  AutomationPauseRow,
} from '@/application/ports/repositories/automations/automation-pause-repository'
import type {
  AutomationCatalogItem,
  AutomationPauseResponse,
  AutomationsCatalogResponse,
} from '@/domain/models/api/admin/automations'
import type { App } from '@/domain/models/app'
import type { Context } from 'effect'

/**
 * Normalize a dialect-native timestamp to ISO 8601.
 *
 * PG hands back a `Date`; the SQLite mirror decodes `timestamp_ms` to a `Date`
 * too, but a raw driver read can still surface a string. Both are normalized
 * here rather than at the column, so the API contract's `z.string().datetime()`
 * holds on either engine.
 */
const toIso = (value: Readonly<Date> | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()

/** Index the enriched pause rows by automation name. */
const indexPauses = (
  rows: readonly AutomationPauseRow[]
): ReadonlyMap<string, AutomationPauseRow> => new Map(rows.map((row) => [row.automationName, row]))

/**
 * Build one catalog row.
 *
 * `pausedBy` / `pausedAt` are emitted ONLY when the state is `paused`. A
 * config-disabled automation that ALSO carries a pause row reports `disabled`
 * with no pause metadata — the pause is still recorded (so re-enabling in
 * config returns it to `paused` rather than silently resuming), but surfacing
 * "Paused by X" beside a Disabled state would tell the operator to press
 * Resume, which cannot help them.
 */
const buildItem = (
  automation: App['automations'] extends readonly (infer T)[] | undefined ? T : never,
  pauses: ReadonlyMap<string, AutomationPauseRow>
): Readonly<AutomationCatalogItem> => {
  const state = resolveAutomationOperationalState(automation, new Set(pauses.keys()))
  const pause = state === 'paused' ? pauses.get(automation.name) : undefined
  return {
    name: automation.name,
    ...(automation.label === undefined ? {} : { label: automation.label }),
    trigger: automation.trigger.type,
    state,
    ...(pause === undefined ? {} : { pausedBy: pause.pausedBy, pausedAt: toIso(pause.pausedAt) }),
  }
}

/**
 * Every automation declared in config, in CONFIG ORDER.
 *
 * Order is not incidental: it is the operator's mental model of the app file
 * they are reading alongside the console. Re-sorting would make the two
 * disagree.
 */
export const BuildAutomationsCatalog = (
  app: App
): Effect.Effect<
  AutomationsCatalogResponse,
  AutomationPauseDatabaseError,
  AutomationPauseRepository
> =>
  Effect.gen(function* () {
    const repository = yield* AutomationPauseRepository
    const pauses = indexPauses(yield* repository.listPauses)
    return { items: (app.automations ?? []).map((automation) => buildItem(automation, pauses)) }
  }).pipe(Effect.withSpan('admin.build-automations-catalog'))

/**
 * The outcome of a pause/resume mutation, mapped to HTTP by the route.
 *
 *   - `NotFound` → 404. The config declares no automation of that name. Also
 *     the shape a non-admin caller sees, via the upstream tier gate (S1).
 *   - `Conflict` → 409. The automation is `disabled` in config. The caller is
 *     an authenticated admin who can SEE the row, so a 404 would be a lie —
 *     but neither mutation can change a config-disabled automation's
 *     behaviour, so the request cannot be honoured.
 *   - `Ok` → 200, including when the automation was ALREADY in the requested
 *     state. Both mutations are idempotent.
 */
export type AutomationPauseOutcome =
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'Conflict' }
  | { readonly _tag: 'Ok'; readonly body: AutomationPauseResponse }

/**
 * Resolve `:name` against config and reject the two refusal cases, then run
 * `mutate` and read the resulting state back.
 *
 * The read-back is what makes the response honest: it reports the state the
 * NEXT trigger will see, rather than the state the handler intended to write.
 */
const runMutation = (
  app: App,
  name: string,
  mutate: (
    repository: Context.Service.Shape<typeof AutomationPauseRepository>
  ) => Effect.Effect<void, AutomationPauseDatabaseError>
): Effect.Effect<AutomationPauseOutcome, AutomationPauseDatabaseError, AutomationPauseRepository> =>
  Effect.gen(function* () {
    const automation = (app.automations ?? []).find((candidate) => candidate.name === name)
    if (automation === undefined) {
      // Anti-enumeration 404 (S1). The pause table is keyed on a bare name with
      // NO foreign key, so an unvalidated handler would happily insert a pause
      // for an automation that does not exist — a row that gates nothing and
      // appears in no catalog. This guard is the only thing preventing that.
      return { _tag: 'NotFound' } as const
    }
    if (automation.enabled === false) {
      return { _tag: 'Conflict' } as const
    }

    const repository = yield* AutomationPauseRepository
    yield* mutate(repository)

    const pauses = indexPauses(yield* repository.listPauses)
    return { _tag: 'Ok', body: buildItem(automation, pauses) } as const
  })

/** Stop new runs of `name`. Idempotent; a second pause keeps the first's `pausedAt`. */
export const PauseAutomation = (
  app: App,
  name: string,
  pausedByUserId: string | undefined
): Effect.Effect<AutomationPauseOutcome, AutomationPauseDatabaseError, AutomationPauseRepository> =>
  runMutation(app, name, (repository) =>
    repository.pause({ automationName: name, pausedByUserId })
  ).pipe(Effect.withSpan('admin.pause-automation'))

/** Allow new runs of `name` again. Idempotent; resuming an active automation succeeds. */
export const ResumeAutomation = (
  app: App,
  name: string
): Effect.Effect<AutomationPauseOutcome, AutomationPauseDatabaseError, AutomationPauseRepository> =>
  runMutation(app, name, (repository) => repository.resume(name)).pipe(
    Effect.withSpan('admin.resume-automation')
  )
