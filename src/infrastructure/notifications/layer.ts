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

/**
 * Composite layer providing all notification-related implementations:
 *   - NotificationService (dispatch + bulk dispatch + scheduleDigest)
 *   - NotificationRepository (CRUD on system.notifications)
 *   - NotificationPreferenceRepository (per-user channel preferences)
 *   - NotificationSubscriptionRepository (find subscribers by table/record)
 *   - RealtimeService (broadcast — currently a console.info stub)
 *
 * Audit M5/M6: NotificationServiceLive now resolves its repo + realtime
 * dependencies from this composite via Effect Context, replacing the
 * previous self-providing Layer pattern in the deleted dispatcher.ts.
 *
 * Provide this single layer alongside TableLive at the route boundary
 * so the notifications use cases (list-inbox, mark-read, etc.) and
 * notifyRecordCreated can resolve every port they need.
 */
export const NotificationsLive = Layer.mergeAll(
  NotificationServiceLive.pipe(
    Layer.provide(Layer.mergeAll(NotificationRepositoryLive, RealtimeServiceLive))
  ),
  NotificationRepositoryLive,
  NotificationPreferenceRepositoryLive,
  NotificationSubscriptionRepositoryLive,
  RealtimeServiceLive
)
