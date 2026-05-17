/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BreadcrumbItemSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const BreadcrumbTypeLiteral = Schema.Literal('breadcrumb')

export const breadcrumbFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  breadcrumbItems: Schema.optional(
    Schema.Array(BreadcrumbItemSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Ordered breadcrumb segments from root to current page',
      })
    )
  ),
  separator: Schema.optional(
    Schema.String.annotations({
      description: 'Separator character between breadcrumb items (default: "/")',
    })
  ),
} as const
