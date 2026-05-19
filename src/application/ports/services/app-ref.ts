/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'
import type { App } from '@/domain/models/app'

export class AppRef extends Context.Tag('AppRef')<
  AppRef,
  {
    readonly current: Effect.Effect<App>
    readonly swap: (newApp: App) => Effect.Effect<void>
  }
>() {}
