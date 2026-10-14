/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui native-select and badge (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The grid's EDITING chrome — the filter and sort builders' shared panel, the
 * inline auto-save status, the chip an applied filter or sort row is drawn as,
 * and the per-row action buttons with the confirm bar one of them opens.
 *
 * What holds them together is that each one is a control the reader ACTS on
 * rather than a surface the records are drawn on, and each is drawn inside the
 * grid's own frame rather than over it. That last clause is the whole boundary
 * with `table-overlay-default-classes.ts`: the panel a filter builder opens is
 * a band inside the frame and lives here; the menu its button opens floats over
 * the rows and lives there.
 *
 * The tone ladder is shared and load-bearing. A panel keeps a real fill one step
 * down from the frame — never none — and a chip is RAISED on that ground rather
 * than pressed into it, so a reader can see an applied filter as an object
 * sitting on the builder instead of a region of it. The row action buttons
 * compose `button-default-classes.ts` and shrink three of its classes through
 * {@link swapUtility}; see `table-class-swap.ts`.
 */

import { computeButtonDefaultClasses } from './button-default-classes'
import { swapUtility } from './table-class-swap'
import {
  TABLE_BUTTON_BASE,
  TABLE_BUTTON_GHOST,
  TABLE_BUTTON_SIZE_ICON_XS,
} from './table-toolbar-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// PANEL — the filter and sort builders' shared chrome
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `padding:10px; flex-col; gap:8px; font-size:12px; background:#fafafa;
// border-bottom:1px solid #e3e3e3`.
//
// GROUND, not the raised surface the panels shipped on. A builder opens INSIDE
// the grid's frame, so painting it at the frame's own tone made it read as more
// grid; one step down reads as a drawer pulled out of it. The fill has to stay
// a real colour either way — several shipped assertions read
// `getComputedStyle(panel).backgroundColor` and reject `rgba(0,0,0,0)` — which
// is why this is a tone change and never a removal.
//
// 10px padding, down from 16px. A panel that holds three selects and a button
// does not need a 16px frame, and at that spend it pushed the rows it filters
// most of a row-height further down the screen.
const TABLE_PANEL = [
  'flex flex-col gap-2 border-b p-2.5 text-sm',
  `bg-background`,
  `border-border`,
].join(' ')

/**
 * Compute the default className for the filter and sort builder panels.
 *
 * ONE chrome for both, deliberately. They differ in what they build and in
 * nothing else — same disclosure, same grid of controls, same commit button —
 * and two recipes for one shape is how the two panels drifted a padding apart
 * in the first place.
 */
export const computeTablePanelClasses = (): string => TABLE_PANEL

/**
 * Compute the default className for a panel caption — `Combine filters with`,
 * `Sort priority (top = primary)`, a sort row's rank number.
 *
 * Tone only; the panel's own `text-sm` carries the size. A caption that also
 * declared a step would fight the panel whenever either moved.
 */
export const computeTablePanelCaptionClasses = (): string => `text-muted-foreground`

/**
 * Compute the default className for a panel's text actions — `Clear all`,
 * `Close`.
 *
 * Underlined and muted, resolving to full ink on hover. These are the two
 * controls in the panel that are NOT buttons in the design's sense: they undo
 * or dismiss, and drawing them as buttons would put three equal-weight
 * affordances beside a commit that is the only one the reader came for.
 */
export const computeTablePanelLinkClasses = (): string =>
  [`text-muted-foreground`, 'underline', `hover:text-foreground`].join(' ')

// shadcn/ui's `native-select` at `size: sm` raised to 32px, the height the
// toolbar's buttons stand at: a filter row is three of these side by side
// inside a panel that is itself inside the grid. The chevron is the page's own
// select rule (`component-layer-generators.ts`), so the inset is not restated.
const TABLE_PANEL_CONTROL =
  'h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30'

// The LIST-box variant: a `<select multiple>` shows its options as rows, so the
// single-line `h-8` would clip every row after the first. The floor width keeps
// a short list readable when the bar is narrow.
const TABLE_PANEL_LISTBOX =
  'h-auto min-w-40 rounded-lg border border-input bg-transparent p-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/**
 * Compute the default className for a `<select>` or `<input>` inside a panel —
 * or, with `multiple`, for a `<select multiple>` list box.
 */
export const computeTablePanelControlClasses = (options?: {
  readonly multiple?: boolean
}): string => (options?.multiple === true ? TABLE_PANEL_LISTBOX : TABLE_PANEL_CONTROL)

/**
 * Compute the default className for a panel row's icon buttons (remove `×`,
 * move up, move down): base-nova's `ghost` / `icon-xs`, so the removes line up
 * down the right edge of a stack of rows of different widths.
 */
export const computeTablePanelRemoveClasses = (): string =>
  [TABLE_BUTTON_BASE, TABLE_BUTTON_GHOST, TABLE_BUTTON_SIZE_ICON_XS, 'text-muted-foreground'].join(
    ' '
  )

// ──────────────────────────────────────────────────────────────────────────────
// SAVE INDICATOR — the inline auto-save status
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The four states an auto-save can report.
 *
 * Declared here rather than imported from `islands/…/use-save-status` because
 * `[internal ref]` forbids a `presentation-util` reaching into a
 * `presentation-island`. The vocabularies are structurally identical, so the
 * island's own `SaveStatus` assigns to this without a cast; if either grows a
 * fifth member the mismatch surfaces at the call site rather than silently.
 */
export type TableSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const TABLE_SAVE_INDICATOR = 'inline-flex items-center gap-1 text-xs'

/**
 * Compute the default className for the save-status indicator.
 *
 * ## Only a FAILURE earns colour
 * `saved` shipped in the success tone, which put a green word on the toolbar
 * every time anyone edited a cell — the most routine outcome in the grid,
 * announced as an event. The design draws it as quiet grey with a check glyph
 * instead: the reader learns the save landed without the interface celebrating
 * it, and the one status that genuinely needs their attention is the only one
 * with a hue. `idle` and `saving` share that grey, so the indicator never
 * changes colour on the happy path at all.
 */
export const computeTableSaveIndicatorClasses = ({
  status,
}: {
  readonly status: TableSaveStatus
}): string =>
  [TABLE_SAVE_INDICATOR, status === 'error' ? `text-destructive` : `text-muted-foreground`].join(
    ' '
  )

// ──────────────────────────────────────────────────────────────────────────────
// CHIP — an applied filter, a sort row, a `filter-bar` term
// ──────────────────────────────────────────────────────────────────────────────

// An outline badge grown to hold its own remove buttons: the page's fill on a
// rule, so an applied condition sits ON the panel as an object the reader put
// there and can lift again.
const TABLE_CHIP =
  'inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background pr-0.5 pl-2 text-sm text-muted-foreground'

/**
 * Compute the default className for an applied-condition chip.
 *
 * ONE recipe across three surfaces: the filter panel's committed rows, the sort
 * panel's priority rows, and the `filter-bar` component's terms. All three say
 * the same thing in the same words — a field, a comparison, a value, and a way
 * to lift it — and they had three separate literals saying it three slightly
 * different ways.
 */
export const computeTableChipClasses = (): string => TABLE_CHIP

/**
 * Compute the className for the VALUE inside a chip.
 *
 * The chip's own text is muted because most of it is grammar — the field name
 * and the operator, which the reader already knows they chose. The value is the
 * part they picked and the part that distinguishes one chip from the next, so
 * it takes full ink and medium weight and the rest recedes behind it.
 */
export const computeTableChipValueClasses = (): string => `font-medium text-foreground`

// ──────────────────────────────────────────────────────────────────────────────
// ACTION COLUMN — the per-row buttons and the confirm bar one of them opens
// ──────────────────────────────────────────────────────────────────────────────

const ACTION_BUTTON_FROM_HEIGHT = 'h-7'
const ACTION_BUTTON_TO_HEIGHT = 'h-6'
const ACTION_BUTTON_FROM_PADDING = 'px-2.5'
const ACTION_BUTTON_TO_PADDING = 'px-2'
const ACTION_BUTTON_FROM_TYPE = 'text-sm'
const ACTION_BUTTON_TO_TYPE = 'text-xs'

/**
 * Compute the className for one button in an action column.
 *
 * The shared button at `sm`, shrunk to 24px on 11px type. A row is 36 to 56
 * pixels tall and can hold several of these side by side, so a 28px control in
 * it leaves four pixels of air and sets the row's height the moment the density
 * drops to short. Three utilities are REPLACED rather than appended, for the
 * reason the pager button gives: a same-property conflict resolved by
 * concatenation is resolved by Tailwind's emission order, not by this file.
 *
 * `tone: 'destructive'` is the solid red the drawings give the confirm inside an
 * armed delete, because it is the last thing standing between a click and a row
 * that is gone. The trigger that arms it is NOT destructive by DEFAULT: it opens
 * a question, and a row of red buttons down the side of a table makes the
 * question look answered. That default still governs every grid that says
 * nothing — omission keeps painting `neutral`, so nothing about an already-shipped
 * grid moves.
 *
 * What changed is that the default is now an OPT-OUT rather than a refusal. A
 * row action may name its own weight (`RowActionVariantSchema`), for the
 * surfaces whose actions genuinely end in a row that is gone — the console's
 * account directory draws Ban and Delete that way. The weight is the author's
 * claim about the action's consequence, never inferred: a `confirm` gate does
 * not imply `destructive`, because an inline-select commit is gated too.
 *
 * `tone: 'primary'` is the commit inside an armed action that is not
 * destructive — the Save of an inline select. It is the one thing the reader
 * came to that bar to press, and it takes the same weight as the Confirm in the
 * bulk bar for the same reason.
 *
 * `tone: 'ghost'` is the quiet one: no fill, muted ink. It exists so a
 * non-committal affordance can recede instead of competing with the action
 * beside it — a ghost that paints a surface would be a second `neutral`.
 */
const ACTION_BUTTON_VARIANT = {
  neutral: 'secondary',
  primary: 'default',
  ghost: 'ghost',
  destructive: 'destructive',
} as const

export const computeTableActionButtonClasses = ({
  tone = 'neutral',
  disabled = false,
}: {
  readonly tone?: 'neutral' | 'primary' | 'ghost' | 'destructive'
  readonly disabled?: boolean
} = {}): string => {
  const base = computeButtonDefaultClasses({
    variant: ACTION_BUTTON_VARIANT[tone],
    size: 'sm',
    state: disabled ? 'disabled' : 'default',
  })
  return swapUtility(
    swapUtility(
      swapUtility(base, ACTION_BUTTON_FROM_HEIGHT, ACTION_BUTTON_TO_HEIGHT),
      ACTION_BUTTON_FROM_PADDING,
      ACTION_BUTTON_TO_PADDING
    ),
    ACTION_BUTTON_FROM_TYPE,
    ACTION_BUTTON_TO_TYPE
  )
}

/** Compute the className for the cluster holding a row's action buttons. */
export const computeTableActionRowClasses = (): string => 'inline-flex gap-1'

// Canvas: `padding:8px; border-top:1px solid #e3e3e3; background:#f4f4f4;
// font-size:12px; gap:10px`.
//
// A WELL with a rule above it, where this shipped as a raised bordered card
// floating inside the cell. The gate replaces the button in place and belongs to
// the row it is asking about; drawing it as its own elevated object made it read
// as a popup that had opened somewhere near the row instead.
const TABLE_INLINE_CONFIRM = [
  'flex items-center gap-2.5 border-t px-2 py-2 text-sm',
  `bg-muted`,
  `border-border`,
].join(' ')

/**
 * Compute the className for the inline confirm bar an armed row action opens,
 * and for the inline select editor that shares its shape.
 */
export const computeTableInlineConfirmClasses = (): string => TABLE_INLINE_CONFIRM
