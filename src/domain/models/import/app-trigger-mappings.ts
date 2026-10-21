/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The app triggers that start a flow on a third-party event, one block per
 * app, so an app maps the same way from Zapier and from n8n.
 *
 * - **The vendor pushes the event** (Trello, Calendly, Meta lead forms,
 *   LinkedIn lead forms): a `webhook` trigger whose row names the connection
 *   operation that registers it with the vendor. The connection is installed
 *   with that operation declared, and the TODO says what the vendor sends and
 *   checks.
 * - **The vendor cannot push it** (MeisterTask, new Google Sheets rows): a
 *   `cron` trigger whose row says how to poll: the list call, where the list
 *   sits in the answer and the field identifying an item. A push trigger is
 *   never approximated by a poll it did not have, nor the reverse.
 *
 * Make rows are absent on purpose: Make's module identifiers for these watch
 * modules are not public, and a row is only written in a spelling an export
 * was seen to use.
 */

import type { TriggerMapping } from './flow-step-targets'

/** How often a polled trigger runs until the operator sets its own schedule. */
export const POLL_SCHEDULE = '*/15 * * * *'

const POLL_EVERY = 'it runs every 15 minutes until you set its own schedule'

const TRELLO_TODO =
  "Trello sent Zapier each new card of the watched list; register a Trello webhook on that list (its id as idModel), pointing at this automation's webhook, with the trello connection's create-webhook operation. Trello first checks the address with a HEAD request that must answer 200, then posts every action on the list as { action, model }, not only new cards: keep the createCard actions with a filter step"

const CALENDLY_TODO =
  "Calendly sent Zapier each new invitee; create a Calendly webhook subscription for invitee.created, pointing at this automation's webhook, with the calendly connection's create-webhook-subscription operation, at the organization or user scope the Zap watched. Calendly posts { event, payload }, the invitee under payload; invitee.created needs the scheduled_events:read scope"

const FACEBOOK_TODO =
  "Meta sent Zapier each new lead of the Page's lead forms; subscribe the Meta app's Page webhook to the leadgen field in the App Dashboard, then install the app on the Page for leadgen with the facebook connection's subscribe-page-app operation. Meta checks the callback with a GET hub.challenge request before it sends anything, and a notification carries a leadgen_id, not the answers: read them with the facebook connection's get-lead. It needs leads_retrieval, pages_manage_metadata, pages_show_list, pages_read_engagement and ads_management, which only people with a role on the Meta app can grant until Meta has reviewed it"

const LINKEDIN_TODO =
  "LinkedIn sent Zapier each new response to a sponsored lead form; subscribe to lead notifications for the ad account (leadType SPONSORED), pointing at this automation's webhook, with the linkedin connection's create-lead-notification operation. The LinkedIn app needs the Lead Sync API product, granted on application, and the r_marketing_leadgen_automation permission; LinkedIn pushes only to a webhook that answers its HMAC-SHA256 challenge, and a notification names the lead: read its answers from leadFormResponses"

const MEISTERTASK_TODO = `MeisterTask's public API has no webhooks, so Zapier polled it for new tasks; the automation lists the tasks with the meistertask connection's list-tasks, keeps the ones it has not seen and runs the steps once per new task. Narrow the list to the project or section the Zap watched; ${POLL_EVERY}`

const SHEETS_TODO = `Zapier watched the sheet for new rows, and Google pushes no row event (a Drive notification only signals a change, and expires within a day), so the automation reads the sheet's values with the google-sheets connection's get-sheet-values and runs the steps once per row. Set the spreadsheet and the range, and since a row carries no id, keep only the rows past the last one seen (a state step remembering the row count) before switching it on, or every row runs on every tick; ${POLL_EVERY}`

const GOOGLE_SHEETS_POLL = {
  connection: 'google-sheets',
  operation: 'get-sheet-values',
  items: 'values',
} as const

const MEISTERTASK_POLL = { connection: 'meistertask', operation: 'list-tasks', key: 'id' } as const

/** The Zapier app triggers, by app and action. */
export const ZAPIER_APP_TRIGGERS: readonly TriggerMapping[] = [
  {
    source: 'TrelloAPI',
    operation: 'card_activity_list_to_hook',
    target: 'webhook',
    todo: TRELLO_TODO,
    connection: { connection: 'trello', operation: 'create-webhook' },
  },
  {
    source: 'CalendlyCLIAPI',
    operation: 'invitee_created',
    target: 'webhook',
    todo: CALENDLY_TODO,
    connection: { connection: 'calendly', operation: 'create-webhook-subscription' },
  },
  {
    source: 'FacebookLeadsCLIAPI',
    operation: 'lead',
    target: 'webhook',
    todo: FACEBOOK_TODO,
    connection: { connection: 'facebook', operation: 'subscribe-page-app' },
  },
  {
    source: 'LinkedInLeadGenFormsCLIAPI',
    operation: 'sponsored_form_response',
    target: 'webhook',
    todo: LINKEDIN_TODO,
    connection: { connection: 'linkedin', operation: 'create-lead-notification' },
  },
  {
    source: 'MeisterTaskCLIAPI',
    operation: 'taskList',
    target: 'cron',
    todo: MEISTERTASK_TODO,
    poll: MEISTERTASK_POLL,
  },
  {
    source: 'GoogleSheetsV2API',
    operation: 'new_row_notify_hook',
    target: 'cron',
    todo: SHEETS_TODO,
    poll: GOOGLE_SHEETS_POLL,
  },
]

/** The n8n trigger nodes of the same apps; n8n has no MeisterTask or LinkedIn lead trigger. */
export const N8N_APP_TRIGGERS: readonly TriggerMapping[] = [
  {
    source: 'n8n-nodes-base.trelloTrigger',
    target: 'webhook',
    todo: TRELLO_TODO.replace(
      'sent Zapier each new card of the watched list',
      'sent n8n each action on the watched model'
    ),
    connection: { connection: 'trello', operation: 'create-webhook' },
  },
  {
    source: 'n8n-nodes-base.calendlyTrigger',
    target: 'webhook',
    todo: CALENDLY_TODO.replace('Zapier each new invitee', 'n8n the events it watched').replace(
      'for invitee.created',
      'for the same events'
    ),
    connection: { connection: 'calendly', operation: 'create-webhook-subscription' },
  },
  {
    source: 'n8n-nodes-base.facebookLeadAdsTrigger',
    target: 'webhook',
    todo: FACEBOOK_TODO.replace('sent Zapier', 'sent n8n'),
    connection: { connection: 'facebook', operation: 'subscribe-page-app' },
  },
  {
    source: 'n8n-nodes-base.googleSheetsTrigger',
    operation: 'rowAdded',
    target: 'cron',
    todo: SHEETS_TODO.replace('Zapier watched', 'n8n polled'),
    poll: GOOGLE_SHEETS_POLL,
  },
]
