/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const ACTION_CATALOG: Readonly<Record<string, string>> = {
  'account.deletion.scheduled': 'user',
  'account.deletion.purged': 'user',
  'config.version.queried': 'config',
  'schema.draft.update': 'config',
  'schema.draft.rebase': 'config',
  'schema.draft.publish': 'config',
  'schema.version.restore': 'config',
  'table.overview.queried': 'table',
  'bucket.list.queried': 'bucket',
  'bucket.overview.queried': 'bucket',
  'bucket.files.queried': 'bucket',
  'bucket.file.uploaded': 'bucket',
  'form.list.queried': 'form',
  'form.detail.queried': 'form',
  'form.submission.list.queried': 'form.submission',
  'form.submission.detail.queried': 'form.submission',
  'form.submission.bulk.queried': 'form.submission',
  'form.submission.body.revealed': 'form.submission',
  'form.analytics.queried': 'form',
  'form.export.queried': 'form.submission',
  'user.overview.queried': 'user',
  'automation.overview.queried': 'automation',
  'automation.runs.list.queried': 'automation.run',
  'automation.runs.detail.queried': 'automation.run',
  'agent.conversation.list.queried': 'agent',
  'agent.conversation.detail.queried': 'agent',
  'connection.list.queried': 'connection',
  'connection.detail.queried': 'connection',
}

export function resolveResourceType(action: string): string | undefined {
  return ACTION_CATALOG[action]
}

export const AUDIT_ACTIONS = {
  ACCOUNT_DELETION_SCHEDULED: 'account.deletion.scheduled',
  ACCOUNT_DELETION_PURGED: 'account.deletion.purged',
  CONFIG_VERSION_QUERIED: 'config.version.queried',
  SCHEMA_DRAFT_UPDATE: 'schema.draft.update',
  SCHEMA_DRAFT_REBASE: 'schema.draft.rebase',
  SCHEMA_DRAFT_PUBLISH: 'schema.draft.publish',
  SCHEMA_VERSION_RESTORE: 'schema.version.restore',
  TABLE_OVERVIEW_QUERIED: 'table.overview.queried',
  BUCKET_LIST_QUERIED: 'bucket.list.queried',
  BUCKET_OVERVIEW_QUERIED: 'bucket.overview.queried',
  BUCKET_FILES_QUERIED: 'bucket.files.queried',
  BUCKET_FILE_UPLOADED: 'bucket.file.uploaded',
  FORM_LIST_QUERIED: 'form.list.queried',
  FORM_DETAIL_QUERIED: 'form.detail.queried',
  FORM_SUBMISSION_LIST_QUERIED: 'form.submission.list.queried',
  FORM_SUBMISSION_DETAIL_QUERIED: 'form.submission.detail.queried',
  FORM_SUBMISSION_BULK_QUERIED: 'form.submission.bulk.queried',
  FORM_SUBMISSION_BODY_REVEALED: 'form.submission.body.revealed',
  FORM_ANALYTICS_QUERIED: 'form.analytics.queried',
  FORM_EXPORT_QUERIED: 'form.export.queried',
  USER_OVERVIEW_QUERIED: 'user.overview.queried',
  AUTOMATION_OVERVIEW_QUERIED: 'automation.overview.queried',
  AUTOMATION_RUNS_LIST_QUERIED: 'automation.runs.list.queried',
  AUTOMATION_RUNS_DETAIL_QUERIED: 'automation.runs.detail.queried',
  AGENT_CONVERSATION_LIST_QUERIED: 'agent.conversation.list.queried',
  AGENT_CONVERSATION_DETAIL_QUERIED: 'agent.conversation.detail.queried',
  CONNECTION_LIST_QUERIED: 'connection.list.queried',
  CONNECTION_DETAIL_QUERIED: 'connection.detail.queried',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
