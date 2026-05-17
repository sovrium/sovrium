/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { HttpDeleteActionSchema } from './delete'
import { HttpGetActionSchema } from './get'
import { HttpPatchActionSchema } from './patch'
import { HttpPostActionSchema } from './post'
import { HttpPutActionSchema } from './put'
import { HttpRequestActionSchema } from './request'
import type { Action } from '..'

/**
 * Union of all HTTP action variants. The general-purpose `request` operator
 * stays for callers that need explicit `method` control or non-standard
 * verbs; the convenience operators (`get`, `post`, `put`, `patch`, `delete`)
 * carry tighter prop schemas (e.g. GET rejects `body` per HTTP semantics) so
 * config files surface misuse at decode time rather than at runtime.
 */
export const HttpActionSchema: Schema.Schema<Action & { readonly type: 'http' }, unknown> =
  Schema.Union(
    HttpGetActionSchema,
    HttpPostActionSchema,
    HttpPutActionSchema,
    HttpPatchActionSchema,
    HttpDeleteActionSchema,
    HttpRequestActionSchema
  ) as unknown as Schema.Schema<Action & { readonly type: 'http' }, unknown>
/** @public */
export type HttpAction = Schema.Schema.Type<typeof HttpActionSchema>

export * from './delete'
export * from './get'
export * from './patch'
export * from './post'
export * from './put'
export * from './request'
