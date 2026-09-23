/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ActionTemplateSchema } from '@/domain/models/app/actions'
import reusableActionsBody from '@/domain/models/app/actions/actions.docs.md' with { type: 'file' }
import {
  ActionBaseSchema,
  ActionRefSchema,
  ApprovalRequestActionSchema,
  AutomationCallActionSchema,
  AutomationReturnActionSchema,
  CodeRunTypescriptActionSchema,
  CryptoActionSchema,
  DataActionSchema,
  DateActionSchema,
  DelayActionSchema,
  DigestActionSchema,
  FilterContinueActionSchema,
  FlowStopActionSchema,
  LoopEachActionSchema,
  PathBranchActionSchema,
  StateActionSchema,
} from '@/domain/models/app/automations/actions'
import automationActionsOverviewBody from '@/domain/models/app/automations/actions/actions-overview.docs.md' with { type: 'file' }
import automationApprovalDelayBody from '@/domain/models/app/automations/actions/approval-delay-actions.docs.md' with { type: 'file' }
import automationCodeActionsBody from '@/domain/models/app/automations/actions/code-actions.docs.md' with { type: 'file' }
import automationCryptoDigestBody from '@/domain/models/app/automations/actions/crypto-digest-actions.docs.md' with { type: 'file' }
import automationDataActionsBody from '@/domain/models/app/automations/actions/data-state-actions.docs.md' with { type: 'file' }
import automationDateActionsBody from '@/domain/models/app/automations/actions/date-actions.docs.md' with { type: 'file' }
import automationFlowControlBody from '@/domain/models/app/automations/actions/flow-control-actions.docs.md' with { type: 'file' }
import automationSubworkflowsBody from '@/domain/models/app/automations/actions/subworkflow-actions.docs.md' with { type: 'file' }
import { ConditionGroupSchema } from '@/domain/models/app/automations/conditions'
import { defineArticle, defineSection } from './define'

export const automationActions = defineSection({
  slug: 'automation-actions',
  title: 'Actions',
  order: 5200,
  tab: 'automations',
  articles: [
    defineArticle({
      slug: 'automation-actions-overview',
      title: 'Automation Actions Overview',
      description:
        'The action model (type + operator + props), the 24 action families, and the common base properties every action accepts.',
      keywords: [
        'sovrium',
        'automation actions',
        'action model',
        'operator',
        'props',
        'retry',
        'timeout',
        'continueOnError',
        'action families',
        'date actions',
      ],
      order: 5200,
      sidebarLabel: 'Actions Overview',
      body: automationActionsOverviewBody,
      documents: [ActionBaseSchema],
      stories: [
        'US-AUTOMATIONS-ACTIONS-001',
        'US-AUTOMATIONS-ACTIONS-002',
        'US-AUTOMATIONS-ACTIONS-SOVRIUM',
      ],
    }),
    defineArticle({
      slug: 'reusable-actions',
      title: 'Reusable Actions',
      description:
        'Define an action template once in app.actions and invoke it from any automation with a ref action, so a shared step has a single source of truth.',
      keywords: [
        'sovrium',
        'reusable actions',
        'action templates',
        '$ref',
        '$vars',
        'variables',
        'ref action',
        'DRY automations',
      ],
      order: 5204,
      sidebarLabel: 'Reusable Actions',
      body: reusableActionsBody,
      documents: [ActionTemplateSchema, ActionRefSchema],
      stories: [],
    }),
    defineArticle({
      slug: 'automation-data-actions',
      title: 'Data & State Actions',
      description:
        'Reshape values in flight with the data family, persist them across runs with state, and gate a workflow on a condition with filter/continue.',
      keywords: [
        'sovrium',
        'automation data action',
        'aggregate',
        'sort',
        'deduplicate',
        'merge',
        'lookup',
        'state',
        'increment',
        'namespace',
        'ttl',
        'filter continue',
      ],
      order: 5210,
      sidebarLabel: 'Data & State',
      body: automationDataActionsBody,
      documents: [DataActionSchema, StateActionSchema, FilterContinueActionSchema],
      stories: [
        'US-AUTOMATIONS-ACTIONS-DATA',
        'US-AUTOMATIONS-ACTIONS-FILTER',
        'US-AUTOMATIONS-ACTIONS-STATE',
      ],
    }),
    defineArticle({
      slug: 'automation-crypto-digest',
      title: 'Crypto & Digest Actions',
      description:
        'Compute hashes and HMAC signatures with the crypto family, and roll many events into one batched notification with digest collect and release.',
      keywords: [
        'sovrium',
        'crypto action',
        'hash',
        'hmac',
        'sha256',
        'sha512',
        'md5',
        'encoding hex base64',
        'digest action',
        'collect',
        'release',
        'digestKey',
        'deduplicateBy',
        'batching',
      ],
      order: 5214,
      sidebarLabel: 'Crypto & Digest',
      body: automationCryptoDigestBody,
      documents: [CryptoActionSchema, DigestActionSchema],
      stories: [
        'US-AUTOMATIONS-ACTIONS-CRYPTO',
        'US-AUTOMATIONS-ACTIONS-DIGEST-COLLECT',
        'US-AUTOMATIONS-ACTIONS-DIGEST-RELEASE',
      ],
    }),
    defineArticle({
      slug: 'automation-date-actions',
      title: 'Date Actions',
      description:
        'Timezone- and locale-aware date formatting, parsing, arithmetic and boundaries — the eight date operators over a closed LDML token set.',
      keywords: [
        'sovrium',
        'automation date action',
        'format',
        'parse',
        'add',
        'subtract',
        'diff',
        'startOf',
        'endOf',
        'now',
        'timezone',
        'locale',
        'LDML tokens',
        'DST',
      ],
      order: 5216,
      sidebarLabel: 'Date Actions',
      body: automationDateActionsBody,
      documents: [DateActionSchema],
      stories: ['US-AUTOMATIONS-ACTIONS-DATE'],
    }),
    defineArticle({
      slug: 'automation-flow-control',
      title: 'Flow Control Actions',
      description:
        'Change the shape of a workflow — condition groups, path branching, loop iteration, and stopping a run early with flow/stop.',
      keywords: [
        'sovrium',
        'automation flow control',
        'condition group',
        'comparison operators',
        'path branch',
        'first-match',
        'loop each',
        'maxIterations',
        'flow stop',
        'loop.item',
      ],
      order: 5220,
      sidebarLabel: 'Flow Control',
      body: automationFlowControlBody,
      documents: [
        ConditionGroupSchema,
        PathBranchActionSchema,
        LoopEachActionSchema,
        FlowStopActionSchema,
      ],
      stories: [
        'US-AUTOMATIONS-ACTIONS-FLOW',
        'US-AUTOMATIONS-ACTIONS-LOOP',
        'US-AUTOMATIONS-ACTIONS-PATH',
      ],
    }),
    defineArticle({
      slug: 'automation-subworkflows',
      title: 'Sub-Workflow Actions',
      description:
        'Compose automations — call another workflow with automation/call, return a result with automation/return, and control depth and synchrony.',
      keywords: [
        'sovrium',
        'sub-workflow',
        'automation call',
        'automation return',
        'mode sync async',
        'maxDepth',
        'inputData',
        'automation-call trigger',
        'reusable workflow',
      ],
      order: 5224,
      sidebarLabel: 'Sub-Workflows',
      body: automationSubworkflowsBody,
      documents: [AutomationCallActionSchema, AutomationReturnActionSchema],
      stories: [
        'US-AUTOMATIONS-ACTIONS-AUTOMATION-CALL',
        'US-AUTOMATIONS-ACTIONS-AUTOMATION-RETURN',
      ],
    }),
    defineArticle({
      slug: 'automation-approval-delay',
      title: 'Approval & Delay Actions',
      description:
        'Pause a workflow for a human decision (approval) or for time/external events (delay — wait, queue, webhook callback).',
      keywords: [
        'sovrium',
        'automation approval',
        'human-in-the-loop',
        'approval request',
        'delay wait',
        'delay queue',
        'delay webhook',
        'callback',
        'rate limiting',
        'onTimeout',
      ],
      order: 5230,
      sidebarLabel: 'Approval & Delay',
      body: automationApprovalDelayBody,
      documents: [ApprovalRequestActionSchema, DelayActionSchema],
      stories: [
        'US-AUTOMATIONS-ACTIONS-APPROVAL',
        'US-AUTOMATIONS-ACTIONS-APPROVAL-REGISTER',
        'US-AUTOMATIONS-ACTIONS-DELAY-001',
        'US-AUTOMATIONS-ACTIONS-DELAY-QUEUE',
        'US-AUTOMATIONS-ACTIONS-DELAY-WEBHOOK',
      ],
    }),
    defineArticle({
      slug: 'automation-code-actions',
      title: 'Code Actions',
      description:
        'Run custom TypeScript inside an automation with a typed context — call other actions, read inputs and env, and log.',
      keywords: [
        'sovrium',
        'automation code action',
        'runTypescript',
        'code context',
        'execute',
        'sandbox',
        'inputData',
        'ctx.actions',
        'ctx.log',
      ],
      order: 5240,
      sidebarLabel: 'Code Actions',
      body: automationCodeActionsBody,
      documents: [CodeRunTypescriptActionSchema],
      stories: ['US-AUTOMATIONS-ACTIONS-CODE'],
    }),
  ],
})
