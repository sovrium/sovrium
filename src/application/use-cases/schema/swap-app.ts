/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Schema } from 'effect'
import { AppRef } from '@/application/ports/services/app-ref'
import { AppSchema, type App } from '@/domain/models/app'
import { reRegisterDynamicRoutes, type DynamicRouteRegistry } from './dynamic-route-registry'
import type { Hono } from 'hono'

/**
 * Raised when the candidate `newApp` fails `AppSchema` validation.
 * The original ParseError is captured in `cause` so the API handler
 * can surface a meaningful 400 to the caller.
 */
export class SwapAppValidationError extends Data.TaggedError('SwapAppValidationError')<{
  readonly cause: unknown
}> {}

/**
 * Optional context for `swapApp`. When the live Hono server is
 * available (i.e. the call site is inside the running server), the
 * `registry` and `hono` fields let `swapApp` re-register dynamic
 * routes after the Ref swap.
 *
 * For non-server call sites (background workers, CLI, tests) both
 * fields can be omitted and `swapApp` becomes a pure
 * `validate → Ref.set` flow.
 */
export interface SwapAppContext {
  readonly registry?: DynamicRouteRegistry
  readonly hono?: Hono
}

/**
 * Atomic schema swap: validate the candidate App, atomically replace
 * the in-memory App via `AppRef.swap`, then fire the dynamic-route
 * re-registration hook.
 *
 * Validation happens BEFORE the swap so a malformed App can never
 * become live. The Ref swap itself is single-step (`Ref.set`) and
 * therefore atomic with respect to concurrent reads — every in-flight
 * request sees either the old or the new App, never a partial state.
 *
 * Phase 1 contract:
 *   - The registry can be empty (Phase 3 wires concrete entries).
 *   - When `context.registry` is undefined, the post-swap callback is
 *     skipped entirely — useful for unit tests that only care about
 *     the Ref-set semantics.
 */
export const swapApp = (
  newApp: App,
  context: SwapAppContext = {}
): Effect.Effect<void, SwapAppValidationError, AppRef> =>
  Effect.gen(function* () {
    // 1. Validate the candidate against AppSchema. We re-encode then
    //    re-decode so the same logic that validates a YAML config from
    //    disk is reused — there is exactly one source of truth for
    //    "is this App well-formed".
    const validated = yield* Schema.decodeUnknown(AppSchema)(newApp).pipe(
      Effect.mapError((cause) => new SwapAppValidationError({ cause }))
    )

    // 2. Atomically swap the live App.
    const appRef = yield* AppRef
    yield* appRef.swap(validated)

    // 3. Fire the post-swap hook for dynamic routes.
    if (context.registry !== undefined && context.hono !== undefined) {
      yield* reRegisterDynamicRoutes(context.registry, validated, context.hono)
    }
  })
