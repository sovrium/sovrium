/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { StateDeleteActionSchema } from './delete'
import { StateGetActionSchema } from './get'
import { StateIncrementActionSchema } from './increment'
import { StateListActionSchema } from './list'
import { StateSetActionSchema } from './set'

export const StateActionSchema = Schema.Union(
  StateGetActionSchema,
  StateSetActionSchema,
  StateIncrementActionSchema,
  StateDeleteActionSchema,
  StateListActionSchema
).pipe(
  Schema.annotations({
    identifier: 'StateAction',
    title: 'State Action',
    description: 'Key-value state operations: get, set, increment, delete, and list',
  })
)

export type StateAction = Schema.Schema.Type<typeof StateActionSchema>

export * from './delete'
export * from './get'
export * from './increment'
export * from './list'
export * from './set'
