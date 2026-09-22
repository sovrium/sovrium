/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error class for a graceful stop that did not complete.
 *
 * The shutdown handler already treats a failed stop as exit code 1 (see
 * `lifecycle.ts` and the exit-code table in
 * `[internal ref]`), so the outcome is unchanged — what
 * changes is that the stop effect now DECLARES it. Wrapping `server.stop()` in
 * `Effect.promise` claimed the teardown could not fail while the documentation
 * one directory away described exactly what happens when it does.
 *
 * Deliberately NOT swallowed: an operator whose server refuses to release its
 * port needs the non-zero exit, or a supervisor will restart into a bind
 * conflict it cannot explain.
 */
export const ServerStopError = createTaggedError('ServerStopError')
export type ServerStopError = InstanceType<typeof ServerStopError>
