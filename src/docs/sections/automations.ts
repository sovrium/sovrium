/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AutomationSchema } from '@/domain/models/app/automations/automation'
import automationRetryFailureBody from '@/domain/models/app/automations/automation-retry-failure.docs.md' with { type: 'file' }
import automationRunsBody from '@/domain/models/app/automations/automation-runs.docs.md' with { type: 'file' }
import automationTriggersBody from '@/domain/models/app/automations/automation-triggers.docs.md' with { type: 'file' }
import automationsOverviewBody from '@/domain/models/app/automations/automations-overview.docs.md' with { type: 'file' }
import { RetryConfigSchema } from '@/domain/models/app/automations/retry'
import {
  ApiKeyConnectionSchema,
  BasicConnectionSchema,
  BearerConnectionSchema,
  OAuth2ConnectionSchema,
} from '@/domain/models/app/connections'
import automationConnectionsBody from '@/domain/models/app/connections/connections.docs.md' with { type: 'file' }
import { EnvVarSchema } from '@/domain/models/app/env'
import automationEnvVarsBody from '@/domain/models/app/env/env.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const automations = defineSection({
  slug: 'automations',
  title: 'Automations',
  order: 5000,
  tab: 'automations',
  articles: [
    defineArticle({
      slug: 'automations-overview',
      title: 'Automations Overview',
      description:
        'Event-driven workflows — a single trigger paired with an ordered list of actions, with data flowing between steps via template variables.',
      keywords: [
        'sovrium',
        'automations',
        'workflows',
        'triggers',
        'actions',
        'event-driven',
        'template variables',
        'concurrency',
        'runs',
      ],
      order: 5000,
      sidebarLabel: 'Automations Overview',
      body: automationsOverviewBody,
      documents: [AutomationSchema],
      stories: [
        'US-AUTOMATIONS-AUTOMATION-DEFINITIONS-001',
        'US-AUTOMATIONS-AUTOMATION-DEFINITIONS-002',
        'US-AUTOMATIONS-RUNS-API',
        'US-AUTOMATIONS-TEMPLATE-HELPERS',
      ],
    }),
    defineArticle({
      slug: 'automation-triggers',
      title: 'Triggers Overview',
      description:
        'The nine automation trigger types at a glance — what starts each one, the context it exposes, and where each is configured in detail.',
      keywords: [
        'sovrium',
        'automation triggers',
        'trigger types',
        'webhook',
        'cron',
        'record',
        'auth',
        'form',
        'manual',
        'automation-call',
        'automation-failure',
        'comment',
        'trigger context',
      ],
      order: 5010,
      sidebarLabel: 'Triggers Overview',
      body: automationTriggersBody,
      documents: [],
      stories: ['US-AUTOMATIONS-TRIGGERS-001', 'US-AUTOMATIONS-TRIGGERS-SCHEDULE'],
    }),
    defineArticle({
      slug: 'automation-runs',
      title: 'Automation Runs',
      description:
        'Monitor, debug, replay, and cancel automation executions via the runs API — with run and step statuses.',
      keywords: [
        'sovrium',
        'automation runs',
        'run status',
        'step status',
        'replay',
        'cancel',
        'pending',
        'running',
        'completed',
        'failed',
        'skipped',
        'runs API',
      ],
      order: 5020,
      sidebarLabel: 'Runs',
      body: automationRunsBody,
      documents: [],
      stories: ['US-AUTOMATIONS-OPERATIONAL-PAUSE'],
    }),
    defineArticle({
      slug: 'automation-retry-failure',
      title: 'Retry & Failure Handling',
      description:
        'Retry policies (fixed/exponential), automation- and action-level timeouts, dead-letter exhaustion, idempotent resume, deduplication, and partial-failure recovery.',
      keywords: [
        'sovrium',
        'automation retry',
        'maxAttempts',
        'exponential backoff',
        'timeout',
        'dead letter',
        'exhausted',
        'idempotency',
        'deduplication',
        'continueOnError',
        'partial failure',
      ],
      order: 5030,
      sidebarLabel: 'Retry & Failure',
      body: automationRetryFailureBody,
      documents: [RetryConfigSchema],
      stories: [
        'US-AUTOMATIONS-RETRY-AND-FAILURE-001',
        'US-AUTOMATIONS-RETRY-AND-FAILURE-002',
        'US-AUTOMATIONS-RETRY-AND-FAILURE-004',
        'US-AUTOMATIONS-RETRY-AND-FAILURE-005',
        'US-AUTOMATIONS-RETRY-AND-FAILURE-006',
        'US-AUTOMATIONS-RETRY-AND-FAILURE-007',
        'US-AUTOMATIONS-SAFETY-INFINITE-LOOP-DETECTION',
      ],
    }),
    defineArticle({
      slug: 'automation-connections',
      title: 'Connections',
      description:
        'Reusable external-service credentials — OAuth2 (with token refresh, PKCE, app-wide or per-user tokens), API key, basic auth, and bearer token.',
      keywords: [
        'sovrium',
        'connections',
        'oauth2',
        'api key',
        'basic auth',
        'bearer token',
        'token refresh',
        'pkce',
        'app scope',
        'per-user tokens',
        '$connection',
      ],
      order: 5040,
      sidebarLabel: 'Connections',
      body: automationConnectionsBody,
      documents: [
        OAuth2ConnectionSchema,
        ApiKeyConnectionSchema,
        BasicConnectionSchema,
        BearerConnectionSchema,
      ],
      stories: [
        'US-AUTOMATIONS-CONNECTIONS-ACTION-AUTH',
        'US-AUTOMATIONS-CONNECTIONS-APP-SCOPED-TOKENS',
        'US-AUTOMATIONS-CONNECTIONS-CONFIGURATION',
        'US-AUTOMATIONS-CONNECTIONS-CUSTOM-PARAMS',
        'US-AUTOMATIONS-CONNECTIONS-OAUTH2-FLOW',
        'US-AUTOMATIONS-CONNECTIONS-PER-USER-TOKENS',
        'US-AUTOMATIONS-CONNECTIONS-TOKEN-REFRESH',
      ],
    }),
    defineArticle({
      slug: 'automation-env-vars',
      title: 'Environment Variables',
      description:
        'Declare environment variables and secrets for automations under app.env, then reference them with $env.VAR — never logged.',
      keywords: [
        'sovrium',
        'environment variables',
        'app.env',
        'secrets',
        '$env',
        'automations',
        'required',
        'default',
        'redaction',
      ],
      order: 5050,
      sidebarLabel: 'Environment Variables',
      body: automationEnvVarsBody,
      documents: [EnvVarSchema],
      stories: [],
    }),
  ],
})
