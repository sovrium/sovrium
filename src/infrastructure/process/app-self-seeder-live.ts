/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Semaphore } from 'effect'
import {
  AppSelfSeedError,
  AppSelfSeeder,
  type AppSelfSeedRunner,
} from '@/application/ports/services/app-self-seeder'

/**
 * The `AppSelfSeeder` of this process: the seeder its entry point installed.
 *
 * The seeder `app/seed` runs is the one `sovrium seed` runs, and it lives with
 * the command — a composition root, which writes rows through the table
 * programs and creates accounts through the app layer. Nothing below a
 * composition root may reach it, so the dependency is turned round: `sovrium
 * start` installs it here before the server boots, and the automation runtime
 * reads it through the port. A process that installed none — a library
 * embedding, a static build — answers every run with a refusal naming why.
 *
 * Process-local by design, like the boot instant (`server-boot-instant.ts`):
 * Sovrium runs one server per process, and the seeder is bound to the config
 * file that server was started with.
 */

let installedRunner: AppSelfSeedRunner | undefined = undefined

/** Hand the server the seeder `app/seed` runs. The last installation wins. */
export const installAppSelfSeedRunner = (runner: AppSelfSeedRunner): void => {
  installedRunner = runner
}

/**
 * One self-seed at a time in this process. A seed run is several statements
 * outside any one transaction — a reset empties every table, prunes accounts,
 * then writes the seed — so two runs started together (a cron tick and a hand
 * trigger, or two automations) would interleave their deletes and inserts and
 * leave a mix of both. The second waits for the first.
 */
const oneRunAtATime = Semaphore.makeUnsafe(1)

const NOT_INSTALLED =
  'app/seed: this process was not started by `sovrium start`, so it has no seed folder to read'

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export const AppSelfSeederLive = Layer.succeed(AppSelfSeeder, {
  run: (request) =>
    Effect.suspend(() => {
      const runner = installedRunner
      return runner === undefined
        ? Effect.fail(new AppSelfSeedError({ message: NOT_INSTALLED }))
        : Effect.tryPromise({
            try: () => runner(request),
            catch: (cause) => new AppSelfSeedError({ message: messageOf(cause), cause }),
          })
    }).pipe(oneRunAtATime.withPermits(1), Effect.withSpan('process.app-self-seed')),
})
