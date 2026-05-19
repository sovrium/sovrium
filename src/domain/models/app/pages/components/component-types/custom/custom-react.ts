/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { actionFields } from '../modules/action'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const CustomReactTypeLiteral = Schema.Literal('custom-react')

export const customReactFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  src: Schema.optional(
    Schema.String.annotations({
      description: 'Path to .tsx file for custom React component (relative to project root)',
    })
  ),
  exportName: Schema.optional(
    Schema.String.annotations({
      description: 'Named export from the .tsx file (defaults to default export)',
    })
  ),
} as const
