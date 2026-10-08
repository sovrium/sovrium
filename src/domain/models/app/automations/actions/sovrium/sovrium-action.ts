/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SovriumValidateBundleActionSchema } from './validate-bundle'
import { SovriumValidateConfigActionSchema } from './validate-config'

/**
 * Sovrium Action — operators dedicated to the engine itself, as opposed to the
 * families that act on a run's data or on the outside world: `validateConfig`
 * decodes a candidate config, `validateBundle` checks a stored bundle archive
 * and the config it carries.
 */
export const SovriumActionSchema = Schema.Union([
  SovriumValidateConfigActionSchema,
  SovriumValidateBundleActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'SovriumAction',
    title: 'Sovrium Action',
    description:
      'Operators dedicated to the engine itself: decode a candidate config, or check a stored bundle archive and the config it carries',
  })
)

/** @public */
export type SovriumAction = Schema.Schema.Type<typeof SovriumActionSchema>
