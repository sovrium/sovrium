/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const ACTION_CATALOG: Readonly<Record<string, string>> = {
  'config.version.queried': 'config',
  'table.overview.queried': 'table',
  'bucket.list.queried': 'bucket',
  'bucket.overview.queried': 'bucket',
  'form.list.queried': 'form',
  'form.detail.queried': 'form',
  'form.submission.list.queried': 'form.submission',
  'form.submission.detail.queried': 'form.submission',
  'form.submission.bulk.queried': 'form.submission',
  'form.submission.body.revealed': 'form.submission',
  'automation.overview.queried': 'automation',
  'automation.runs.list.queried': 'automation.run',
  'automation.runs.detail.queried': 'automation.run',
}

export function resolveResourceType(action: string): string | undefined {
  return ACTION_CATALOG[action]
}

export const AUDIT_ACTIONS = {
  CONFIG_VERSION_QUERIED: 'config.version.queried',
  TABLE_OVERVIEW_QUERIED: 'table.overview.queried',
  BUCKET_LIST_QUERIED: 'bucket.list.queried',
  BUCKET_OVERVIEW_QUERIED: 'bucket.overview.queried',
  FORM_LIST_QUERIED: 'form.list.queried',
  FORM_DETAIL_QUERIED: 'form.detail.queried',
  FORM_SUBMISSION_LIST_QUERIED: 'form.submission.list.queried',
  FORM_SUBMISSION_DETAIL_QUERIED: 'form.submission.detail.queried',
  FORM_SUBMISSION_BULK_QUERIED: 'form.submission.bulk.queried',
  FORM_SUBMISSION_BODY_REVEALED: 'form.submission.body.revealed',
  AUTOMATION_OVERVIEW_QUERIED: 'automation.overview.queried',
  AUTOMATION_RUNS_LIST_QUERIED: 'automation.runs.list.queried',
  AUTOMATION_RUNS_DETAIL_QUERIED: 'automation.runs.detail.queried',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
