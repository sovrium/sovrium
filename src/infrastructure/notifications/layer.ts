/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { NotificationPreferenceRepositoryLive } from '@/infrastructure/database/repositories/notification-preference-repository-live'
import { NotificationRepositoryLive } from '@/infrastructure/database/repositories/notification-repository-live'
import { NotificationSubscriptionRepositoryLive } from '@/infrastructure/database/repositories/notification-subscription-repository-live'
import { RealtimeServiceLive } from '@/infrastructure/realtime/realtime-service-live'
import { NotificationServiceLive } from './notification-service-live'

export const NotificationsLive = Layer.mergeAll(
  NotificationServiceLive.pipe(
    Layer.provide(Layer.mergeAll(NotificationRepositoryLive, RealtimeServiceLive))
  ),
  NotificationRepositoryLive,
  NotificationPreferenceRepositoryLive,
  NotificationSubscriptionRepositoryLive,
  RealtimeServiceLive
)
