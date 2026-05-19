/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AccordionTypeSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const AccordionTypeLiteral = Schema.Literal('accordion')

export const accordionFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  accordionType: Schema.optional(AccordionTypeSchema),
  defaultOpen: Schema.optional(
    Schema.Array(Schema.String).annotations({
      description: 'IDs of accordion items that are open by default',
    })
  ),
} as const
