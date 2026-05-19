/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const CustomHtmlTypeLiteral = Schema.Literal('customHTML')

export const customHtmlFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  htmlSrc: Schema.optional(
    Schema.String.annotations({
      description:
        'Path to external .html file (alternative to inline content property for customHTML)',
    })
  ),
} as const
