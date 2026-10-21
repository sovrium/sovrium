/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation registries: one per automation source, a trigger or step of
 * the source → a Sovrium trigger, action or library connection call.
 *
 * ## The registry is the whole rule
 *
 * A step becomes a Sovrium action only through its tool's rows here. A step no
 * row matches stays a TODO quoting its definition, and the automation holding
 * it is imported with `enabled: false`. A code step always becomes a
 * `code/runTypescript` stub that keeps the original source as a comment, and is
 * always a TODO: no translation of JavaScript or Python is attempted.
 *
 * ## App steps prefer the connection library
 *
 * A third-party app step maps to a `connection/call` of an operation from the
 * library (`src/library/connection/<slug>.ts`). The mapper then adds the
 * matching `connections[]` entry and the `env[]` NAME its token reads; the
 * operator sets the value. When the app is the one being migrated — an Airtable
 * step in an n8n workflow that moves with the base — the step becomes a
 * `record/*` action on the imported table instead.
 *
 * ## Typed against the real unions
 *
 * Action targets are typed by the `Action` union and trigger targets by the
 * `Trigger` union, so a target that does not exist does not compile. A
 * connection target is typed as a string because the domain may not import the
 * library; the co-located test reads the library tree and checks every slug and
 * operation exists.
 *
 * Source names are as each tool spells them in its export. The Zapier, Retool
 * Workflows and Baserow rows are written against formats the fixture lane
 * verifies; a row whose spelling the pinned fixture disproves is corrected
 * here, never worked around in an adapter.
 */

import { N8N_APP_TRIGGERS } from './app-trigger-mappings'
import { MAKE_SET, MAKE_SET_MANY, N8N_SET } from './flow-set-fields-mappings'
import { action, call, CODE_TODO, type StepMapping, type TriggerMapping } from './flow-step-targets'
import { normaliseZapierApp, ZAPIER_STEPS, ZAPIER_TRIGGERS } from './zapier-step-mappings'
import type { ImportSourceTool } from './import-source'

export type { StepMapping, TriggerMapping } from './flow-step-targets'

/** The tools whose automations become Sovrium automations. */
export type AutomationSourceTool = Extract<
  ImportSourceTool,
  'n8n' | 'make' | 'zapier' | 'retool-workflows' | 'baserow' | 'webflow'
>

const N8N_TRIGGERS: readonly TriggerMapping[] = [
  { source: 'n8n-nodes-base.scheduleTrigger', target: 'cron' },
  { source: 'n8n-nodes-base.cron', target: 'cron' },
  { source: 'n8n-nodes-base.webhook', target: 'webhook' },
  { source: 'n8n-nodes-base.manualTrigger', target: 'manual' },
  { source: 'n8n-nodes-base.errorTrigger', target: 'automation-failure' },
  { source: 'n8n-nodes-base.executeWorkflowTrigger', target: 'automation-call' },
  {
    source: 'n8n-nodes-base.formTrigger',
    target: 'form',
    loss: "The n8n form's fields are not imported; the trigger names a form the operator declares",
  },
  {
    source: 'n8n-nodes-base.airtableTrigger',
    target: 'record',
    loss: "A polled 'record changed' trigger becomes a record event on the imported table",
  },
  ...N8N_APP_TRIGGERS,
]

const N8N_STEPS: readonly StepMapping[] = [
  { source: 'n8n-nodes-base.httpRequest', target: action('http', 'request') },
  { source: 'n8n-nodes-base.if', target: action('path', 'branch') },
  { source: 'n8n-nodes-base.switch', target: action('path', 'branch') },
  { source: 'n8n-nodes-base.filter', target: action('filter', 'continue') },
  { source: 'n8n-nodes-base.splitInBatches', target: action('loop', 'each') },
  { source: 'n8n-nodes-base.wait', target: action('delay', 'wait') },
  { source: 'n8n-nodes-base.set', target: action('data', 'set'), fields: N8N_SET },
  { source: 'n8n-nodes-base.emailSend', target: action('email', 'send') },
  { source: 'n8n-nodes-base.respondToWebhook', target: action('webhook', 'response') },
  { source: 'n8n-nodes-base.stopAndError', target: action('flow', 'stop') },
  { source: 'n8n-nodes-base.code', target: action('code', 'runTypescript'), todo: CODE_TODO },
  { source: 'n8n-nodes-base.function', target: action('code', 'runTypescript'), todo: CODE_TODO },
  {
    source: 'n8n-nodes-base.functionItem',
    target: action('code', 'runTypescript'),
    todo: CODE_TODO,
  },
  {
    source: 'n8n-nodes-base.noOp',
    target: { kind: 'none', reason: 'A no-op node does nothing; it is dropped' },
  },
  { source: 'n8n-nodes-base.airtable', operation: 'create', target: action('record', 'create') },
  { source: 'n8n-nodes-base.airtable', operation: 'update', target: action('record', 'update') },
  { source: 'n8n-nodes-base.airtable', operation: 'search', target: action('record', 'list') },
  { source: 'n8n-nodes-base.airtable', operation: 'delete', target: action('record', 'delete') },
  {
    source: 'n8n-nodes-base.slack',
    operation: 'message.post',
    target: call('slack', 'post-message'),
  },
  {
    source: 'n8n-nodes-base.slack',
    operation: 'message.update',
    target: call('slack', 'update-message'),
  },
  {
    source: 'n8n-nodes-base.gmail',
    operation: 'message.send',
    target: call('google', 'send-email'),
  },
  {
    source: 'n8n-nodes-base.googleCalendar',
    operation: 'event.create',
    target: call('google', 'create-event'),
  },
  {
    source: 'n8n-nodes-base.microsoftOutlook',
    operation: 'message.send',
    target: call('microsoft-365', 'send-mail'),
  },
  {
    source: 'n8n-nodes-base.hubspot',
    operation: 'contact.upsert',
    target: call('hubspot', 'post-v3-objects-contacts'),
  },
  {
    source: 'n8n-nodes-base.notion',
    operation: 'databasePage.create',
    target: call('notion', 'create-page'),
  },
  {
    source: 'n8n-nodes-base.github',
    operation: 'issue.create',
    target: call('github', 'create-issue'),
  },
  {
    source: 'n8n-nodes-base.pipedrive',
    operation: 'person.create',
    target: call('pipedrive', 'create-person'),
  },
  {
    source: 'n8n-nodes-base.mailchimp',
    operation: 'member.create',
    target: call('mailchimp', 'add-member'),
  },
  {
    source: 'n8n-nodes-base.discord',
    operation: 'message.send',
    target: call('discord', 'create-message'),
  },
  {
    source: 'n8n-nodes-base.twilio',
    operation: 'sms.send',
    target: call('twilio', 'send-message'),
  },
  {
    source: 'n8n-nodes-base.dropbox',
    operation: 'file.upload',
    target: call('dropbox', 'upload-file'),
  },
  {
    source: 'n8n-nodes-base.jira',
    operation: 'issue.create',
    target: call('jira', 'create-issue'),
  },
]

const MAKE_TRIGGERS: readonly TriggerMapping[] = [
  { source: 'gateway:CustomWebHook', target: 'webhook' },
  {
    source: 'scheduling',
    target: 'cron',
    loss: "Make's interval scheduling becomes the equivalent cron expression",
  },
  {
    source: 'airtable:TriggerWatchRecords',
    target: 'record',
    loss: "A polled 'watch records' trigger becomes a record event on the imported table",
  },
]

const MAKE_STEPS: readonly StepMapping[] = [
  { source: 'builtin:BasicRouter', target: action('path', 'branch') },
  { source: 'builtin:BasicIfElse', target: action('path', 'branch') },
  { source: 'filter', target: action('filter', 'continue') },
  { source: 'builtin:BasicFeeder', target: action('loop', 'each') },
  {
    source: 'builtin:BasicAggregator',
    target: action('data', 'aggregate'),
    loss: "Make's aggregator target structure is not kept; the items are collected as a list",
  },
  { source: 'util:FunctionSleep', target: action('delay', 'wait') },
  { source: 'util:SetVariable2', target: action('data', 'set'), fields: MAKE_SET },
  { source: 'util:SetVariables', target: action('data', 'set'), fields: MAKE_SET_MANY },
  { source: 'http:ActionSendData', target: action('http', 'request') },
  { source: 'http:ActionSendDataBasicAuth', target: action('http', 'request') },
  { source: 'email:ActionSendEmail', target: action('email', 'send') },
  { source: 'gateway:WebhookRespond', target: action('webhook', 'response') },
  { source: 'airtable:ActionCreateRecord', target: action('record', 'create') },
  { source: 'airtable:ActionUpdateRecords', target: action('record', 'update') },
  { source: 'airtable:ActionSearchRecords', target: action('record', 'list') },
  { source: 'airtable:ActionDeleteRecords', target: action('record', 'delete') },
  { source: 'slack:CreateMessage', target: call('slack', 'post-message') },
  { source: 'google-email:ActionSendEmail', target: call('google', 'send-email') },
  { source: 'hubspotcrm:createContact', target: call('hubspot', 'post-v3-objects-contacts') },
  { source: 'github:createIssue', target: call('github', 'create-issue') },
]

/**
 * Retool Workflows rows key on a block's `blockType`, as the "Export to JSON"
 * file writes it; a REST block's request and a Loop are typed by the adapter
 * (`retool-workflow-adapter-service.ts`), so they need no row.
 */
const RETOOL_WORKFLOWS_TRIGGERS: readonly TriggerMapping[] = [
  { source: 'webhook', target: 'webhook' },
]

const RETOOL_WORKFLOWS_STEPS: readonly StepMapping[] = [
  { source: 'conditional', target: action('path', 'branch') },
  {
    source: 'webhookReturn',
    target: action('webhook', 'response'),
    params: { body: 'body?' },
    loss: 'The response status is not carried over; the reply is sent with status 200',
  },
  { source: 'code', target: action('code', 'runTypescript'), todo: CODE_TODO },
]

/** Baserow rows key on a workflow node's `type`, as the workspace export writes it. */
const BASEROW_TRIGGERS: readonly TriggerMapping[] = [
  { source: 'local_baserow_rows_created', target: 'record' },
  { source: 'local_baserow_rows_updated', target: 'record' },
  { source: 'local_baserow_rows_deleted', target: 'record' },
  { source: 'manual', target: 'manual' },
]

const BASEROW_STEPS: readonly StepMapping[] = [
  { source: 'local_baserow_create_row', target: action('record', 'create') },
  { source: 'local_baserow_update_row', target: action('record', 'update') },
  { source: 'local_baserow_delete_row', target: action('record', 'delete') },
  { source: 'smtp_email', target: action('email', 'send') },
  { source: 'http_request', target: action('http', 'request') },
  { source: 'iterator', target: action('loop', 'each') },
  { source: 'router', target: action('path', 'branch') },
]

const WEBFLOW_TRIGGERS: readonly TriggerMapping[] = [
  {
    source: 'form_submission',
    target: 'form',
    loss: 'Only form-submission webhooks remain: Webflow Logic was switched off on 2025-06-27',
  },
]

/** Every automation source's trigger registry. */
export const TRIGGER_MAPPINGS: Readonly<Record<AutomationSourceTool, readonly TriggerMapping[]>> = {
  n8n: N8N_TRIGGERS,
  make: MAKE_TRIGGERS,
  zapier: ZAPIER_TRIGGERS,
  'retool-workflows': RETOOL_WORKFLOWS_TRIGGERS,
  baserow: BASEROW_TRIGGERS,
  webflow: WEBFLOW_TRIGGERS,
}

/** Every automation source's step registry. */
export const STEP_MAPPINGS: Readonly<Record<AutomationSourceTool, readonly StepMapping[]>> = {
  n8n: N8N_STEPS,
  make: MAKE_STEPS,
  zapier: ZAPIER_STEPS,
  'retool-workflows': RETOOL_WORKFLOWS_STEPS,
  baserow: BASEROW_STEPS,
  webflow: [],
}

/** Whether a tool is an automation source, so its registries exist. */
export const isAutomationSourceTool = (tool: ImportSourceTool): tool is AutomationSourceTool =>
  Object.hasOwn(STEP_MAPPINGS, tool)

/**
 * How each tool's step and trigger names are compared. Zapier writes one app
 * as `SlackAPI`, `SlackCLIAPI` or `SlackCLIAPI@1.2.0` depending on the
 * integration's generation, so its names are compared without the version and
 * the suffix ({@link normaliseZapierApp}); every other tool's names are exact.
 */
const SOURCE_KEYS: Readonly<Partial<Record<AutomationSourceTool, (source: string) => string>>> = {
  zapier: normaliseZapierApp,
}

/** The row of `rows` for a source and operation: a specific operation first, then a catch-all. */
const rowFor = <Row extends { readonly source: string; readonly operation?: string }>(
  tool: AutomationSourceTool,
  all: readonly Row[],
  source: string,
  operation: string | undefined
): Row | undefined => {
  const key = SOURCE_KEYS[tool] ?? ((name: string) => name)
  const rows = all.filter((row) => key(row.source) === key(source))
  return (
    rows.find((row) => row.operation !== undefined && row.operation === operation) ??
    rows.find((row) => row.operation === undefined)
  )
}

/**
 * Find the registry row for a source step.
 *
 * A row with an `operation` matches only that operation; a row without one
 * matches every operation of its step type. The more specific row wins, so an
 * Airtable `delete` is never read as a generic Airtable step. `undefined` means
 * the step is a TODO.
 */
export const lookupStep = (
  tool: AutomationSourceTool,
  source: string,
  operation?: string
): StepMapping | undefined => rowFor(tool, STEP_MAPPINGS[tool], source, operation)

/** Find the registry row for a source trigger, with the same precedence as {@link lookupStep}. */
export const lookupTrigger = (
  tool: AutomationSourceTool,
  source: string,
  operation?: string
): TriggerMapping | undefined => rowFor(tool, TRIGGER_MAPPINGS[tool], source, operation)
