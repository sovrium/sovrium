/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterPublisherSchema } from '../../data-source'
import { OptionsSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'
import { SelectOptionSourceBindingSchema } from './select-option-source'

export const SelectTypeLiteral = Schema.Literal('select')

export const selectFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Static option list. Mutually exclusive with `dataSource` — declaring both
   * is a boot error (`validateAllSelectOptionSources`), because the two answer
   * the same question and there is no defensible precedence between them.
   */
  options: Schema.optional(OptionsSchema),
  /**
   * Dynamic option source — resolve the option list from a table's rows, or
   * from the rows of a system read endpoint.
   *
   * The system-backed member exists because the values a control most often
   * offers are not rows of a table: the assignable roles, the declared
   * automation names, the declared agents. Those are facts about the operator's
   * CONFIG, served by a read endpoint and stored in no table.
   *
   * DELIBERATELY NARROW: neither member is the shared rows-oriented
   * `dataBoundFields` binding (see `select-option-source.ts` for why), and both
   * are REPLACED with a concrete `options` array server-side before render, so
   * no `select` reaches the renderer still carrying one — and no endpoint
   * reaches the client bundle.
   */
  dataSource: Schema.optional(SelectOptionSourceBindingSchema),
  /**
   * Publish this select's current value on a shared-filter channel.
   *
   * The PUBLISHER half of `bindTo` + `sharedFilter` (see
   * {@link SharedFilterPublisherSchema}). Without it a config author can declare
   * a grid that subscribes to a filter bar and has no way to declare the filter
   * bar: the only shared-filter publisher that ships is a bespoke island with no
   * component type, which is why Sovrium's own automation-runs directory is
   * still synthesised from TypeScript.
   *
   * INERT without a subscriber, exactly as `sharedFilter` is inert without
   * `bindTo` — a channel nobody listens to costs one event nobody handles.
   *
   * On a `multiple` select the published value is the selection joined by
   * commas, which is the shape a repeated query param already collapses to.
   */
  publishes: Schema.optional(SharedFilterPublisherSchema),
  /**
   * Offer the UNSET choice, as the control's FIRST option.
   *
   * Renders `<option value="">{label}</option>` ahead of every other choice, on
   * both controls: the option is folded into the resolved `options` list before
   * either renderer sees it, so the platform `<select>` and the themed listbox
   * receive one list and cannot disagree about what is in it. With no
   * `defaultValue` declared, document order makes it the selected one — which
   * is the whole point on a filter bar, whose resting state is "everything".
   *
   * ─── WHY IT IS NOT PART OF THE OPTION SOURCE ────────────────────────────────
   *
   * A dynamic `dataSource` REPLACES `options` outright, and `options` XOR
   * `dataSource` is refused at decode, so a sourced control had no way to carry
   * a row of its own: a filter bar over `/api/admin/automations` opened
   * pre-filtered on whichever automation happened to sort first, silently
   * contradicting the count printed beside it.
   *
   * The fix could have gone on the binding (`dataSource.leading`) and was not,
   * for two reasons. It is a property of the CONTROL rather than of where its
   * choices come from — a statically-authored list wants the same row, and
   * putting it on the binding would leave that author writing it by hand in one
   * place and declaring it in another. And a binding-side key would have to be
   * declared four times: on both members of the union, and again on the two
   * other positions a binding may sit in (`form.fields[].optionsSource`,
   * `columns[].actions[].editSelect.optionsSource`).
   *
   * ─── WHY THE VALUE IS FIXED ─────────────────────────────────────────────────
   *
   * The empty string IS the unset state, everywhere it lands: a shared-filter
   * publisher already publishes `''` for a cleared selection and the fetch layer
   * already drops an empty value from the URL, so "All" needs no special case
   * anywhere downstream. A configurable value would just be an ordinary option,
   * which an author can already declare in `options`.
   *
   * ─── NOT `placeholder` ──────────────────────────────────────────────────────
   *
   * `placeholder` is the inert line shown when there is NOTHING to show; it is
   * not selectable and submits nothing. This is a real, selectable choice that
   * is present whether or not the list resolved. A control declaring both, whose
   * list resolves to nothing, shows this one — a choice beats an apology.
   */
  emptyOption: Schema.optional(
    Schema.Struct({
      /** Label of the leading unset choice (its submitted value is always `''`). */
      label: Schema.String.pipe(
        Schema.check(Schema.isMinLength(1)),
        Schema.annotate({
          description:
            'Label of the leading unset option. Its submitted value is always the empty string.',
          examples: ['All automations', 'Any status'],
        })
      ),
    }).annotate({
      identifier: 'SelectEmptyOption',
      title: 'Select Empty Option',
      description:
        "The unset choice, rendered first and submitting the empty string — the 'All' row a filter bar opens on. Refused with `multiple`, and refused beside a static option that already submits the empty string.",
    })
  ),
  defaultValue: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description: 'Default value for form controls (select, radio-group, slider, etc.)',
    })
  ),
  multiple: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Allow multiple option selections (select)',
    })
  ),
  /**
   * Render the browser's OWN control instead of the themed listbox.
   *
   * The default `select` hydrates into a Base UI trigger plus a portalled
   * listbox. That is the right control for a marketing surface — it is themed,
   * it paints a per-option icon, and it can grow a type-ahead field. It is the
   * wrong one for a dense operator surface, for three reasons that are
   * properties of the control rather than of any one page:
   *
   *  1. It costs a hydration. The server ALREADY renders a real element with
   *     real choices inside it (`renderSsrSelectOptions`) and disables it only
   *     because an island is about to replace it. `native: true` is that same
   *     element left enabled, so a filter bar that offers a list and reads a
   *     value back ships no component code for it at all.
   *  2. The platform control is the accessible one wherever the platform has
   *     one. A phone draws its own picker; assistive technology and the
   *     browser's own type-ahead work with nothing of ours in the path; and it
   *     survives a page with no scripting, which a portalled listbox does not.
   *  3. It is the element the ecosystem addresses. A test driver's
   *     "choose this option" verb, a password manager, a translation extension
   *     and form autofill all key off the element rather than off a role.
   *
   * DELIBERATELY A SIBLING BOOLEAN rather than a `control` enum. `searchable`
   * already selects a different control through a boolean, and it is shipped
   * and documented; adding an enum beside it would leave two disagreeing ways
   * to say which control renders. Three booleans naming three controls, with a
   * rule saying at most one, is one contract — see
   * `select-native-validation.ts`, which refuses the combinations that would
   * otherwise decode into a control unable to honour every key it carries.
   */
  native: Schema.optional(
    Schema.Boolean.annotate({
      description:
        "Render the browser's own select element instead of the themed listbox. Refuses `searchable`, `allowCustomValue`, and a per-option icon — none of which the platform control can honour.",
    })
  ),
  searchable: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Enable type-ahead search filtering in the list',
    })
  ),
  searchPlaceholder: Schema.optional(
    Schema.String.annotate({
      description:
        'Placeholder text shown inside the combobox search input (only meaningful when `searchable: true`)',
    })
  ),
  allowCustomValue: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'When `searchable: true`, accept a typed value that does not match any option (free-form input).',
    })
  ),
  // REMOVED (deliberate): the top-level `valueField` / `displayField` pair.
  //
  // They were declared here, documented as "which keys of each option supply
  // the value and the label" (a remap over a STATIC `options` array), and read
  // by nothing — `buildSelectProps` never picked them up, so setting them had
  // no observable effect in any renderer. Their only appearances repo-wide were
  // the four specs that asserted on a disabled skeleton and one published docs
  // row. (`displayField` in `templates/**` is the unrelated
  // `tables[].fields[].displayField` on relationship fields.)
  //
  // The pair now lives INSIDE `dataSource`, where it has a real job: naming the
  // row fields that become each resolved option's value and label. Keeping an
  // inert top-level copy with a *different* documented meaning would have been
  // a third piece of fiction on this component, so the copy is gone rather than
  // silently repurposed.
} as const
