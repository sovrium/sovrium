/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TabsOrientationSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

/**
 * One tab: what the trigger says, and which panel it selects.
 *
 * ─── WHY THIS IS A STRUCT AND NOT A COMPONENT TYPE ─────────────────────────
 *
 * It was `tab-panel`, a component type with no renderer of its own — the tabs
 * island filtered its parent's `children` for that literal and folded each one
 * into an `items` array. So the type existed to be a marker, and a reader who
 * looked it up found a component that draws nothing.
 *
 * As a struct it is what it always was: the tab STRIP's data. The panel BODY
 * stays where a body belongs, in the parent's `children`.
 *
 * ─── THE INDEX CORRELATION, AND WHY IT IS NOT IMPLICIT ─────────────────────
 *
 * `panels[i]` names the tab; `children[i]` is what that tab shows. That is the
 * one thing about this shape a reader could get wrong, so it is not left to be
 * noticed: declaring a different number of each is REFUSED by name at decode
 * (see `component-xor-rules.ts`), because a silent off-by-one puts the wrong
 * body under every tab after the mistake and nothing on the page says so.
 *
 * The alternative — nesting each panel's children inside its own entry —
 * needs the render pipeline to walk a second children position, and the whole
 * pipeline (data-source expansion, `$t:` substitution, island detection,
 * visibility) currently walks exactly one. Index alignment buys the same
 * authoring shape for none of that, and pays for it with a refusal a reader
 * meets once.
 */
export const TabPanelSchema = Schema.Struct({
  /**
   * Stable id for the tab, and the value `defaultTab` names.
   *
   * Optional: when omitted it is slugified from the authored label. Supply it
   * when the label is a `$t:` reference, whose slug would be the translation
   * key rather than anything an author would write in `defaultTab`.
   */
  id: Schema.optional(
    Schema.String.annotate({
      description: 'Stable id for the tab; defaults to a slug of the label',
    })
  ),
  label: Schema.String.annotate({ description: 'Text on the tab trigger button' }),
  description: Schema.optional(
    Schema.String.annotate({
      description:
        'Secondary line rendered beneath the label on the tab trigger; associated with the trigger via aria-describedby, and never part of its accessible name',
    })
  ),
  disabled: Schema.optional(
    Schema.Boolean.annotate({ description: 'Render the trigger as disabled' })
  ),
  body: Schema.optional(
    Schema.String.annotate({
      description:
        'Text content of the panel. Omit when the panel body is the index-aligned entry of the parent’s `children`.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'TabPanel',
    title: 'Tab Panel',
    description:
      'One tab: the trigger label, plus an optional id, description, disabled flag and body',
  })
)

export const TabsTypeLiteral = Schema.Literal('tabs')

/**
 * How a `tabs` set occupies the space its parent gives it.
 *
 * ─── WHAT THIS EXISTS FOR ──────────────────────────────────────────────────
 *
 * A `table` declaring `layout: 'fill'` needs an unbroken chain of bounded flex
 * parents above it — every link a column that may shrink below its content. A
 * tab set is a link an author cannot dress: the mount host the tabs island
 * renders is deliberately LAYOUT-NEUTRAL, carrying no class of its own, and
 * that is the whole fix behind `[internal ref]` / `-018` — the
 * layout must live on exactly ONE element in each state, or the real tab set
 * becomes a non-growing item of a clone of its own layout and shrink-fits.
 *
 * So a grid inside a tab panel could not fill however carefully the page around
 * it was authored: a page that dresses every reachable link and skips only
 * that host was measured to leave the grid at its natural height, exactly as
 * if it had dressed none of them. This key is how an author says the tab set
 * is part of the chain.
 *
 * ─── WHY A KEY, AND NOT AUTOMATIC ──────────────────────────────────────────
 *
 * The obvious alternative is for the tabs renderer to pass a bounded chain
 * through whenever a panel's content declares `layout: 'fill'`, adding nothing
 * to the config surface. It was rejected on three grounds, and the first is
 * decisive:
 *
 *  - the renderer can only see a panel's DIRECT children, and a panel's grid is
 *    rarely one: the operator console's own run history wraps its table in a
 *    container for padding. Detection would work for the trivial shape and
 *    silently not work for the real one, which is worse than not detecting at
 *    all — it makes a missing bound look like a bug in the grid;
 *  - it would bind EVERY panel, including a short prose panel in the same set
 *    that never asked to become a bounded column;
 *  - nothing in the config would then say the tab set is a fill host, so an
 *    author debugging a grid that does not fill has no line to read.
 *
 * `fill` is also not harmful where it is pointless: a tab set in an ordinary
 * flowing document has no height to claim, so declaring it there degrades to
 * the natural height. Like the table's own key, it is a contract about
 * behaviour INSIDE a bounded parent and does not create the bound.
 *
 * ─── THE DEFAULT IS THE OLD BEHAVIOUR, BYTE FOR BYTE ───────────────────────
 *
 * Omitted means `flow`: the tab set takes its natural height, the panel grows
 * with its content, and the page scrolls — which is what every config written
 * before this key existed already renders, and what `[internal ref]` /
 * `-018` measure. Those two assert the DEFAULT path, so they hold by
 * construction rather than by care.
 */
export const TabsLayoutSchema = Schema.Literals(['flow', 'fill']).annotate({
  title: 'Tabs Layout',
  description:
    "How the tab set occupies its parent. 'flow' (default) takes its natural height and lets the page scroll. 'fill' makes the tab set fill the remaining height of a bounded parent and passes that bound through to the active panel, so a table declaring layout: fill inside a panel can own its own scroll. 'fill' needs an ancestor with a resolved height; in an ordinary flowing document it degrades to the natural height.",
  examples: ['fill'],
})

// No `TabsLayout` type alias yet, deliberately: nothing consumes one, and Knip
// reports an exported type with no consumer. `DataTableLayout` earned its export
// by being the prop type three island modules read; add this one beside its
// first reader, not ahead of it.

export const tabsFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  tabsOrientation: Schema.optional(TabsOrientationSchema),
  /**
   * Whether the tab set fills its bounded parent and passes that bound through
   * to the active panel.
   *
   * Omitted, the tab set renders exactly as it does today. See
   * {@link TabsLayoutSchema} for what `fill` requires of the page, and for why
   * it is a declaration rather than something the renderer infers.
   *
   * @example
   * ```yaml
   * # a console surface whose run history is a filling grid inside a tab
   * - type: tabs
   *   layout: fill
   *   panels:
   *     - { id: runs, label: Runs }
   *   children:
   *     - type: table
   *       layout: fill
   *       dataSource: { system: { endpoint: /api/admin/automations/runs } }
   * ```
   */
  layout: Schema.optional(TabsLayoutSchema),
  defaultTab: Schema.optional(
    Schema.String.annotate({ description: 'ID of the tab that is active by default' })
  ),
  /**
   * The tab strip. `panels[i]` names the tab that shows `children[i]`.
   *
   * Optional only so a `tabs` with no panels decodes; a strip with no tabs
   * renders nothing, which is the honest outcome of declaring none.
   */
  panels: Schema.optional(
    Schema.Array(TabPanelSchema).annotate({
      title: 'Tabs Panels',
      description:
        'One entry per tab, in order. Each names the trigger; the body is the index-aligned entry of `children` (or the entry’s own `body` string).',
    })
  ),
} as const
