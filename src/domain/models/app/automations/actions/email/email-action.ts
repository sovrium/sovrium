/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EmailSendActionSchema } from './send'
import { EmailStatsActionSchema } from './stats'
import { EmailSuppressActionSchema } from './suppress'

/**
 * Email Action — union of all email operators
 */
export const EmailActionSchema = Schema.Union([
  EmailSendActionSchema,
  EmailSuppressActionSchema,
  EmailStatsActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'EmailAction',
    title: 'Email Action',
    description:
      'Email operations: sending a message, suppressing an address that bounced, complained or left a list, and counting what a campaign sent',
  })
)
/** @public */
export type EmailAction = typeof EmailActionSchema.Type
