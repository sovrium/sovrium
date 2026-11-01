/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { OnlinePeople } from '@/application/ports/services/online-people'
import { isPersonOnline, onlinePeopleOf } from './app-connections'

/** {@link OnlinePeople} over the running server's realtime hub. */
export const OnlinePeopleLive = Layer.succeed(OnlinePeople, {
  isOnline: isPersonOnline,
  onlineOf: onlinePeopleOf,
})
