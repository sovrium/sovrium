/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  DisabledReasonSchema,
  DisabledWhenSchema,
} from '@/domain/models/app/tables/condition-operators'
import { ButtonSizeSchema } from '../../button-variant'
import { ConfirmGateSchema } from '../../confirm-gate'
import { ReadStateGateSchema } from '../../read-state-gate'
import { ButtonVariantSchema } from '../../shared-schemas'
import { EditSelectSchema } from '../data/table/columns'
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
  size: Schema.optional(ButtonSizeSchema),
  /**
   * A Lucide icon drawn before the label — or alone, on an icon size, where the
   * `label` becomes the button's accessible name instead of its visible text.
   */
  icon: Schema.optional(
    Schema.String.annotate({
      title: 'Icon',
      description:
        'A Lucide icon name drawn before the label. On an icon size (`icon`, `icon-xs`, `icon-sm`, `icon-lg`) it is drawn alone and `label` names the button.',
      examples: ['printer', 'plus'],
    })
  ),
  loading: Schema.optional(
    Schema.Boolean.annotate({ description: 'Show a loading spinner inside the button' })
  ),
  /**
   * Top-level convenience label that becomes the button's visible text. When
   * neither `content` nor explicit `props.label` is provided, the renderer
   * falls back to this value — matching action-bar / button-group schemas
   * elsewhere in the platform where authors expect `label` as a first-class
   * sibling of `action` / `confirm`. Lower precedence than `content` and
   * `props.label` so existing schemas remain bit-for-bit identical.
   */
  label: Schema.optional(Schema.String.annotate({ description: 'Button text label' })),
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
  /**
   * Per-record DISABLED predicate, for a button drawn on a record: in a row
   * template, on a record page, in a card. Valid only under a record binding,
   * as `visibility.record` is, since it is matched against the bound record.
   * Where it holds, the button stays drawn and focusable, marked
   * `aria-disabled`, and pressing it does nothing — no navigation, no fetch, no
   * run; an automation it would start is also refused by the server with 409.
   * Unlike `props.disabled`, which is the same on every record.
   */
  disabledWhen: Schema.optional(DisabledWhenSchema),
  /** Why the button is disabled: its tooltip and its accessible description. */
  disabledReason: Schema.optional(DisabledReasonSchema),
  /**
   * Hides the button while a data component on the page is in one of the named
   * read states, and draws it again, without a reload, once the read leaves
   * them: a request button that must not be offered while the list beside it
   * shows a pending request. Decided in the browser, so it is not a
   * permission. See `read-state-gate.ts`.
   */
  hiddenWhenRead: Schema.optional(
    ReadStateGateSchema.annotate({
      title: 'Hidden When Read',
      description:
        'Hides the button while the named `table` or `kanban`, or those on the named shared-filter channel, are in one of the listed read states, and shows it again without a reload once a later read leaves them. A hidden button is out of the layout and of the accessibility tree. Decided in the browser after each read, so the button is still in the page: use `visibility` for who may see it. Omit to draw the button whatever its page has read.',
      examples: [{ component: 'pending-erasures', state: ['loading', 'nonEmpty'] }],
    })
  ),
  /**
   * Disables the button while a data component on the page is in one of the
   * named read states: a toolbar's New record over a grid whose read failed.
   * Drawn and focusable, marked `aria-disabled`, and pressing it does nothing,
   * as under `disabledWhen`; enabled again, without a reload, once a later read
   * leaves the states. Independent of `disabledWhen`, which is judged on the
   * record: the button is disabled while either holds.
   */
  disabledWhenRead: Schema.optional(
    ReadStateGateSchema.annotate({
      title: 'Disabled When Read',
      description:
        'Disables the button while the named `table` or `kanban`, or those on the named shared-filter channel, are in one of the listed read states. The button stays drawn and focusable, is marked disabled, and pressing it does nothing; a later read that leaves those states enables it again without a reload. Combines with `disabledWhen`: the button is disabled while either holds. Omit to keep the button usable whatever its page has read.',
      examples: [{ channel: 'quotes', state: 'failed' }],
    })
  ),
  /**
   * A pre-filled picker between the press and the `action`, for a button drawn
   * on a record: the same `editSelect` a table row action takes. Pressing the
   * button opens a menu of `options` (or `optionsSource`) with the record's
   * current `field` value checked; picking a value — or, with `multiple`,
   * checking values and pressing `saveLabel` — dispatches `action` with the
   * pick in place of `$record.<field>`. Valid only under a record binding, as
   * `disabledWhen` is: with no record there is nothing to pre-fill or to
   * replace, so it is refused at startup. Valid only in front of a `fetch`
   * action: the pick replaces `$record.<field>` in the request the fetch sends,
   * so on any other action it would change nothing, and it is refused at
   * startup too.
   */
  editSelect: Schema.optional(
    EditSelectSchema.annotate({
      description:
        'A pre-filled picker for a button drawn on a record: pressing the button opens a menu of options with the record’s current field value checked, and picking one (or, with multiple, checking several and pressing the save label) runs the button’s action with the pick in place of $record.<field>. Valid only under a record binding (a list or gallery row template, a single-record container, or a page bound to one record), and only when the button’s action is a fetch, since the pick replaces $record.<field> in the request it sends; refused at startup otherwise.',
    })
  ),
} as const
