/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const COMING_SOON_SCHEMA_NAMES: ReadonlySet<string> = new Set([
  'AntiSpamSchema',
  'AuthTriggerSchema',
  'BaseFieldSchema',
  'CommentsComponentSchema',
  'CommentsConfigSchema',
  'ComponentSearchSchema',
  'CustomFieldSchema',
  'FormAccessSchema',
  'FormAnalyticsSchema',
  'FormAvailabilitySchema',
  'FormDisplaySchema',
  'FormFieldGroupSchema',
  'LanguageCodeSchema',
  'LanguagesSchema',
  'ListDisplaySchema',
  'ListItemMetadataSchema',
  'ListItemTemplateSchema',
  'NotificationBellSchema',
  'NotificationSchema',
  'RateLimitSchema',
  'RecordDeleteActionSchema',
  'RecordUpsertActionSchema',
  'SearchWeightSchema',
  'SendNotificationActionSchema',
  'ShareOptionsSchema',
  'StateActionSchema',
  'StateDeleteActionSchema',
  'StateGetActionSchema',
  'StateIncrementActionSchema',
  'StateListActionSchema',
  'StateSetActionSchema',
  'SubmitterOptionsSchema',
])

export const COMING_SOON_DISCRIMINATORS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [
    'ComponentSchema',
    new Set([
      'avatar-group',
      'number-input',
      'progress',
      'status-indicator',
      'tags',
      'time-picker',
      'wizard',
    ]),
  ],
])

export const COMING_SOON_TAGS: ReadonlySet<string> = new Set([
  'avatar-group',
  'number-input',
  'progress',
  'status-indicator',
  'tags',
  'time-picker',
  'wizard',
])

export const COMING_SOON_LEAF_SCHEMA_TAGS: ReadonlyMap<string, string> = new Map([
  ['notification', 'SendNotificationActionSchema'],
])
