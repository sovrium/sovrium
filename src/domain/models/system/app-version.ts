/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Schema } from 'effect'


export const AppVersionSourceSchema = Schema.Literal(
  'config-file',
  'env',
  'api',
  'mcp',
  'restore'
).pipe(
  Schema.annotations({
    identifier: 'AppVersionSource',
    title: 'App Version Source',
    description:
      'The transport that produced this version row: config-file | env | api | mcp | restore.',
  })
)

export type AppVersionSource = typeof AppVersionSourceSchema.Type


export const AppVersionSchema = Schema.Struct({
  versionNumber: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)),
  snapshot: Schema.Unknown,
  checksum: Schema.String.pipe(Schema.minLength(1)),
  createdAt: Schema.DateFromSelf,
  createdByUserId: Schema.String.pipe(Schema.minLength(1)),
  source: AppVersionSourceSchema,
  fileChecksum: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  message: Schema.String,
  restoredFromVersion: Schema.optional(Schema.Int.pipe(Schema.greaterThanOrEqualTo(1))),
}).pipe(
  Schema.annotations({
    identifier: 'AppVersion',
    title: 'App Version (immutable schema snapshot)',
    description:
      'Single immutable schema snapshot in system.sovrium_app_versions. Includes the full encoded App + provenance (source transport, optional fileChecksum).',
  })
)

export type AppVersion = typeof AppVersionSchema.Type


export const AppVersionListItemSchema = Schema.Struct({
  versionNumber: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)),
  checksum: Schema.String.pipe(Schema.minLength(1)),
  createdAt: Schema.DateFromSelf,
  createdByUserId: Schema.String.pipe(Schema.minLength(1)),
  source: AppVersionSourceSchema,
  fileChecksum: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  message: Schema.String,
  restoredFromVersion: Schema.optional(Schema.Int.pipe(Schema.greaterThanOrEqualTo(1))),
}).pipe(
  Schema.annotations({
    identifier: 'AppVersionListItem',
    title: 'App Version (list item, no snapshot)',
    description:
      'Slim view of system.sovrium_app_versions — omits the JSONB snapshot to keep list responses small. Includes the source transport so history tables can show provenance.',
  })
)

export type AppVersionListItem = typeof AppVersionListItemSchema.Type
