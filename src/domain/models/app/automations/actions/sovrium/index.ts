/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SovriumValidateConfigActionSchema } from './validate-config'
import type { Schema } from 'effect'

/**
 * Sovrium Action — operators dedicated to the engine itself, as opposed to the
 * families that act on a run's data or on the outside world. Currently only the
 * 'validateConfig' operator.
 *
 * Aliased rather than wrapped in a single-member `Schema.Union` (matching
 * `flow/index.ts`): a one-member union would need its own `identifier`, and a
 * duplicate identifier erases a union's `$defs` in the published JSON Schema.
 */
export const SovriumActionSchema = SovriumValidateConfigActionSchema

/** @public */
export type SovriumAction = Schema.Schema.Type<typeof SovriumActionSchema>

export * from './validate-config'
