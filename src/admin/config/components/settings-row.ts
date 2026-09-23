/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The settings-list grid the operator's own account surfaces are built from.
//
// `My profile` and `My data` are one cluster split across two routes, and they
// read as one only while their rows are byte-identical. These class lists were
// authored on `/profile` and are named here for the same reason `card.ts` names
// its own: a literal repeated across two builders drifts, and naming it once is
// the same guarantee with one copy.
//
// The CARD chrome in `card.ts` has NOT been retired — `/api-keys` and the
// developer API page still compose cards, and those are pages of independent
// objects rather than of one object's properties, which is the distinction the
// two shapes carry.

import type { Page as PageConfig } from '@/domain/models/app'
/**
 * The component union, derived rather than imported.
 *
 * `sovrium` exports `PageConfig` and NOT `PageComponent` — the ambient module
 * the binary writes carries the top-level config types only. `sidebar.ts`
 * derives it the same way; a direct import typechecks in an editor that
 * resolves the source tree and fails `bun run typecheck` against the shipped
 * declaration, which is exactly how this got in.
 */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The page column. Wider than a reading measure, narrower than the viewport. */
export const COLUMN = 'flex w-full max-w-4xl flex-col'

/**
 * One settings row: `label | body`, hairline-ruled, stacking under `sm`.
 *
 * The canvas draws three columns. The third one lives INSIDE the form — a form
 * emits its fields and then its submit, so the submit can only be given its own
 * column by the form itself being the grid. Two columns here and two there
 * compose into the three the reader sees, and keep each row's status line under
 * the control that produced it rather than in a fourth cell.
 */
export const ROW =
  'grid grid-cols-1 gap-y-2.5 border-b border-border py-4 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-x-6 sm:gap-y-0'

/**
 * The row's name. `leading-8` puts a 13px label on the 32px control's baseline.
 *
 * An `h2`, and that is the whole of this list's structure — see `row()` below.
 * `block` is kept although a heading is already block-level: the class list is
 * the one that survives if the element ever moves back down the ladder, and a
 * `text` accepts only phrasing-level elements plus the heading ladder, so there
 * is no third option in which the display is implied.
 *
 * `text-base font-medium` are utilities, so they beat the theme's `@layer base`
 * `h2 { ... }` rule outright and the row measures the same as it did as a span.
 * That is the reason the label carries an explicit size at all.
 */
export const ROW_LABEL = 'text-foreground block text-base font-medium sm:leading-8'

/** The row's right-hand half: the control, then whatever the control has to say. */
export const ROW_BODY = 'flex min-w-0 flex-col gap-2'

/** One line of guidance under a control. Never a sentence the row already says. */
export const ROW_HINT = 'text-foreground-subtle text-sm'

/**
 * A row's own status line, written by its `onSuccess.status` / `onError`.
 *
 * `empty:hidden` is what keeps it from costing a gap before it has anything to
 * say — the three page-level status paragraphs this replaces were each 1px tall
 * and sat in a 24px gap on both sides, which is how a 24px rhythm measured 49.
 *
 * The `!` is load-bearing and not emphasis. A `text` with no content is stamped
 * with an INLINE `style="display:inline-block;min-height:1px;min-width:1px"` by
 * `buildEmptyElementStyles`, and an inline display beats any class — so the
 * plain `empty:hidden` computed and did nothing, exactly as `gap-3.5` did on a
 * form before `form` joined `SELF_DISPLAYING_TYPES`. A status target is the one
 * kind of element that is SUPPOSED to be empty until something happens.
 */
export const ROW_STATUS = 'text-foreground-subtle text-sm empty:hidden!'

/**
 * Hide a single-field form's own field label, which the ROW label already says.
 *
 * Visually only — the `<label>` stays in the accessibility tree, so the control
 * keeps its name. Two copies of "Display name" one line apart is noise a reader
 * has to discard; a screen reader still needs the one it cannot see.
 */
export const ROW_FORM_SILENT_LABEL = '[&_label>span:first-child]:sr-only'

/**
 * A form declining the engine's card, and re-laying its submit into column two.
 *
 * `border-0 bg-transparent p-0 rounded-none` drops the frame; the grid puts the
 * fields at a 416px measure and the submit beside them at its own width.
 * `max-content`, not `auto`: an `auto` track absorbs the row's leftover space,
 * which is how a "Save" button came to measure 264px.
 *
 * It carries NO submit repaint. A settings list has one action per row and no
 * primary among them, and the way to say that is `endpoint.submitVariant:
 * 'secondary'` on each form — the same member list a `button` accepts, resolved
 * through the same recipe. The scoped `[&>button[type=submit]]:` override that
 * stood here until the key existed is gone: a second styling vocabulary for
 * something the button schema already says is a gap held open, not a pattern.
 */
export const ROW_FORM = `grid grid-cols-1 items-start gap-x-6 border-0 bg-transparent p-0 rounded-none sm:grid-cols-[minmax(0,26rem)_max-content]`

/** Single-field rows: the row label is the field's label, so the form's is silent. */
export const ROW_FORM_ONE = `${ROW_FORM} ${ROW_FORM_SILENT_LABEL}`

/**
 * The password row carries two fields, and KEEPS their labels: "Current" and
 * "New" are the one distinction the row label cannot make.
 *
 * Two 196px columns plus the inherited 24px gutter is exactly the 416px the
 * single-field rows measure, so all six submits land on one vertical line. The
 * gutter is inherited rather than re-declared on purpose: a second `gap-x` in
 * the same string is not merged away (the concatenation never reaches
 * `resolveClasses`) and the stylesheet, not the author, picks the winner.
 */
export const ROW_FORM_PAIR = `${ROW_FORM} sm:grid-cols-[minmax(0,12.25rem)_minmax(0,12.25rem)_max-content]`

/**
 * Build one `label | body` row.
 *
 * ─── THE ROW LABEL IS AN `h2`, AND NOTHING HERE IS A LANDMARK ──────────────
 *
 * Both of these pages open with one `h1` — the account's own name — and then,
 * until this change, said nothing else about their shape: every row label was a
 * `span`, so a reader navigating by heading landed on the name and ran out of
 * page. Headings are the primary within-page navigation aid, and a settings
 * list is exactly the case they were designed for: a flat sequence of an
 * object's properties, each one named.
 *
 * The alternative — a `region` (or a named `group`) per row — was rejected on
 * three counts, and the first is decisive. `region` is for the few areas of a
 * page a reader would want to jump to; on a four-row page the landmark list
 * would BE the page, which is the dilution the practice warns against. Second,
 * `/profile`'s four form rows already name their own `<form>`, which is a
 * landmark by role — wrapping each in a same-named `region` would nest two
 * landmarks carrying one name. Third, a `group` announces a boundary on entry
 * and exit of a two-cell grid row whose heading already precedes its control:
 * cost with no navigation bought.
 *
 * So the structure is: `h1` account name, then one `h2` per row, no skipped
 * level, and the page's single `region` stays the section that holds them.
 */
export const row = (label: string, body: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: ROW },
    children: [
      { type: 'text', element: 'h2', props: { className: ROW_LABEL }, content: label },
      { type: 'container', element: 'div', props: { className: ROW_BODY }, children: body },
    ],
  }) as PageComponent

/** Build one row's status line. `id` is the `status.target`; the testid is the spec's. */
export const status = (id: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { id, className: ROW_STATUS, 'data-testid': id },
    content: '',
  }) as PageComponent
