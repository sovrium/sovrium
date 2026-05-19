/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Schema } from 'effect'


export const PreviewSessionStatusSchema = Schema.Literal(
  'starting',
  'running',
  'stopped',
  'expired'
)

export type PreviewSessionStatus = typeof PreviewSessionStatusSchema.Type


export const PreviewSessionSchema = Schema.Struct({
  previewId: Schema.String.pipe(Schema.minLength(1)),
  port: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1024), Schema.lessThanOrEqualTo(65_535)),
  draftSnapshot: Schema.Unknown,
  expiresAt: Schema.DateFromSelf,
  status: PreviewSessionStatusSchema,
  createdByUserId: Schema.String.pipe(Schema.minLength(1)),
  createdAt: Schema.DateFromSelf,
}).pipe(
  Schema.annotations({
    identifier: 'PreviewSession',
    title: 'Preview Session (ephemeral sandbox runtime)',
    description:
      'Single ephemeral preview server descriptor. Phase 3 will materialise the actual port-spawning.',
  })
)

export type PreviewSession = typeof PreviewSessionSchema.Type


export class PreviewExpiredError extends Data.TaggedError('PreviewExpiredError')<{
  readonly previewId: string
  readonly expiresAt: Date
}> {}

export class PreviewNotFoundError extends Data.TaggedError('PreviewNotFoundError')<{
  readonly previewId: string
}> {}

export type PreviewSessionError = PreviewExpiredError | PreviewNotFoundError
