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

export class SwapAppValidationError extends Data.TaggedError('SwapAppValidationError')<{
  readonly cause: unknown
}> {}

export interface SwapAppContext {
  readonly registry?: DynamicRouteRegistry
  readonly hono?: Hono
}

export const swapApp = (
  newApp: App,
  context: SwapAppContext = {}
): Effect.Effect<void, SwapAppValidationError, AppRef> =>
  Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknown(AppSchema)(newApp).pipe(
      Effect.mapError((cause) => new SwapAppValidationError({ cause }))
    )

    const appRef = yield* AppRef
    yield* appRef.swap(validated)

    if (context.registry !== undefined && context.hono !== undefined) {
      yield* reRegisterDynamicRoutes(context.registry, validated, context.hono)
    }
  })
