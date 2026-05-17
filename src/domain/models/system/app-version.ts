/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * App Version — Immutable Schema Snapshot
 *
 * Represents one entry in the `system.sovrium_app_versions` audit log.
 * Every successful publish creates a new immutable version. Restoring an
 * older version creates a NEW version that copies the snapshot, never
 * mutates history.
 *
 * `snapshot` is the encoded App schema (the same shape produced by
 * `Schema.encode(AppSchema)`) — kept as `Schema.Unknown` here so the
 * domain model layer does not depend on `AppSchema`'s deep type. The
 * application/infrastructure layers re-validate against `AppSchema`
 * before swapping it in via `AppRef`.
 *
 * `restoredFromVersion` is set only when this entry was created via the
 * `POST /versions/:n/restore` flow; for normal publish it is `undefined`.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// AppVersion (full record — includes snapshot)
// ---------------------------------------------------------------------------

export const AppVersionSchema = Schema.Struct({
  versionNumber: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)),
  snapshot: Schema.Unknown,
  checksum: Schema.String.pipe(Schema.minLength(1)),
  createdAt: Schema.DateFromSelf,
  createdByUserId: Schema.String.pipe(Schema.minLength(1)),
  message: Schema.String,
  restoredFromVersion: Schema.optional(Schema.Int.pipe(Schema.greaterThanOrEqualTo(1))),
}).pipe(
  Schema.annotations({
    identifier: 'AppVersion',
    title: 'App Version (immutable schema snapshot)',
    description:
      'Single immutable schema snapshot in system.sovrium_app_versions. Includes the full encoded App + provenance.',
  })
)

export type AppVersion = typeof AppVersionSchema.Type

// ---------------------------------------------------------------------------
// AppVersionListItem (slim — no snapshot, used by GET /versions list endpoint)
// ---------------------------------------------------------------------------

export const AppVersionListItemSchema = Schema.Struct({
  versionNumber: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)),
  checksum: Schema.String.pipe(Schema.minLength(1)),
  createdAt: Schema.DateFromSelf,
  createdByUserId: Schema.String.pipe(Schema.minLength(1)),
  message: Schema.String,
  restoredFromVersion: Schema.optional(Schema.Int.pipe(Schema.greaterThanOrEqualTo(1))),
}).pipe(
  Schema.annotations({
    identifier: 'AppVersionListItem',
    title: 'App Version (list item, no snapshot)',
    description:
      'Slim view of system.sovrium_app_versions — omits the JSONB snapshot to keep list responses small.',
  })
)

export type AppVersionListItem = typeof AppVersionListItemSchema.Type
