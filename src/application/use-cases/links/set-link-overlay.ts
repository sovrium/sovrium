/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator kill switch: an overlay row that takes a link out of service.
 *
 * The polarity is asymmetric by design ([internal ref] D3, restated on the
 * `disabled_at` column): the overlay may only ever be MORE restrictive than the
 * file. A config-declared link the file has already disabled therefore refuses
 * the overlay in BOTH directions — re-enabling it from a console would be the
 * console overruling a reviewed artefact, and disabling it further is a no-op
 * dressed as an action. {@link configLinkRefusesOverlay} is that rule, kept here
 * with the write it guards so no caller re-derives it.
 *
 * For a `db` link there is no file to overrule, so the row's own `enabled` flag
 * is edited through the ordinary update path; the overlay only adds or lifts the
 * kill switch, and the reported state is whatever the resolver then computes —
 * still `disabled` if the row's own flag is off.
 */

/* eslint-disable unicorn/no-null -- `disabledAt` and `actorId` are nullable COLUMNS: `null` is what the row holds and what the repository expects back, and `undefined` would read as "leave it alone". */

import { Effect } from 'effect'
import { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import { declaredLink } from './config-slugs'
import { resolveEntryState } from './link-state'
import { resolveLinkEntry } from './read-link-catalog'
import type { CatalogState } from './catalog'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type {
  LinkDbError,
  LinkNotFoundError,
  LinkSource,
} from '@/application/ports/repositories/links/link-repository'
import type { App } from '@/domain/models/app'

/** What an applied (or lifted) overlay leaves behind. */
export interface LinkOverlayResult {
  readonly state: CatalogState
  readonly changed: boolean
}

/**
 * Whether the file's own declaration forbids the overlay outright.
 *
 * True only for a config-declared link the file already disabled. Both
 * directions are refused — see the module comment for why the asymmetry is the
 * design rather than an oversight.
 */
export const configLinkRefusesOverlay = (app: App, slug: string): boolean =>
  declaredLink(app, slug)?.lifecycle?.enabled === false

/**
 * Apply (or lift) the overlay and report the state that follows.
 *
 * `undefined` means there is no such link to overlay. The write is skipped when
 * the row already holds the requested polarity, which is what makes `changed`
 * an honest answer rather than a restatement of the request.
 */
export const setLinkOverlay = (input: {
  readonly app: App
  readonly slug: string
  readonly disabled: boolean
  readonly actorId: string | null
}): Effect.Effect<
  LinkOverlayResult | undefined,
  LinkNotFoundError | LinkDbError,
  LinkRepository | AnalyticsRepository
> =>
  Effect.gen(function* () {
    const { app, slug, disabled } = input
    const repository = yield* LinkRepository
    const declared = declaredLink(app, slug)
    const source: LinkSource = declared === undefined ? 'db' : 'config'
    const current = yield* repository.findBySlug({ appName: app.name, slug, source })
    if (declared === undefined && current === undefined) return undefined

    const changed = ((current?.disabledAt ?? null) !== null) !== disabled
    if (changed) {
      yield* repository.setDisabled({
        appName: app.name,
        slug,
        source,
        disabled,
        actorId: input.actorId,
      })
    }

    const entry = yield* resolveLinkEntry(app, slug)
    if (entry === undefined) return undefined
    const state = yield* resolveEntryState(app.name, entry, new Date())
    return { state, changed }
  }).pipe(Effect.withSpan('links.set-overlay'))

/* eslint-enable unicorn/no-null */
