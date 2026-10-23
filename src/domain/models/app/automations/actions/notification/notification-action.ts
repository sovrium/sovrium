/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { NotificationCreateActionSchema } from './create'

/**
 * Notification Action — the operators on the engine's notification store.
 *
 * Only `create` exists: a recipient reads and marks her notifications through
 * `/api/notifications`, never through a workflow, so a run cannot mark someone
 * else's notification read.
 */
export const NotificationActionSchema = Schema.Union([NotificationCreateActionSchema]).pipe(
  Schema.annotate({
    identifier: 'NotificationAction',
    title: 'Notification Action',
    description:
      'Send in-app notifications of a declared kind, honouring each recipient’s preferences for that kind',
  })
)

/** @public */
export type NotificationAction = Schema.Schema.Type<typeof NotificationActionSchema>
