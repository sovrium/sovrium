/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'

/**
 * The social sections of the account export: what the app keeps about how
 * the caller reads and is reached. Each entry is hers alone.
 */

/**
 * Account export — how far the caller has read one parent record
 *
 * One read-state row of the caller: the parent of a `readState` relationship
 * (a channel), and when she last read it.
 */
export const accountExportReadStateSchema = Schema.Struct({
  table: Schema.String.annotate({ description: 'The parent table, such as a channel table' }),
  recordId: Schema.String.annotate({ description: 'The parent record she read' }),
  lastReadAt: looseIsoDateTime({
    description: 'ISO 8601 timestamp of the newest child she had read',
  }),
}).annotate({ identifier: 'AccountExportReadState' })

/**
 * Account export — one notification the caller received
 *
 * The notification as she lists it: its kind, title and text, the record it is
 * about by table and id, and whether and when she read it.
 */
export const accountExportNotificationSchema = Schema.Struct({
  kind: Schema.String.annotate({ description: 'The declared kind of the notification' }),
  title: Schema.String.annotate({ description: 'Its title' }),
  body: Schema.NullOr(Schema.String).annotate({ description: 'Its text, or null' }),
  source: Schema.NullOr(
    Schema.Struct({
      table: Schema.String.annotate({ description: 'Table of the record it is about' }),
      recordId: Schema.String.annotate({ description: 'Id of that record' }),
    })
  ).annotate({ description: 'The record it is about, or null' }),
  read: Schema.Boolean.annotate({ description: 'Whether she marked it read' }),
  createdAt: looseIsoDateTime({ description: 'ISO 8601 timestamp it was created' }),
  readAt: Schema.NullOr(looseIsoDateTime({ description: 'When she read it' })).annotate({
    description: 'ISO 8601 timestamp she read it, or null',
  }),
}).annotate({ identifier: 'AccountExportNotification' })

/**
 * Account export — one notification preference of the caller
 *
 * Only the kinds she changed: a kind on its defaults is configuration, not
 * data about her.
 */
export const accountExportNotificationPreferenceSchema = Schema.Struct({
  kind: Schema.String.annotate({ description: 'The declared kind' }),
  channels: Schema.Struct({
    inApp: Schema.Boolean.annotate({ description: 'Listed in her notifications' }),
    email: Schema.Boolean.annotate({ description: 'Sent to her account address' }),
    digest: Schema.Boolean.annotate({ description: 'Left for a digest to collect' }),
  }).annotate({ description: 'The channels she chose for the kind' }),
}).annotate({ identifier: 'AccountExportNotificationPreference' })
