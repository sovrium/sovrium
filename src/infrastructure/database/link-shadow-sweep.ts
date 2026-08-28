/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reconcile runtime-minted links against the slugs the config now declares.
 *
 * A short link can be minted from the console (a `source: 'db'` row) and later
 * ALSO declared in `app.links[]`. Config wins at resolution time — the route
 * handler resolves from the decoded config and never consults the table — so
 * from that boot onward the DB row is dead weight that still appears in the
 * catalog and still holds its slug against a re-mint. `shadowed_at` records
 * that, so the console can say "config took this name over" instead of showing
 * a row whose behaviour silently stopped matching its definition.
 *
 * TWO DIRECTIONS, deliberately. The sweep stamps rows the config has claimed AND
 * clears the stamp from rows it no longer claims. Un-shadowing is the whole
 * reason `shadowed_at` is a nullable timestamp rather than a status enum: an
 * operator who removes a link from the config file gets their runtime link back
 * on the next boot, with no migration and no manual step.
 *
 * NEVER FATAL. A sweep failure is logged as one warning and boot continues.
 * The stamp is bookkeeping for the console's benefit; resolution does not read
 * it, so a missed sweep degrades an explanation, not a redirect. Refusing to
 * boot over it would trade a cosmetic inaccuracy for an outage.
 *
 * Belongs to the deferred startup maintenance phase, NOT to the migration
 * steps: `executeMigrationSteps` is skipped wholesale by the config-checksum
 * fast path, so a sweep placed there would not run on the boot that matters —
 * the one where the config changed.
 */

import { Effect, Layer } from 'effect'
import { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import { logWarning } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

/** What the sweep changed, for the caller's log line. */
export interface LinkShadowSweepResult {
  /** Runtime links the config has now claimed. */
  readonly shadowed: number
  /** Previously-shadowed links the config has released. */
  readonly cleared: number
}

const EMPTY: LinkShadowSweepResult = { shadowed: 0, cleared: 0 }

/**
 * Run the sweep for one app.
 *
 * @param app - Decoded app configuration.
 * @returns What was stamped and cleared. Zeroes on any failure.
 */
export const runLinkShadowSweep = async (app: Readonly<App>): Promise<LinkShadowSweepResult> => {
  const configSlugs = (app.links ?? []).map((link) => link.slug)

  const program = Effect.gen(function* () {
    const repository = yield* LinkRepository

    // Clear FIRST, then stamp. The opposite order is also correct today, but
    // only because the two sets are disjoint by construction; clearing first
    // keeps that independent of whether `listShadowCandidates` filters on the
    // stamp, so a later change to that predicate cannot make the sweep
    // self-cancelling within a single run.
    const cleared = yield* repository.clearShadowed({ appName: app.name, configSlugs })

    const candidates = yield* repository.listShadowCandidates({ appName: app.name, configSlugs })
    if (candidates.length === 0) return { shadowed: 0, cleared }

    const shadowed = yield* repository.markShadowed({
      appName: app.name,
      slugs: candidates.map((candidate) => candidate.slug),
    })

    // ONE warning naming every affected slug, not one per row. An operator who
    // has just re-declared a dozen links in config needs a single line they can
    // read, and a per-row loop would bury the boot banner it sits next to.
    yield* Effect.sync(() =>
      logWarning(
        `[links] ${String(shadowed)} runtime link(s) are now shadowed by app.links[]: ` +
          `${candidates.map((candidate) => candidate.slug).join(', ')}. ` +
          'The config declaration resolves; the stored definition is ignored until it is removed.'
      )
    )

    return { shadowed, cleared }
  })

  return Effect.runPromise(
    program.pipe(
      Effect.provide(LinkRepositoryLive.pipe(Layer.provide(DatabaseLive))),
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          logWarning('[links] shadow sweep failed; link states may be stale', {
            cause: String(cause),
          })
          return EMPTY
        })
      )
    )
  )
}
