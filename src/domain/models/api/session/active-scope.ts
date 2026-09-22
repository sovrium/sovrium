/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Active-scope session API contract schemas.
 *
 * Mirrors the runtime shapes in `src/presentation/api/routes/active-scope.ts`.
 * Backs the OpenAPI documentation for the active-scope route group.
 */

/** Request body to set the active record for a scope table. */
export const setActiveScopeRequestSchema = Schema.Struct({
  recordId: Schema.String,
})

/** Response after setting the active scope. */
export const activeScopeSetResponseSchema = Schema.Struct({
  tableSlug: Schema.String,
  recordId: Schema.String,
})

/** Response when reading the active scope — `recordId` is null when unset. */
export const activeScopeGetResponseSchema = Schema.Struct({
  tableSlug: Schema.String,
  recordId: Schema.NullOr(Schema.String),
})

/** @public */
export type SetActiveScopeRequest = typeof setActiveScopeRequestSchema.Type
/** @public */
export type ActiveScopeSetResponse = typeof activeScopeSetResponseSchema.Type
/** @public */
export type ActiveScopeGetResponse = typeof activeScopeGetResponseSchema.Type
