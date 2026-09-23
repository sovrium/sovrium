/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  AuthTriggerSchema,
  AutomationCallTriggerSchema,
  AutomationFailureTriggerSchema,
  CommentTriggerFilterSchema,
  CommentTriggerSchema,
  CronTriggerSchema,
  FormTriggerSchema,
  ManualTriggerSchema,
  RecordTriggerSchema,
  WebhookTriggerSchema,
} from '@/domain/models/app/automations/trigger'
import triggerAuthFormBody from '@/domain/models/app/automations/trigger/auth-form-triggers.docs.md' with { type: 'file' }
import triggerManualChainedBody from '@/domain/models/app/automations/trigger/manual-chained-triggers.docs.md' with { type: 'file' }
import triggerRecordCommentBody from '@/domain/models/app/automations/trigger/record-comment-triggers.docs.md' with { type: 'file' }
import triggerWebhookCronBody from '@/domain/models/app/automations/trigger/webhook-cron-triggers.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const automationTriggers = defineSection({
  slug: 'automation-triggers',
  title: 'Triggers',
  order: 5100,
  tab: 'automations',
  articles: [
    defineArticle({
      slug: 'trigger-record-comment',
      title: 'Record & Comment Triggers',
      description:
        'Fire an automation when data changes or when someone comments — watched tables and fields, change conditions, and comment moderation and mention filters.',
      keywords: [
        'sovrium',
        'record trigger',
        'watchFields',
        'create update delete',
        'trigger condition',
        'comment trigger',
        'respectReadPermissions',
        'mentionsOnly',
        'topLevelOnly',
        'moderation',
        'mentionedEmails',
        'notify mentioned users',
      ],
      order: 5100,
      sidebarLabel: 'Record & Comment',
      body: triggerRecordCommentBody,
      documents: [RecordTriggerSchema, CommentTriggerSchema, CommentTriggerFilterSchema],
      stories: [
        'US-AUTOMATIONS-TRIGGERS-COMMENT-EVENT-TOP-ROLE-READ-GATE',
        'US-AUTOMATIONS-TRIGGERS-COMMENT-POSTED',
        'US-AUTOMATIONS-TRIGGERS-RECORD',
        'US-AUTOMATIONS-TRIGGERS-RECORD-CONDITION-FIELDS',
      ],
    }),
    defineArticle({
      slug: 'trigger-webhook-cron',
      title: 'Webhook & Cron Triggers',
      description:
        'Start an automation from an inbound HTTP request or a schedule — methods, inbound auth, deduplication, rate limits, and cron expressions with timezones.',
      keywords: [
        'sovrium',
        'webhook trigger',
        'inbound HTTP',
        'hmac',
        'bearer',
        'apiKey',
        'deduplicationKey',
        'rateLimit',
        'respondImmediately',
        'cron trigger',
        'cron expression',
        'timezone',
      ],
      order: 5110,
      sidebarLabel: 'Webhook & Cron',
      body: triggerWebhookCronBody,
      documents: [WebhookTriggerSchema, CronTriggerSchema],
      stories: ['US-AUTOMATIONS-TRIGGERS-WEBHOOK'],
    }),
    defineArticle({
      slug: 'trigger-auth-form',
      title: 'Auth & Form Triggers',
      description:
        'Fire an automation from something a person did — the five authentication lifecycle events, and top-level form submissions referenced by name.',
      keywords: [
        'sovrium',
        'auth trigger',
        'signUp',
        'signIn',
        'signOut',
        'passwordReset',
        'emailVerified',
        'form trigger',
        'forms name',
        'form submission',
        'onboarding automation',
      ],
      order: 5120,
      sidebarLabel: 'Auth & Form',
      body: triggerAuthFormBody,
      documents: [AuthTriggerSchema, FormTriggerSchema],
      stories: ['US-AUTOMATIONS-TRIGGERS-AUTH', 'US-AUTOMATIONS-TRIGGERS-FORM'],
    }),
    defineArticle({
      slug: 'trigger-manual-chained',
      title: 'Manual, Sub-Automation & Failure Triggers',
      description:
        'The three triggers nothing external starts — an operator pressing a button, one automation calling another, and a workflow reacting to a failed run.',
      keywords: [
        'sovrium',
        'manual trigger',
        'requiredRole',
        'inputSchema',
        'aiAccess',
        'automation-call trigger',
        'sub-workflow',
        'automation-failure trigger',
        'failure handling',
        'maxDepth',
      ],
      order: 5130,
      sidebarLabel: 'Manual & Chained',
      body: triggerManualChainedBody,
      documents: [ManualTriggerSchema, AutomationCallTriggerSchema, AutomationFailureTriggerSchema],
      stories: [
        'US-AUTOMATIONS-TRIGGERS-AUTOMATION-CALL',
        'US-AUTOMATIONS-TRIGGERS-AUTOMATION-FAILURE',
        'US-AUTOMATIONS-TRIGGERS-MANUAL',
      ],
    }),
  ],
})
