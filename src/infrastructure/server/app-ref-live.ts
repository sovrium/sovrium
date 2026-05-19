/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Ref } from 'effect'
import { AppRef } from '@/application/ports/services/app-ref'
import type { App } from '@/domain/models/app'

export const createAppRefLayer = (initialApp: App): Layer.Layer<AppRef> =>
  Layer.effect(
    AppRef,
    Effect.gen(function* () {
      const ref = yield* Ref.make<App>(initialApp)
      return AppRef.of({
        current: Ref.get(ref),
        swap: (newApp: App) => Ref.set(ref, newApp),
      })
    })
  )
