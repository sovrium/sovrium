/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'

/** The environment variables a use-case reads, as the process holds them. */
export type ProcessEnvShape = Readonly<Record<string, string | undefined>>

/**
 * The process environment, as a service: a use-case reads it with
 * `yield* ProcessEnv` instead of touching `process.env`, so the environment
 * reaches the application layer through one door and a test overrides it
 * with `Effect.provideService(ProcessEnv, { … })` without mutating the
 * process.
 *
 * A `Context.Reference` whose default is the live `process.env` object, so a
 * program run outside a composition root (a CLI verb, a unit test) reads what
 * it always read. The composition roots provide that same object once — never
 * a copy — so a variable set after boot is still seen where it was before.
 */
export const ProcessEnv = Context.Reference<ProcessEnvShape>('sovrium/ProcessEnv', {
  defaultValue: () => process.env,
})
