/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the `select` component.
 *
 * Schema authors who write the bare `{ type: 'select', options: [...] }` get a
 * complete, opinionated dropdown — rounded surface trigger, focus ring, popup
 * with elevation, highlighted/selected item styling — with zero theme-layer
 * dependency.
 *
 * The recipe mirrors the buttons + inputs slices (commits 02b2f35f3 + 571ae53ce):
 * layout / spacing classes stay as raw Tailwind utilities; only color / radius /
 * shadow / motion / focus classes go through {@link withVarFallback} so
 * `app.design.*` overrides still win at the CSS cascade layer (var lookups
 * resolve `--sv-*` first, fall back to the inline OKLCH literal).
 *
 * Base UI exposes interactive state via data attributes (`data-[open]`,
 * `data-[disabled]`, `data-[highlighted]`, `data-[selected]`). Rather than
 * branching on a `state` enum at call time, the recipe bakes the data-attr
 * Tailwind variants directly into the returned class string so a single
 * className covers every interactive state the primitive can enter.
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands that
 * consume it) because the select wiring runs inside the client island, not in
 * the server-side dispatcher — see the `plain-select.tsx` / `searchable-select.tsx`
 * call sites. Buttons + inputs put the helper in
 * `src/presentation/ui/sections/renderers/element-renderers/` because their
 * recipe is composed by the server dispatcher.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// TRIGGER
// ──────────────────────────────────────────────────────────────────────────────

const TRIGGER_LAYOUT = 'flex h-9 w-full items-center justify-between px-3 py-2 text-base'

const TRIGGER_RADIUS = `rounded-[${v('radius-base', T.radiusBase)}]`

const TRIGGER_BORDER_BASE = 'border'

// The trigger is a FIELD, so it takes the field's border weight rather than a
// hairline: it stands in for an `<input>` and has to read as one place to act,
// not as a panel edge.
const TRIGGER_SURFACE = [
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
].join(' ')

const TRIGGER_OPEN = [
  `data-[open]:border-[${v('sv-focus-ring', T.focusRing)}]`,
  `data-[open]:ring-1`,
  `data-[open]:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

const TRIGGER_DISABLED = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60'

const TRIGGER_FOCUS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
].join(' ')

const TRIGGER_MOTION = 'transition-[box-shadow,border-color] duration-150'

/**
 * Compute the default className for a Select/Combobox trigger (the closed-state
 * "input-like" button that opens the popup). Composes layout → radius → border
 * → surface → motion → focus → data-state variants.
 *
 * The trigger casts NO shadow: its border already separates it from the page,
 * and stacking an elevation on a bordered edge reads as two signals for one
 * boundary.
 */
export const computeSelectTriggerClasses = (): string =>
  [
    TRIGGER_LAYOUT,
    TRIGGER_RADIUS,
    TRIGGER_BORDER_BASE,
    TRIGGER_SURFACE,
    TRIGGER_MOTION,
    TRIGGER_FOCUS,
    TRIGGER_OPEN,
    TRIGGER_DISABLED,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// POPUP (dropdown panel)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The popup's box.
 *
 * `min-w-[var(--anchor-width)]` is what makes the list as wide as the field it
 * hangs off. Base UI publishes the anchor's width on the positioner as
 * `--anchor-width`, and a custom property inherits, so the popup reads its own
 * trigger's width without measuring anything. A MINIMUM rather than a width:
 * a label longer than the field still gets the room it needs.
 */
const POPUP_SCROLL_BOX = 'max-h-60 min-w-[var(--anchor-width)] overflow-auto'

/**
 * The gutter around the option rows.
 *
 * It belongs to whichever element holds the rows, and that is NOT always the
 * painted panel: the plain select paints its own listbox, while the searchable
 * one paints a panel around a listbox AND an empty-state message. Keeping the
 * gutter with the rows is what leaves the listbox flush inside the panel — a
 * popup that padded its own listbox opened its options visibly inboard of the
 * field, which is the defect row 26 reports on the searchable half.
 */
const POPUP_ROW_GUTTER = 'p-1'

const POPUP_RADIUS = `rounded-[${v('radius-md', T.radiusMd)}]`

const POPUP_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
].join(' ')

// A dropdown is a MENU, not a dialog: it is anchored to the control that
// opened it and sits a short distance off the page. The drawings give menus
// and popovers the `md` step and reserve `lg` for a dialog or a drawer, which
// is detached from everything.
const POPUP_SHADOW = `shadow-[${v('shadow-md', T.shadowMd)}]`

/**
 * Compute the default className for the floating popup panel (Select.Popup /
 * Combobox.Popup). Bakes elevation-lg + overlay surface + border so the popup
 * reads as a clearly-detached floating layer above whatever content sits below.
 */
export const computeSelectPopupClasses = (): string =>
  [POPUP_SCROLL_BOX, POPUP_RADIUS, POPUP_SURFACE, POPUP_SHADOW].join(' ')

/**
 * Compute the default className for the option list NESTED inside a painted
 * popup — the searchable half, where `Combobox.Popup` is the panel and
 * `Combobox.List` is the `role="listbox"` element inside it.
 *
 * It carries the gutter and nothing else: the panel around it already draws
 * the edge, the fill and the elevation, and drawing them twice would put a
 * frame inside a frame — the same defect the combobox input had.
 */
export const computeComboboxListClasses = (): string => POPUP_ROW_GUTTER

/**
 * Compute the default className for the option-list element (Select.List).
 *
 * Base UI assigns `role="listbox"` to `Select.List` when it is present and
 * demotes the wrapping `Select.Popup` to `role="presentation"`. The styled
 * overlay surface therefore has to live on `Select.List` so the element that
 * actually carries the listbox role is the real, non-transparent themed paint
 * (a bare `Select.Popup` would leave the listbox transparent). Same recipe as
 * {@link computeSelectPopupClasses}: elevation-lg + overlay surface + border +
 * radius + scroll layout, so the open dropdown reads as a detached floating
 * layer regardless of which element the primitive tags as the listbox.
 */
export const computeSelectListClasses = (): string =>
  [POPUP_SCROLL_BOX, POPUP_ROW_GUTTER, POPUP_RADIUS, POPUP_SURFACE, POPUP_SHADOW].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ITEM (option row inside the popup)
// ──────────────────────────────────────────────────────────────────────────────

const ITEM_RADIUS = `rounded-[${v('radius-base', T.radiusBase)}]`

// An option row stands on the kit's own control-height ladder — 28, 32 and 40 px
// — at the 32 px rung. Its padding alone drew 28, the smallest rung, under a
// 36 px field: the row a reader aims at was the least comfortable target in the
// kit. `min-h-8` is a floor rather than a height, so a label that wraps still
// gets the room it needs.
const ITEM_LAYOUT = `flex min-h-8 cursor-pointer items-center px-2 py-[5px] text-sm outline-none ${ITEM_RADIUS}`

const ITEM_BASE = `text-[${v('sv-fg', T.fg)}]`

const ITEM_HIGHLIGHTED = [
  `data-[highlighted]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[highlighted]:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

const ITEM_SELECTED = 'data-[selected]:font-medium'

const ITEM_DISABLED = [
  'data-[disabled]:cursor-not-allowed',
  `data-[disabled]:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
].join(' ')

/**
 * Compute the default className for an option row (Select.Item / Combobox.Item).
 * Uses Base UI's `data-[highlighted]` (focus/hover) and `data-[selected]`
 * (currently-selected) attributes to drive visual emphasis without JS.
 */
export const computeSelectItemClasses = (): string =>
  [ITEM_LAYOUT, ITEM_BASE, ITEM_HIGHLIGHTED, ITEM_SELECTED, ITEM_DISABLED].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ICON (chevron + indicator)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the trigger's chevron icon. Muted
 * foreground tone so the icon recedes versus the value text.
 */
export const computeSelectIconClasses = (): string =>
  ['ml-2', `text-[${v('sv-fg-subtle', T.fgSubtle)}]`].join(' ')

/**
 * Compute the default className for the selected-item indicator (checkmark).
 * Uses the canonical `text-primary` role utility so the selection cue is
 * unmistakable. The default theme layer always mints `.text-primary` (resolving
 * `--color-primary`, which the author `theme.colors.primary` bridge recolors),
 * so the indicator picks up tenant overrides without a separate var-fallback
 * arbitrary value — and the role class stays addressable as `.text-primary`.
 */
export const computeSelectItemIndicatorClasses = (): string => ['ml-auto', 'text-primary'].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// LABEL
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for an associated field Label rendered above
 * the trigger (Select.Label / Combobox.Label). Plain Tailwind layout + body
 * foreground via var-fallback — no state variants needed.
 */
export const computeSelectLabelClasses = (): string =>
  ['mb-1 block text-sm font-medium', `text-[${v('sv-fg', T.fg)}]`].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// COMBOBOX (searchable) — input group + input + popup empty-state
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the combobox InputGroup (the rounded
 * container that wraps the search input + chevron trigger). Mirrors the
 * trigger surface for visual continuity but uses `focus-within:` instead of
 * `data-[open]:` because Combobox.InputGroup is a textbox container, not a
 * pressable trigger.
 */
export const computeComboboxInputGroupClasses = (): string =>
  [
    'flex w-full items-center',
    TRIGGER_RADIUS,
    TRIGGER_BORDER_BASE,
    TRIGGER_SURFACE,
    TRIGGER_MOTION,
    `focus-within:border-[${v('sv-focus-ring', T.focusRing)}]`,
    `focus-within:ring-1`,
    `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
    TRIGGER_DISABLED,
  ].join(' ')

/**
 * Compute the default className for the combobox text input. Transparent
 * background lets the surrounding InputGroup's surface show through; the
 * inherited font color comes from the group.
 *
 * `border-0` is load-bearing, not defensive. The InputGroup around this input
 * owns the control's edge — it is the element carrying the border and the
 * `focus-within` ring — while a base rule paints an edge on the `<input>` that
 * the recipe never asked for. Left alone the two draw a frame inside a frame.
 */
export const computeComboboxInputClasses = (): string =>
  [
    'flex-1 border-0 bg-transparent px-3 py-2 text-base outline-none',
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')

/**
 * Compute the default className for the combobox empty-state message ("No
 * results"). Muted body tone so the empty state reads as informational, not
 * as an option.
 */
export const computeComboboxEmptyClasses = (): string =>
  ['px-3 py-2 text-sm', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')
