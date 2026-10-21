/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Zapier registries: a Zap's trigger or step → a Sovrium trigger, action
 * or library connection call.
 *
 * ## How a row is keyed
 *
 * A Zap step names its app in `selected_api` and its operation in `action`.
 * The app is written three ways for one integration: `SlackAPI` (the legacy
 * platform), `SlackCLIAPI` (the CLI platform) and either with an `@<version>`
 * suffix. {@link normaliseZapierApp} strips both, so ONE row matches every
 * spelling; the suffixes it strips are {@link ZAPIER_APP_SUFFIXES}. Rows are
 * written in the spelling the most frequent exports use.
 *
 * ## The rows are ordered by how often Zaps use them
 *
 * The step and trigger rows were chosen from the frequency of app and action
 * pairs across a large corpus of real Zaps. Rows for a Sovrium action whose
 * inputs cannot be carried over (an Airtable record step, whose base is not
 * the app being migrated) state no `params`: the step is kept as a stub that
 * names the action it maps to, so the automation keeps its full typed shape.
 *
 * ## Apps the library lacks
 *
 * A row may name a connection the library does not hold yet: the import then
 * writes the observed-apps catalogue's connection (`flow-app-catalogue-rows.ts`),
 * and once the app is promoted into the library, as Dropbox, Mailjet and Google
 * Sheets were, the same row installs the library's. An app neither holds, such as a private
 * integration, has no row: its step becomes an http request on a connection
 * skeleton named after the app.
 *
 * ## Formatter sub-operations
 *
 * A Formatter step's `action` is its family (`text`, `datetime`, …) and its
 * `transform` input the operation within it. The adapter keys such a step
 * `<family>:<transform>`; only the pairs with a one-to-one Sovrium action have
 * a row, and the rest are TODOs.
 */

import { ZAPIER_APP_TRIGGERS } from './app-trigger-mappings'
import {
  action,
  byHand,
  call,
  CODE_TODO,
  type StepMapping,
  type TriggerMapping,
} from './flow-step-targets'

/** The app-name suffixes Zapier's two integration platforms add, longest first. */
export const ZAPIER_APP_SUFFIXES: readonly string[] = ['CLIAPI', 'API']

/** An app name without its `@<version>` and its platform suffix: `SlackCLIAPI@1.2.0` → `Slack`. */
export const normaliseZapierApp = (selectedApi: string): string => {
  const [bare = ''] = selectedApi.split('@')
  const suffix = ZAPIER_APP_SUFFIXES.find((one) => bare.endsWith(one) && bare !== one)
  return suffix === undefined ? bare : bare.slice(0, -suffix.length)
}

/**
 * The app a step is kept under when its export names none (`"selected_api":
 * null`): the step is never dropped, it becomes a TODO saying so.
 */
export const NO_APP = ''

/** One row per operation, for rows that differ only by operation. */
const each = <Row>(
  operations: readonly string[],
  row: (operation: string) => Row
): readonly Row[] => operations.map(row)

const RECORD_IN_VIEW_LOSS =
  "Airtable's 'new record in view' fires when a record enters a view; it becomes a record-created event"

/**
 * A form tool's submission trigger: the imported form's trigger, else the
 * tool's own webhook, registered by the row's connection operation.
 */
const ownWebhookLoss = (tool: string): string =>
  `${tool} calls the trigger with its own webhook body, not with the answers of an imported form`

/** A Zap's first step, by app and action. */
export const ZAPIER_TRIGGERS: readonly TriggerMapping[] = [
  ...each(['hook_raw', 'hook', 'hook_v2'], (operation) => ({
    source: 'WebHookCLIAPI',
    operation,
    target: 'webhook' as const,
  })),
  { source: 'ScheduleCLIAPI', target: 'cron' },
  { source: 'AirtableCLIAPI', operation: 'newRecord', target: 'record' },
  {
    source: 'AirtableCLIAPI',
    operation: 'newRecordInView',
    target: 'record',
    loss: RECORD_IN_VIEW_LOSS,
  },
  { source: 'AirtableCLIAPI', operation: 'updated_record', target: 'record' },
  {
    source: 'TypeformCLIAPI',
    operation: 'entries_resthook_v2',
    target: 'form',
    loss: ownWebhookLoss('Typeform'),
    connection: { connection: 'typeform', operation: 'put-webhook' },
  },
  {
    source: 'JotFormCLIAPI',
    operation: 'newSubmission',
    target: 'form',
    loss: ownWebhookLoss('Jotform'),
    connection: { connection: 'jotform', operation: 'create-form-webhook' },
  },
  {
    source: 'WebflowCLIAPI',
    operation: 'form_submission',
    target: 'form',
    loss: ownWebhookLoss('Webflow'),
    connection: { connection: 'webflow', operation: 'create-webhook' },
  },
  {
    source: 'lemlistCLIAPI',
    operation: 'activity',
    target: 'webhook',
    todo: "lemlist sent Zapier each new campaign activity; register a lemlist webhook for the activity types the Zap watched, pointing at this automation's webhook, with the lemlist connection's post-hooks operation",
    connection: { connection: 'lemlist', operation: 'post-hooks' },
  },
  {
    source: 'GoogleMailV2CLIAPI',
    operation: 'search',
    target: 'manual',
    todo: 'Zapier polled Gmail for new messages matching a search; Sovrium has no mail trigger, so the automation runs on a cron schedule whose first step lists the messages with google/list-messages and the same query',
  },
  {
    source: NO_APP,
    target: 'manual',
    todo: 'The export names no app for this trigger, so what started the Zap is not known; it starts by hand until its trigger is rebuilt from the Zap in Zapier',
  },
  {
    source: 'ZapierPushConvertedCLIAPI',
    operation: 'push',
    target: 'manual',
    todo: "The Zap started from Zapier's Chrome extension, which sent it the page open in the browser; it starts by hand, the page's address given as its input, until another trigger replaces it",
  },
  {
    source: 'MailParserIOCLIAPI',
    operation: 'automatic_new_email',
    target: 'webhook',
    todo: "Mailparser handed each parsed email to Zapier; point Mailparser's own webhook integration at this automation's webhook, which receives the parsed fields as its body",
  },
  ...ZAPIER_APP_TRIGGERS,
]

/** The record events an Airtable trigger stands for, by action. */
export const ZAPIER_RECORD_EVENTS: Readonly<
  Record<string, readonly ('create' | 'update' | 'delete')[]>
> = {
  newRecord: ['create'],
  newRecordInView: ['create'],
  updated_record: ['update'],
}

/** What a Formatter family's transforms become, when the export does not name the one a step runs. */
const FORMATTER_FAMILIES: Readonly<Record<string, string>> = {
  datetime_line_item: 'format a date (date/format), add or subtract time (date/add, date/subtract)',
  number_line_item: 'format a number, a currency or a phone number, or do maths: a code step',
  text_line_item: 'change case, replace, split or extract text: a code step, or data/split',
  util_line_item: 'build or read line items: data/split, data/merge, or a code step',
}

/**
 * The Formatter steps of the line-item generation (`datetime_line_item`, …).
 * The date transforms with a one-to-one Sovrium action map to it; a step
 * whose export names no transform (an API dump) is a TODO naming what its
 * family's transforms become.
 */
const FORMATTER_LINE_ITEM_STEPS: readonly StepMapping[] = [
  {
    source: 'ZapierFormatterCLIAPI',
    operation: 'datetime_line_item:formatting',
    target: action('date', 'format'),
  },
  {
    source: 'ZapierFormatterCLIAPI',
    operation: 'datetime_line_item:add_time',
    target: action('date', 'add'),
  },
  ...Object.entries(FORMATTER_FAMILIES).map(([family, becomes]) => ({
    source: 'ZapierFormatterCLIAPI',
    operation: family,
    target: byHand(
      `The export does not name the transform of this Formatter ${family} step; rebuild it by what it does — ${becomes}`
    ),
  })),
]

const AIRTABLE_TODO =
  "The Airtable base is not the app being migrated, so the step's table and fields are set by hand"

/** A Zap's later steps, by app and action. */
export const ZAPIER_STEPS: readonly StepMapping[] = [
  { source: 'BranchingAPI', operation: 'branch', target: action('path', 'branch') },
  { source: 'BranchingAPI', operation: 'filter', target: action('filter', 'continue') },
  { source: 'FilterAPI', target: action('filter', 'continue') },
  ...each(['post', 'get', 'put', 'custom'], (operation) => ({
    source: 'WebHookCLIAPI',
    operation,
    target: action('http', 'request'),
  })),
  { source: 'CodeCLIAPI', target: action('code', 'runTypescript'), todo: CODE_TODO },
  ...each(['run_javascript', 'run_async_javascript'], (operation) => ({
    source: 'App64450CLIAPI',
    operation,
    target: action('code', 'runTypescript'),
    todo: CODE_TODO,
  })),
  ...each(['send_channel_message', 'channel_message'], (operation) => ({
    source: 'SlackCLIAPI',
    operation,
    target: call('slack', 'post-message'),
  })),
  {
    source: 'HubSpotCLIAPI',
    operation: 'create_contact',
    target: call('hubspot', 'post-v3-objects-contacts'),
  },
  {
    source: 'HubSpotCLIAPI',
    operation: 'upsert_contact',
    target: call('hubspot', 'post-v3-objects-contacts'),
    loss: 'An upsert becomes a create: a contact that already exists makes the call fail',
  },
  { source: 'GoogleMailV2CLIAPI', operation: 'message', target: call('google', 'send-email') },
  {
    source: 'AirtableCLIAPI',
    operation: 'findRecord',
    target: action('record', 'list'),
    todo: AIRTABLE_TODO,
  },
  {
    source: 'AirtableCLIAPI',
    operation: 'updateRecord',
    target: action('record', 'update'),
    todo: AIRTABLE_TODO,
  },
  {
    source: 'AirtableCLIAPI',
    operation: 'createRecord',
    target: action('record', 'create'),
    todo: AIRTABLE_TODO,
  },
  {
    source: 'MailJetCLIAPI',
    operation: 'send_email_with_template_v2',
    target: call('mailjet', 'send-email'),
  },
  {
    source: 'ZapierFormatterCLIAPI',
    operation: 'datetime:formatting',
    target: action('date', 'format'),
  },
  {
    source: 'ZapierFormatterCLIAPI',
    operation: 'datetime:add_time',
    target: action('date', 'add'),
  },
  ...each(['delay_for', 'delay_until'], (operation) => ({
    source: 'DelayCLIAPI',
    operation,
    target: action('delay', 'wait'),
  })),
  ...FORMATTER_LINE_ITEM_STEPS,
  {
    source: 'GoogleSheetsV2CLIAPI',
    operation: 'add_row',
    target: call('google-sheets', 'append-sheet-values'),
  },
  { source: 'GoogleDriveCLIAPI', operation: 'file', target: call('google', 'upload-file') },
  { source: 'GoogleDriveCLIAPI', operation: 'share_file', target: call('google', 'share-file') },
  { source: 'DropBoxCLIAPI', operation: 'file', target: call('dropbox', 'upload-file') },
  {
    source: 'MicrosoftOutlookCLIAPI',
    operation: 'send_email',
    target: call('microsoft-365', 'send-mail'),
  },
  {
    source: 'SalesforceCLIAPI',
    operation: 'find_record',
    target: call('salesforce', 'query'),
    loss: "Zapier finds a record by one field's value; the call runs a SOQL query, written from that object and field",
  },
  {
    source: 'SalesforceCLIAPI',
    operation: 'find_record_by_query',
    target: call('salesforce', 'query'),
    loss: 'Zapier runs a SOQL WHERE clause on the object the step picks; the call runs a whole SOQL query, written from that object and clause',
  },
  {
    source: 'SalesforceCLIAPI',
    operation: 'create_record',
    target: byHand(
      'Zapier creates a record of whichever object the step picks; the salesforce connection creates a Lead (create-lead) or an Opportunity (create-opportunity), so the step is rebuilt with the one for its object, or as an http step for another object'
    ),
  },
  {
    source: 'GoogleDocsV2CLIAPI',
    operation: 'create_from_template',
    target: byHand(
      'Zapier fills a Google Docs template kept in Drive; document/generateDocx fills a .docx template, so the template is downloaded as .docx and the step rebuilt as document/generateDocx'
    ),
  },
  ...each(['loop_values_text', 'loop_values_line_items'], (operation) => ({
    source: 'ZapierLoopingCLIAPI',
    operation,
    target: action('loop', 'each'),
  })),
  {
    source: NO_APP,
    target: byHand(
      'The export names no app for this step, so what it did is not known; it is rebuilt by hand from the Zap in Zapier'
    ),
  },
  {
    source: 'SubZapCLIAPI',
    target: action('automation', 'call'),
    todo: 'The called Zap is imported as its own automation; the call names it by hand',
  },
]
