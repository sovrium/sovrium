/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import { parseServerEnv, type ServerEnvValues } from '@/domain/models/process-env/server'

/** The environment decoded now, from the live `process.env`. */
const current = (): ServerEnvValues => parseServerEnv(process.env)

/**
 * Every value is read from `process.env` at the moment it is asked for: the
 * default a program sees outside a composition root (a CLI verb, a unit test),
 * so it reads exactly what it read before the service existed — a variable a
 * command sets after it started (`sovrium build` adopting its published
 * origin) is still seen.
 */
const liveServerEnv = (): ServerEnvValues => ({
  get baseUrl() {
    return current().baseUrl
  },
  get preBindOrigin() {
    return current().preBindOrigin
  },
  get port() {
    return current().port
  },
  get previewToken() {
    return current().previewToken
  },
  get idleExitSeconds() {
    return current().idleExitSeconds
  },
})

/**
 * The server's environment, decoded once: `BASE_URL` and the origin derived
 * from it, `PORT`, the preview token, the idle-exit window. A program reads it
 * with `yield* ServerEnv` instead of parsing `process.env` itself, so every
 * consumer answers with the same rule; a test overrides it with
 * `Effect.provideService(ServerEnv, parseServerEnv({ … }))`.
 *
 * A `Context.Reference`, like `ProcessEnv`: the composition roots provide a
 * record decoded once at boot (`ServerEnvLayer`), and a program run outside one
 * reads the live environment instead (see `liveServerEnv`).
 *
 * Holds the preview token, a secret: never log the record whole.
 */
export const ServerEnv = Context.Reference<ServerEnvValues>('sovrium/ServerEnv', {
  defaultValue: liveServerEnv,
})
