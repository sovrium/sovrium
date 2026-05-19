/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const NotificationTemplateSchema = Schema.Struct({
  title: Schema.String.pipe(
    Schema.annotations({
      title: 'Template Title',
      description: 'Notification title template with {{variable}} substitution',
    })
  ),

  body: Schema.String.pipe(
    Schema.annotations({
      title: 'Template Body',
      description: 'Notification body template with {{variable}} substitution',
    })
  ),

  channels: Schema.optional(
    Schema.Array(Schema.Literal('inApp', 'email')).pipe(
      Schema.annotations({
        title: 'Template Channels',
        description: 'Which channels this notification is delivered through',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'NotificationTemplate',
    title: 'Notification Template',
    description: 'Named notification template with title, body, and channel targeting.',
  })
)
