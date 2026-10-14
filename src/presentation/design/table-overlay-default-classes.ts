/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for everything the `table` grid opens IN
 * FRONT of itself — the popover an inline cell edit opens in, the dialogs it puts over the page, and the toast that reports
 * what a write did.
 *
 * ## Why this is a separate file
 * Because `table-default-classes.ts` and this module together are past the
 * 400-line cap that governs this directory, and the cap is right: sixty
 * computers in one file is more than a reader can hold. So the grid's vocabulary
 * is cut once, and this is the cut — the GRID over there, what the grid PUTS IN
 * FRONT OF IT over here.
 *
 * That line is worth stating because it decides where the next computer goes,
 * and the answer is a question about the element rather than about line counts:
 * does it paint the surface the reader is looking at, or something drawn on top
 * of it that a gesture will dismiss? A toolbar PANEL is a band inside the grid's
 * own frame and stays there. A toolbar MENU is the platform's dropdown menu
 * (`overlays/menu-default-classes.ts`), drawn on shadcn's anatomy.
 *
 * Elevation is the reason that line is real rather than tidy. Everything in this
 * file makes a claim about how far off the page it floats and reads it against
 * its neighbours — a cell editor and a dialog take `shadow-lg` because they cover
 * what they act on.
 *
 * Do not import this module directly from a component. Import
 * `table-default-classes.ts`, which re-exports every name below, so a caller
 * reaches the grid's whole vocabulary through ONE import and never has to know
 * which half a computer lives in — the same arrangement `TABLE_HEADER_TYPE`
 * already has with `table-type-classes.ts` next door. If that module ever stops
 * re-exporting a name, the split has leaked and the fix is there rather than at
 * the call site.
 *
 * ## Safelist
 * This directory is registered in `RECIPE_DIRS`
 * (`src/infrastructure/css/arbitrary-var-safelist.ts`) and the scan matches any
 * `*-default-classes.ts` under it, so the `v(…)` literals below are emitted into
 * the compiler's `@source inline(...)` safelist exactly as its sibling's are. A
 * rename that drops that suffix would silently stop every arbitrary class here
 * from reaching the stylesheet.
 *
 * Parts covered:
 *
 *   - CELL EDITOR   — the popover an inline edit opens in, and its parts
 *   - DIALOG        — the centring layer, the panel and the type inside it
 *   - DROP ZONE     — the import dialog's drag-and-drop target
 *   - PREVIEW GRID  — the import / paste preview tables
 *   - TOAST         — the floating strip that reports a write's outcome
 *
 * ## What is NOT here
 * The dialog SCRIM is shadcn's `dialog-overlay`, from `dialog-default-classes.ts`,
 * which the grid's dialogs call directly.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// CELL EDITOR — the popover an inline edit opens in, and the parts inside it
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `pop`: `width:200–280px; border:1px solid #e3e3e3; border-radius:6px;
// background:#fefefe; box-shadow:0 8px 24px rgb(0 0 0 /0.12)` (= `shadow-lg`);
// `padding:10px; flex-col; gap:8px; font-size:12px`.
//
// `shadow-lg` and not the menus' `shadow-md`, which is the reverse of the
// elevation argument made for the toolbar dropdowns and lands the other way for
// a reason: a menu is anchored BESIDE the button that opened it and stays on the
// page, while a cell editor covers the row it edits and has to read as being in
// front of it. The row underneath is still legible; the shadow is what says the
// editor is not part of it.
//
// The stacking and the `absolute` are IN the recipe rather than left to the
// caller — unlike the menus, whose position belongs to their trigger. Every one
// of these opens over its own `<td>` at the frame's origin, so the offset is a
// property of the editor rather than of the cell, and four call sites spelling
// `absolute … z-20` separately is how one of them ends up at `z-10`.
const TABLE_EDITOR_POPOVER = [
  'absolute z-20 flex flex-col overflow-hidden border text-sm',
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `bg-card`,
  `border-border`,
  `shadow-[${v('shadow-lg', T.shadowLg)}]`,
].join(' ')

// TWO interiors, and the axis exists so that neither has to override the other.
//
// `padded` is the drawings' `padding:10px; gap:8px` — a popover holding CONTROLS
// that need air around them: a prose editor, a labelled sample list.
//
// `stacked` is a popover whose children are full-width strips meant to touch its
// edges and each other — a candidate list with a link count and a load-more
// under it. Appending `p-0 gap-0` to the padded string would have expressed the
// same thing and NOT worked: two utilities setting one property are resolved by
// Tailwind's own emission order, not by the order they appear in a class list,
// so which padding won would not have been this file's decision. The same trap
// `swapUtility` exists for one module over.
const TABLE_EDITOR_POPOVER_LAYOUT: Record<'padded' | 'stacked', string> = {
  padded: 'gap-2 p-2.5',
  stacked: 'gap-0 p-0',
}

/**
 * Compute the default className for the surface an inline cell editor opens on.
 *
 * ONE surface for the option list, the rich-text editor and its loading
 * boundary. They shipped as three literals that already disagreed — two spent
 * `shadow-md` and a plain `rounded`, the listbox spent `py-1` where the others
 * spent `p-2` — so a reader who opened a multi-select and then a rich-text cell
 * in the same grid saw two different boxes claiming to be the same affordance.
 */
export const computeTableEditorPopoverClasses = ({
  layout = 'padded',
}: {
  readonly layout?: 'padded' | 'stacked'
} = {}): string => [TABLE_EDITOR_POPOVER, TABLE_EDITOR_POPOVER_LAYOUT[layout]].join(' ')

/**
 * The width a PROSE editor's popover takes, when a cell editor needs one at all.
 *
 * Most of them do not: an option list is as wide as its longest candidate and a
 * date picker as wide as a date. A rich-text surface is the exception — it holds
 * a toolbar and wrapped paragraphs, and at the width of the cell underneath it
 * every line breaks twice.
 *
 * 288px against the drawings' 280 top-of-range, because the scale has no rung
 * between 272 and 288 and the eight pixels buy a whole word per line. It is
 * exported rather than typed twice because the editor and the boundary that
 * stands in for it while it loads MUST agree — the boundary exists so the row
 * settles into its edit height once instead of twice, and a width that differed
 * would defeat exactly that.
 */
export const TABLE_EDITOR_PROSE_WIDTH = 'w-72'

/**
 * Compute the className for a caption inside a cell editor — a link count, a
 * refused create, the name of what is being picked.
 *
 * 11px medium on the muted tone: it labels the control below or beside it and
 * must not compete with the values the reader is there to choose between.
 */
export const computeTableEditorLabelClasses = (): string =>
  `text-xs font-medium text-muted-foreground`

/**
 * Compute the className for the scrolling list inside a cell-editor popover.
 *
 * LAYOUT ONLY, deliberately. A listbox carrying the border, the fill and the
 * elevation itself would be a popover in its own right — so a picker that hangs
 * a link-count strip beneath it would produce two stacked surfaces with a seam
 * between them. The chrome belongs to {@link computeTableEditorPopoverClasses}
 * once, and this is the list inside it.
 */
export const computeTableEditorListClasses = (): string =>
  'flex max-h-56 min-w-40 flex-col overflow-auto'

const TABLE_EDITOR_LIST_ROW = [
  'flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-left text-sm',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
].join(' ')

/**
 * Compute the className for one candidate row in a cell editor's list.
 *
 * `active` is the row the pointer or the keyboard is on, and it takes the same
 * well every other highlighted row in the grid takes — the menu item, the
 * selected record, the group header. Inactive rows carry the same well on
 * `hover:` so the two states are one paint reached two ways rather than two
 * paints that can drift.
 */
export const computeTableEditorListRowClasses = ({
  active = false,
}: {
  readonly active?: boolean
} = {}): string => [TABLE_EDITOR_LIST_ROW, active ? `bg-muted` : `hover:bg-muted`].join(' ')

/**
 * Compute the className for the RULE above a full-width strip stacked under a
 * cell editor's candidate list — a link count, a refused create, a load-more.
 *
 * The rule and the width only; each strip keeps its own box, because one of the
 * three is a button and already has padding from the list-row recipe. A shared
 * padding here would be a second `px-2 py-1` beside that one.
 *
 * The rule above it names its colour EXPLICITLY. Tailwind v4 defaults an
 * uncoloured `border-*` to `currentColor`, so a strip that inherited nothing
 * would draw its divider in whatever the text colour happens to be — which for
 * the refused-create strip is the error tone, and for the load-more is the muted
 * foreground. Three strips, three different rules, none of them the border
 * token. The popover's own border does not cascade into its children.
 */
export const computeTableEditorStripClasses = (): string =>
  ['w-full border-t', `border-border`].join(' ')

/**
 * Compute the className for a cell editor's action row — Cancel then Save.
 *
 * Right-aligned, because the commit is the last thing read on a surface whose
 * content is read top to bottom, and the gap matches the popover's own so the
 * footer does not read as a separate band.
 */
export const computeTableEditorFooterClasses = (): string => 'flex justify-end gap-1.5'

// ──────────────────────────────────────────────────────────────────────────────
// DIALOG — the type treatment inside the grid's own modals
// ──────────────────────────────────────────────────────────────────────────────

// shadcn/ui's `dialog-content` surface (base-nova): `rounded-xl`, the popover
// fill, a 1px foreground ring at 10 % rather than a border or a shadow, `p-4`
// and a `gap-4` rhythm. The card is centred by a full-screen layer rather than
// centring itself, so a click beside it lands on that layer and dismisses it.
const TABLE_DIALOG_PANEL =
  'flex w-full flex-col gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10'

// TWO widths: a `confirm` asks a question in a sentence and takes base-nova's
// `max-w-sm`; a `grid` holds a preview of rows about to become table rows, and
// the columns behind it must still read as columns.
const TABLE_DIALOG_WIDTH: Record<'confirm' | 'grid', string> = {
  confirm: 'max-w-sm',
  grid: 'max-w-3xl',
}

/**
 * The create-record form: base-nova's `dialog-content`, centring itself, a
 * column so its field list scrolls under a pinned title and reachable actions.
 */
export const computeTableFormDialogClasses = (): string =>
  'fixed top-1/2 left-1/2 z-50 flex max-h-dvh w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none duration-100 sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

/**
 * Compute the className for the card inside one of the grid's own dialogs —
 * Import CSV, paste preview, Table settings, Save view, Delete view, Create
 * record.
 *
 * Six literals said this six ways: three radii, two shadows, two surfaces and
 * four different widths, so a reader who imported a CSV and then saved a view
 * saw two boxes that did not agree they were the same kind of thing.
 */
export const computeTableDialogPanelClasses = ({
  width = 'confirm',
}: {
  readonly width?: 'confirm' | 'grid'
} = {}): string => [TABLE_DIALOG_PANEL, TABLE_DIALOG_WIDTH[width]].join(' ')

/**
 * Compute the className for the full-screen layer that CENTRES one of those
 * cards — the `Dialog.Popup` in the Base UI trees, and the `role="dialog"`
 * element in the two that manage their own open state.
 *
 * It is a separate computer from the panel because it is a separate element,
 * and the separation is what makes an outside click work: the layer fills the
 * viewport, so a click beside the card lands on the layer rather than on the
 * page, and the dialog can tell the two apart. Collapsing it into the panel —
 * which is what the platform's own `computeDialogPopupClasses` does — would
 * change what clicking beside a dialog does, which is why the note above says
 * this module cannot adopt that recipe.
 *
 * `p-4` is the only reason a card on a short viewport does not touch the edge
 * of the screen; it is the layer's padding, not the card's margin, so a card
 * that grows to `max-h-dvh` still stops 16px short on every side.
 *
 * Six sites wrote this string out. None of them disagreed, which is exactly the
 * state in which the seventh one quietly does.
 */
export const computeTableDialogPositionerClasses = (): string =>
  'fixed inset-0 z-50 flex items-center justify-center p-4'

/** A grid dialog's title: base-nova's `dialog-title`. */
export const computeTableDialogTitleClasses = (): string => 'text-base leading-none font-medium'

/**
 * Compute the className for a grid dialog's supporting line.
 *
 * 12px muted — the same step and tone as every other explanatory line the grid
 * draws, so a dialog's body copy and a panel's caption are recognisably the same
 * kind of sentence.
 */
export const computeTableDialogBodyClasses = (): string => `text-sm text-muted-foreground`

// Canvas `dropZone`: `border:1px dashed #a1a1a1; border-radius:6px; padding:18px;
// flex-col; align-items:center; gap:8px; font-size:12px; color:#707070`.
//
// `p-4` is 16px against the drawing's 18: the platform's spacing scale has no
// rung there, and inventing an arbitrary one to close two pixels would put a
// number outside the scale into the one place a reader is most likely to copy
// from. The DASHED border is `fg-disabled` rather than a border token — a dashed
// rule at border tone disappears at this weight, which is why the drawing
// reaches a step darker for it than for any solid rule on the surface.
const TABLE_DROP_ZONE = [
  'flex flex-col items-center gap-2 border border-dashed p-4 text-center text-sm',
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `border-muted-foreground`,
  `text-muted-foreground`,
].join(' ')

/** Compute the className for the drag-and-drop target in the import dialog. */
export const computeTableDropZoneClasses = (): string => TABLE_DROP_ZONE

const TABLE_PREVIEW_GRID_CELL: Record<'header' | 'data', string> = {
  header: [
    'px-2 py-1 text-left text-xs font-medium border-b',
    `border-input`,
    `text-muted-foreground`,
  ].join(' '),
  data: ['px-2 py-1 text-sm border-b', `border-border`].join(' '),
}

/**
 * Compute the className for a cell in the import / paste preview tables.
 *
 * These are grids showing rows that are ABOUT to become grid rows, and they were
 * drawn as neither: a full box border on every cell, 12px padding, and a header
 * at body weight. Adopting the grid's own header and cell vocabulary — the
 * strong rule under the header, the plain rule between rows, 11px above 12px —
 * is what lets a reader check a preview against the table behind the dialog
 * without re-reading which is which.
 */
export const computeTablePreviewGridCellClasses = ({
  kind,
}: {
  readonly kind: 'header' | 'data'
}): string => TABLE_PREVIEW_GRID_CELL[kind]

// ──────────────────────────────────────────────────────────────────────────────
// TOAST — the floating strip that reports what just happened to the rows
// ──────────────────────────────────────────────────────────────────────────────

const TABLE_TOAST_BASE = [
  'inline-flex items-center gap-2.5 border px-3 py-2 text-sm',
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `shadow-[${v('shadow-lg', T.shadowLg)}]`,
].join(' ')

const TABLE_TOAST_TONE: Record<'neutral' | 'error', string> = {
  neutral: [`bg-card`, `border-border`].join(' '),
  error: [`bg-destructive/10`, `border-destructive/50`, `text-destructive`].join(' '),
}

/**
 * Compute the className for a grid toast — a paste result, a write that lost a
 * race.
 *
 * Two tones and no more. `neutral` REPORTS (`N rows pasted`, with an undo beside
 * it); `error` says a write the reader made did not survive, and takes the SOFT
 * error pair rather than the solid one, because a toast is read and dismissed
 * rather than actioned. The paste toast shipped as an inverted slab — the
 * foreground colour used as a fill — which is the one surface treatment the
 * design reserves for a tooltip, and it had to invent `bg-white/10` for its own
 * button because no token exists for a control on top of an inverted ground.
 */
export const computeTableToastClasses = ({
  tone = 'neutral',
}: {
  readonly tone?: 'neutral' | 'error'
} = {}): string => [TABLE_TOAST_BASE, TABLE_TOAST_TONE[tone]].join(' ')
