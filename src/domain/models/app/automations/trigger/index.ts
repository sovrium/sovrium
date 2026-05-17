/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthTriggerSchema } from './auth'
import { AutomationCallTriggerSchema } from './automation-call'
import { AutomationFailureTriggerSchema } from './automation-failure'
import { CommentTriggerSchema } from './comment'
import { CronTriggerSchema } from './cron'
import { FormTriggerSchema } from './form'
import { ManualTriggerSchema } from './manual'
import { RecordTriggerSchema } from './record'
import { WebhookTriggerSchema } from './webhook'

/**
 * Union of all trigger types
 */
export const TriggerSchema = Schema.Union(
  WebhookTriggerSchema,
  CronTriggerSchema,
  RecordTriggerSchema,
  AuthTriggerSchema,
  FormTriggerSchema,
  ManualTriggerSchema,
  AutomationCallTriggerSchema,
  AutomationFailureTriggerSchema,
  CommentTriggerSchema
).pipe(
  Schema.annotations({
    identifier: 'Trigger',
    title: 'Automation Trigger',
    description:
      'Event that starts an automation: webhook, cron, record change, auth event, form submission, manual trigger, automation call, automation failure, or comment creation',
  })
)

/** @public */
export type Trigger = Schema.Schema.Type<typeof TriggerSchema>
/** @public */
export type TriggerEncoded = Schema.Schema.Encoded<typeof TriggerSchema>

// Re-export all trigger type schemas
export * from './auth'
export * from './automation-call'
export * from './automation-failure'
export * from './comment'
export * from './cron'
export * from './form'
export * from './manual'
export * from './record'
export * from './webhook'
