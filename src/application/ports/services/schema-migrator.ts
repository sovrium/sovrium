/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { App } from '@/domain/models/app'
import type { DeferredOperation } from '@/domain/services/schema-migration-plan'


export class SchemaMigrationError extends Data.TaggedError('SchemaMigrationError')<{
  readonly message: string
  readonly cause: unknown
}> {}

export interface SchemaMigrationResult {
  readonly applied: ReadonlyArray<
    | { readonly kind: 'create-table'; readonly table: string }
    | { readonly kind: 'add-column'; readonly table: string; readonly column: string }
  >
  readonly deferred: ReadonlyArray<DeferredOperation>
}

export class SchemaMigrator extends Context.Tag('SchemaMigrator')<
  SchemaMigrator,
  {
    readonly applyAdditive: (
      previous: App,
      next: App
    ) => Effect.Effect<SchemaMigrationResult, SchemaMigrationError>
  }
>() {}
