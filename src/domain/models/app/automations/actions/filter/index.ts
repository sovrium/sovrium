/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { FilterContinueActionSchema } from './continue'

export const FilterActionSchema = FilterContinueActionSchema
/** @public */
export type FilterAction = typeof FilterActionSchema.Type

export * from './continue'
