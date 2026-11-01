/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a form route runs: its whole program, once, on the request's services.
 *
 * The form routes answer pages and JSON alike, and every refusal they know of
 * is already a response. What is left in the failure channel is a fault, and
 * it goes to whichever boundary the request's path answers to: the error page
 * for a form page, the sanitized envelope under `/api/`.
 */

import { Effect } from 'effect'
import { runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

export const runFormProgram = <E>(
  c: Context,
  program: Effect.Effect<Response, E, DomainServices>
): Promise<Response> => runHandlerEffect(c, Effect.orDie(program))

/** A step of a form route the server's own code answers: its rejection is a fault. */
export const awaitForm = <A>(step: () => A | Promise<A>): Effect.Effect<A> =>
  // effect-promise: total -- a rejection here is a defect, and the route's boundary renders it (`runFormProgram`).
  Effect.promise(async () => step())
