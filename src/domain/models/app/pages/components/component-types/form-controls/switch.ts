/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterPublisherSchema } from '../../data-source-publishers'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const SwitchTypeLiteral = Schema.Literal('switch')

export const switchFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  checked: Schema.optional(
    Schema.Boolean.annotate({ description: 'Default checked state for checkbox or switch' })
  ),
  /**
   * Narrow the data components on a channel while the switch is on.
   *
   * In the condition form (`field` + `operator`) the switch contributes
   * `field operator value` while on — `value` defaulting to `true` — and
   * withdraws it when turned off, so "Only open tickets" is one switch. In the
   * param form it publishes `true` while on and an empty value when off.
   */
  publishes: Schema.optional(SharedFilterPublisherSchema),
} as const
