/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { AppSeedReport } from '@/domain/models/api/automations/steps/app-seed'
import type { App } from '@/domain/models/app'
import type { AppSeedMode } from '@/domain/models/app/automations/actions/app/seed'

/**
 * The seeder refused the run or failed while writing. `message` is the
 * seeder's own words — the ones `sovrium seed` prints on a laptop — and is
 * what the step fails with.
 */
export class AppSelfSeedError extends Data.TaggedError('AppSelfSeedError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** One `app/seed` run: the app as the server runs it, and the step's checked props. */
export interface AppSelfSeedRequest {
  readonly app: App
  readonly mode: AppSeedMode
  /** Restrict the run to these tables; absent, every table with a seed file. Never with `reset`. */
  readonly tables?: readonly string[]
  /** The day `{{today…}}` resolves against, `YYYY-MM-DD`; absent, the day of the run. */
  readonly today?: string
  readonly dryRun: boolean
}

/**
 * The seeder itself, as the process entry hands it over. It rejects with an
 * `Error` whose message is the seeder's refusal.
 */
export type AppSelfSeedRunner = (request: AppSelfSeedRequest) => Promise<AppSeedReport>

/**
 * AppSelfSeeder — run the engine's seeder on the app's OWN data, in this
 * process, from the seed folder beside the config the server was started
 * with: what the `app/seed` step does.
 *
 * The seeder is the one `sovrium seed` runs, so it is a composition root's to
 * give: the server is handed it at start, and a process that was not answers
 * every run with a refusal.
 */
export class AppSelfSeeder extends Context.Service<
  AppSelfSeeder,
  {
    readonly run: (request: AppSelfSeedRequest) => Effect.Effect<AppSeedReport, AppSelfSeedError>
  }
>()('AppSelfSeeder') {}
