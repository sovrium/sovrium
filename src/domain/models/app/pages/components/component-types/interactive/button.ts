/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConfirmGateSchema } from '../../confirm-gate'
import { ButtonVariantSchema, ComponentSizeSchema } from '../../shared-schemas'
import { actionFields } from '../modules/action'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const ButtonTypeLiteral = Schema.Literal('button')

export const buttonFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  variant: Schema.optional(ButtonVariantSchema),
  size: Schema.optional(ComponentSizeSchema),
  loading: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show a loading spinner inside the button' })
  ),
  /**
   * Top-level convenience label that becomes the button's visible text. When
   * neither `content` nor explicit `props.label` is provided, the renderer
   * falls back to this value — matching action-bar / button-group schemas
   * elsewhere in the platform where authors expect `label` as a first-class
   * sibling of `action` / `confirm`. Lower precedence than `content` and
   * `props.label` so existing schemas remain bit-for-bit identical.
   */
  label: Schema.optional(Schema.String.annotations({ description: 'Button text label' })),
  /**
   * Confirmation prompt that gates the button's `action` before it fires. Set it
   * on ANY destructive gesture — a `crud` delete OR a destructive `type: 'fetch'`
   * operate action (e.g. a `method: 'DELETE'` call) — to require an explicit
   * confirm before the action dispatches. When present, the first click surfaces
   * an inline `alertdialog` (the standalone-button analog of the data-table
   * per-row action confirm in `action-cell.tsx`) whose accessible name is this
   * prompt and whose confirm affordance re-uses the button's label; confirming
   * dispatches the action, cancelling restores the button. The token
   * `$record.<field>` is interpolated at click time so authors can write
   * `Delete $record.name?`. Surfaced at the top level (sibling of `action`)
   * because the prompt's intent is button-level, not action-level — it survives
   * the action's runtime branching (crud-delete / fetch / navigate). Backward
   * compatible: existing crud-delete confirms are unchanged; this only broadens
   * the documented contract to cover a destructive fetch.
   *
   * A bare STRING is the prompt (shown in an inline alertdialog whose confirm
   * affordance re-uses the button label — the historical behavior). The OBJECT form
   * (`ConfirmGateSchema`) adds a separate dialog title, a `dialog`/`alertdialog`
   * role, a type-to-confirm `input` (whose `matchValue` may be `$session.email` to
   * require retyping the caller's own email), and confirm/cancel label overrides —
   * the vocabulary the admin RGPD erasure needs.
   */
  confirm: Schema.optional(ConfirmGateSchema),
} as const
