/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DigestConfigSchema } from '../digest-config'


export const NotificationChannelSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('inApp'),
    enabled: Schema.optional(Schema.Boolean),
  }),
  Schema.Struct({
    type: Schema.Literal('email'),
    enabled: Schema.optional(Schema.Boolean),
    from: Schema.String.pipe(
      Schema.annotations({
        title: 'From Address',
        description: 'Sender email address for notification emails',
      })
    ),
    replyTo: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Reply-to email address' }))
    ),
    digest: Schema.optional(DigestConfigSchema),
  })
).pipe(
  Schema.annotations({
    identifier: 'NotificationChannel',
    title: 'Notification Channel',
    description: 'Notification delivery channel (inApp or email)',
  })
)
