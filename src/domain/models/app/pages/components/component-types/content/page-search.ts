/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const PageSearchTypeLiteral = Schema.Literal('pageSearch')

export const pageSearchFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  placeholder: Schema.optional(Schema.String),
  maxResults: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
} as const
