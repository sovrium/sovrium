/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Schema } from 'effect'


export const AppDraftSchema = Schema.Struct({
  snapshot: Schema.Unknown,
  baseVersion: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  updatedAt: Schema.DateFromSelf,
  updatedByUserId: Schema.String.pipe(Schema.minLength(1)),
}).pipe(
  Schema.annotations({
    identifier: 'AppDraft',
    title: 'App Draft (mutable working copy)',
    description:
      'Singleton-per-app draft. baseVersion enables optimistic concurrency on publish and is the staleness anchor (DEC-023).',
  })
)

export type AppDraft = typeof AppDraftSchema.Type

export const isDraftStale = (draft: AppDraft, activeVersionNumber: number): boolean =>
  draft.baseVersion !== activeVersionNumber


export const DraftMutationResultSchema = Schema.Struct({
  draft: AppDraftSchema,
  changed: Schema.Boolean,
}).pipe(
  Schema.annotations({
    identifier: 'DraftMutationResult',
    title: 'Draft mutation result',
    description: 'Returned by per-resource draft mutations: the post-mutation draft + change flag.',
  })
)

export type DraftMutationResult = typeof DraftMutationResultSchema.Type


export class DraftBaseVersionMismatchError extends Data.TaggedError(
  'DraftBaseVersionMismatchError'
)<{
  readonly expected: number
  readonly actual: number
}> {}


export const RebaseResultSchema = Schema.Struct({
  draft: AppDraftSchema,
  previousBaseVersion: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  rebasedToVersion: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
}).pipe(
  Schema.annotations({
    identifier: 'RebaseResult',
    title: 'Draft rebase result',
    description:
      'Returned by POST /draft/rebase: the rebased draft plus the version numbers it moved between.',
  })
)

export type RebaseResult = typeof RebaseResultSchema.Type
