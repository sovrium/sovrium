/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { dataBoundFields } from '../modules/data-bound'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const ContainerTypeLiteral = Schema.Literal('container')

export const ContainerElementSchema = Schema.Literal(
  'div',
  'section',
  'main',
  'aside',
  'nav',
  'header',
  'footer',
  'article'
).annotations({
  title: 'Container Element',
  description: 'HTML element to render. Defaults to "div".',
})

export const containerFields = {
  ...coreFields,
  ...contentFields,
  ...dataBoundFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  element: Schema.optional(ContainerElementSchema),
} as const
