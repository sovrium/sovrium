/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `specimenOpen` — the one question every open-capable renderer asks, and the
 * markup it gets back.
 *
 * ─── WHY THE RENDERERS DO NOT CALL THE BRIDGE THEMSELVES ────────────────────
 *
 * The component renderers live in `src/presentation/ui/**` — element type
 * `presentation-component`, whose allow-list reaches `presentation-rendering`
 * but NOT the `island-ssr/` subpath declared inside it. That is deliberate:
 * the bridge's whole value is that the files importing an island module are a
 * short, named list. So this module is the hop, exactly as
 * `field-specimen-resolver.ts` is the hop for the field-specimen bridge.
 *
 * It is not a bare re-export. {@link isOpenSpecimen} is the GATE, and owning it
 * in one place is what stops three renderers from each inventing their own
 * reading of the flag — the defect that turned `data-form` and `form` into two
 * dispatch entries for one behaviour.
 *
 * ─── THE GATE IS `specimenOpen === true` ALONE ──────────────────────────────
 *
 * The two existing render-time readers — `command-palette`'s `specimenQuery`
 * and `ai-chat`'s `specimenStatus` — pair their flag with `specimen === true`,
 * because their catalogue entries already declare one for an unrelated reason
 * (the palette suppresses its runtime, `ai-chat` its island). `date-picker`,
 * `date-range-picker` and `dropdown-menu` carry no such flag, and adding one
 * would be a second, unrelated change to their DEFAULT cell — which
 * `[internal ref]`'s "every closed cell stays shut" clause would then
 * be asserting against a moved baseline. The `specimenOpen` branch is inert by
 * construction: nothing reaches it without the state vocabulary's own `open`
 * reach, so the second gate buys nothing and costs a behaviour change.
 *
 * ─── A STRING, AND WHAT THE CALLER OWES IT ──────────────────────────────────
 *
 * The markup is produced from DECODED config — a label, an ISO date, a menu
 * item's own text — and never from request input, so a caller emits it with
 * `dangerouslySetInnerHTML` (the precedent is `field-specimen-component.tsx`,
 * which makes the same argument at greater length). What a caller must NOT do
 * is emit the island marker beside it: an open specimen that hydrates is a live
 * control wearing a depiction's label.
 */

import {
  renderOpenDatePickerPopup,
  renderOpenDateRangePanel,
  renderOpenMenuPopup,
} from '../elements/open-specimen-renderer'

export type {
  OpenDatePickerOptions,
  OpenDateRangeOptions,
  OpenMenuOptions,
} from '../elements/open-specimen-renderer'

/**
 * Is this component being drawn as an OPEN specimen?
 *
 * Read off `props` rather than off a component-level field for the reason
 * `props.adminSearch` is: it is set by the surface DRAWING the specimen — the
 * state vocabulary's `open` reach — never by an app author describing a control
 * they want to work.
 */
export const isOpenSpecimen = (rawProps: Record<string, unknown> | undefined): boolean =>
  rawProps?.['specimenOpen'] === true

export { renderOpenDatePickerPopup, renderOpenDateRangePanel, renderOpenMenuPopup }
