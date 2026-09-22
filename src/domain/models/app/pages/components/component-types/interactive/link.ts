/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { actionFields } from '../modules/action'
import { activeFields } from '../modules/active'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { visibilityFields } from '../modules/visibility'

export const LinkTypeLiteral = Schema.Literal('link')

/**
 * A link additionally carries `activeWhen` / `activeProps` — the CURRENT-item
 * marker (see `../modules/active`).
 *
 * On `link` and nowhere else, for now. A rail of anchors is the only place a
 * "which of these is selected" attribute has been needed: the period selector
 * on the analytics surfaces, whose active preset is marked `aria-current="page"`
 * and re-styled. A tab strip or a segmented control would want the same keys,
 * and `activeFields` is a module so that is a one-line spread when one does —
 * but spreading it everywhere first would ship a pair of keys most components
 * have no renderer for, which is the inert-config class the page schema refuses.
 */
export const linkFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  ...activeFields,
} as const
