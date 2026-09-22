/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The four kit categories a reader TRIGGERS rather than reads: navigation,
 * overlays, specialty and AI.
 *
 * ─── WHY THESE FOUR ARE ONE FILE ───────────────────────────────────────────
 *
 * Every refusal the kit-completion pass had to make is in here, and each is a
 * different reason a component cannot be drawn on a read-only console page
 * that renders flat:
 *
 *   - it PORTALS out of the theme scope and opens modal — `dialog`,
 *     `alert-dialog`, `drawer`
 *   - its whole surface is a WRITE TRANSPORT — `comments`, `ai-chat`
 *   - it names a LANDMARK the console page already has — `breadcrumb`
 *   - it draws data this surface app deliberately does not carry —
 *     `language-switcher`
 *
 * Those four reasons are the interesting content of this module, and they are
 * worth meeting together. The categories that simply DRAW live in
 * `catalog-specimens/state.ts`.
 */

import type { CatalogSpecimen } from '.'
import type { Component } from '@/domain/models/app/pages/components'

const component = (value: unknown): Component => value as Component

/**
 * A specimen whose visible surface only exists after an interaction.
 *
 * ─── DRAWN CLOSED, AND THE CAPTION IS WHY THE TILE IS NOT EMPTY ────────────
 *
 * Every overlay primitive is server-rendered as a hidden placeholder that its
 * island promotes to a portal on open. That is the CORRECT resting state to
 * document — a design system shows a dialog closed, because closed is what a
 * reader meets — but it leaves a tile with nothing in it, which reads as a
 * broken specimen rather than as a closed one.
 *
 * So the real component is drawn beside one line naming the interaction that
 * surfaces it. The line is a CAPTION, never a drawing of the overlay: a
 * hand-composed picture of an open dialog would document markup this app never
 * emits, which is the exact failure `[internal ref]` exists to catch
 * in the category next door.
 *
 * ─── AND WHY THEY ARE NOT OPENED FOR THE SPECIMEN ──────────────────────────
 *
 * Base UI portals mount at `document.body`, which is OUTSIDE
 * `[data-design-app-scope]`. An opened overlay therefore resolves the CONSOLE's
 * tokens rather than the operator's, so a dark specimen's dialog opens light —
 * the known hole recorded on `appScope` in `design-system-section-surface.ts`.
 * An opened-overlay specimen would not merely look odd; it would document the
 * wrong design system.
 */
const closedOverlay = (note: string, ...parts: readonly unknown[]): Component =>
  component({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      ...parts,
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-[11px] leading-relaxed' },
        content: note,
      },
    ],
  })

/** The six navigation types. */
const NAVIGATION_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    // ─── DRAWN, AND THE REFUSAL IT CARRIED WAS A RENDERER BUG ──────────────
    //
    // This was reported for an accessibility reason rather than a safety one:
    // `breadcrumb` renders `<nav aria-label="Breadcrumb">` per the WAI-ARIA
    // pattern, every console page already carries its own trail, and two
    // navigation landmarks sharing one name is a defect for anyone cycling
    // them. The refusal recorded that the name was HARDCODED — `props`
    // carried it in and one line later a literal overwrote it.
    //
    // That is fixed at the renderer (`navigation-components.tsx`): a declared
    // `aria-label` wins and "Breadcrumb" stays the default. So the specimen
    // names itself, the page keeps exactly one landmark called Breadcrumb —
    // its own — and the component is drawn rather than described.
    //
    // The name shares no WORD with the page's own, and that is the whole
    // criterion rather than a nicety: an accessible name is matched as a
    // substring by every tool that offers a landmark list, so "Breadcrumb
    // specimen" would still be a second "Breadcrumb" to a reader cycling them.
    type: 'breadcrumb',
    component: component({
      type: 'breadcrumb',
      props: { 'aria-label': 'Specimen trail' },
      breadcrumbItems: [
        { label: 'Records', href: '/records' },
        { label: 'Invoices', href: '/records/invoices' },
        { label: 'INV-0042' },
      ],
    }),
  },
  {
    // ─── DRAWN AS A STILL PICTURE, WHICH IS NOT THE SAME AS LIVE ───────────
    //
    // The palette renders nothing server-side on a page that HOSTS one: it
    // emits a JSON config block and its runtime, then builds the overlay in the
    // browser on the first ⌘K. Pre-rendering it there would put two
    // `role="dialog"` and two `role="searchbox"` in every document.
    //
    // A specimen is the other case. `commandPaletteComponent`'s specimen mode
    // draws the overlay's own markup — the search row and the quick actions,
    // through the theme's own selectors — and emits neither the config block,
    // nor the runtime, nor `role="dialog"`. The page still advertises exactly
    // one palette and one keystroke still opens exactly one overlay; what is
    // drawn here is a picture of that overlay, in place.
    //
    // The two `pages` are the specimen's illustrative content, read by the same
    // `quickActions()` derivation the live runtime applies to a real app's
    // config — so the rows a reader sees are the rows the palette builds.
    type: 'command-palette',
    component: component({
      type: 'command-palette',
      props: {
        specimen: true,
        pages: [
          { name: 'invoices', path: '/invoices', title: 'Invoices' },
          { name: 'contacts', path: '/contacts', title: 'Contacts' },
        ],
      },
    }),
  },
  {
    type: 'pagination',
    component: component({
      type: 'pagination',
      totalPages: 10,
      currentPage: 3,
      siblingCount: 1,
    }),
  },
  {
    type: 'dropdown-menu',
    component: component({
      type: 'dropdown-menu',
      // `Show archived` is a TOGGLE row, and it belongs here rather than in the
      // page's own hand-shaped `open` drawing. An option a reader never sees
      // drawn is an option they will not find — and this specimen is the one
      // the console renders through `MenuPopupBody`, the same code a live menu
      // takes, so what the page shows is what an app emits. The hand-shaped
      // panel is a picture OF a menu; a switch drawn there would document
      // markup nothing renders.
      menuItems: [
        { label: 'Copy' },
        { label: 'Duplicate' },
        { label: 'Show archived', toggle: 'unchecked' },
        { label: 'Delete' },
      ],
    }),
  },
  {
    type: 'context-menu',
    component: closedOverlay('Opens on right-click, anywhere inside its region.', {
      type: 'context-menu',
      menuItems: [{ label: 'Copy' }, { label: 'Duplicate' }],
    }),
  },
  {
    type: 'menubar',
    component: component({
      type: 'menubar',
      props: {
        menus: [
          { label: 'File', items: [{ label: 'New table' }] },
          { label: 'View', items: [{ label: 'Compact rows' }] },
        ],
      },
    }),
  },
  {
    type: 'navigation-menu',
    component: component({
      type: 'navigation-menu',
      navItems: [
        { label: 'Docs', href: '/docs' },
        { label: 'Pricing', href: '/pricing' },
      ],
    }),
  },
]

/**
 * What the four portal-modal overlays have in COMMON, stated once.
 *
 * ─── SHARED TAIL, PER-TYPE OPENING — AND THE SPLIT IS THE POINT ────────────
 *
 * One string across all four was the shape until the kit became a card index,
 * where a refused type's card carries its reason and very little else. Four
 * cards printing one paragraph tells a reader four times that *something*
 * portals, and never which of the four they are looking at.
 *
 * The consequence really is one thing, so it is written once here and appended;
 * what each type OPENS as is genuinely different, so each states its own. That
 * keeps the property `[internal ref]` asserts — no two refused types
 * share a sentence — without paying for it in four hand-written variants of the
 * same true clause, which is what a single shared constant existed to prevent.
 */
const OVERLAY_CONSEQUENCE =
  ' It portals outside this preview’s theme scope, so an opened one resolves the console’s tokens ' +
  'rather than yours. Look at it on the page you put it on.'

/** One portal-modal overlay's refusal: what IT opens as, plus the shared tail. */
const overlayRefusal = (opening: string): CatalogSpecimen['refusal'] => ({
  state: 'not-previewable',
  note: opening + OVERLAY_CONSEQUENCE,
})

/**
 * The eight overlay types — four drawn, four REFUSED, and the split was
 * measured rather than reasoned.
 *
 * ─── WHAT THE MEASUREMENT WAS ──────────────────────────────────────────────
 *
 * The brief for this pass said overlays must be drawn CLOSED, because Base UI
 * portals mount at `document.body` — outside `[data-design-app-scope]` — so an
 * opened overlay resolves the CONSOLE's tokens and documents the wrong design
 * system.
 *
 * Drawn as configured here, `dialog`, `alert-dialog` and `drawer` do not stay
 * closed. Hydrated on the UI kit page they portal open dialogs onto
 * `document.body`, one of them modal and holding focus — and a modal dialog
 * makes the rest of the document inert, so every other control on the page
 * leaves the accessibility tree. Measured, not predicted:
 * `[internal ref]` went from 53 textboxes to ZERO on that page, and
 * `-049` could no longer reach the anatomy button of a specimen it could see.
 * Two of them also brought a `<form>` with them, which the page may not carry
 * at all. That measurement was taken when `record-drawer` was a fourth type
 * here; it has since been folded into `drawer`, which changes the count but
 * not the finding.
 *
 * So the three are reported, and this is the same refusal `layout`'s `modal`
 * already carries in `catalog-specimens/index.ts` — *"Renders as an
 * overlay. It has no inline appearance to document, and opening it would cover
 * the page."* The precedent decided this; the measurement only confirmed which
 * types it covers.
 *
 * The other four are drawn because they DO have a resting appearance: `toast`
 * is a plain surface, and `popover` / `hover-card` / `tooltip` render their
 * triggers inline and open only on an interaction the reader initiates.
 */
const OVERLAY_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'popover',
    component: component({ type: 'popover', props: { triggerLabel: 'Details' } }),
  },
  {
    type: 'hover-card',
    component: component({ type: 'hover-card', props: { triggerLabel: '@sovrium' } }),
  },
  {
    type: 'tooltip',
    component: closedOverlay('Opens on hover or focus of its trigger.', {
      type: 'tooltip',
      props: { tooltipContent: 'Rate limit' },
    }),
  },
  {
    type: 'toast',
    component: component({
      type: 'toast',
      props: {
        role: 'status',
        className:
          'border-border bg-background-raised text-foreground rounded-md border px-3 py-2 text-xs',
      },
      content: 'Export ready',
    }),
  },
  {
    type: 'dialog',
    refusal: overlayRefusal(
      'Opens as a modal panel over the whole page and makes the rest of the document inert while ' +
        'it is open, so it has no resting appearance to document.'
    ),
  },
  {
    type: 'alert-dialog',
    refusal: overlayRefusal(
      'Opens as a blocking confirmation that holds focus until it is answered, so there is ' +
        'nothing of it to draw until a reader has already been interrupted.'
    ),
  },
  {
    type: 'drawer',
    refusal: overlayRefusal(
      'Slides in from an edge and covers the page for as long as it is open, so it would cover ' +
        'the kit rather than sit in it.'
    ),
  },
]

/**
 * The sentence a type carries when its whole surface is a write path.
 *
 * ─── ONE MEMBER LEFT, AND WHY THE OTHER TWO WENT ──────────────────────────
 *
 * `comments`, `ai-chat` and `form` all hydrate a `<form>` with a
 * `type="submit"` control, and all three were refused together: drawn on the
 * console page they were live write transports in a document carrying the
 * operator's admin session, which [internal ref] A2 forbids outright and
 * `[internal ref]` counts at a permitted zero. Measured: with them
 * drawn, that page carried two forms and two submit buttons.
 *
 * `ai-chat` and `form` are now drawn, because A3 clause 1 is narrower than the
 * refusal read it to be — it permits a specimen form element *"while it carries
 * no action and no submit path"*, which is a bound on the TRANSPORT rather than
 * on the picture. Each of them has a path that satisfies it (see their entries).
 * `comments` has none yet: its composer is inseparable from the record it posts
 * onto, and binding a preview frame to one of the operator's records is what the
 * confidentiality bound forbids. So this sentence has one member, and it is a
 * standing refusal rather than a shared one.
 *
 * Split into a shared TAIL and a per-type opening for the reason
 * {@link OVERLAY_CONSEQUENCE} is: on the card index a refused type's reason is
 * most of what its card carries, and two cards printing one paragraph name
 * neither type. What each one composes is different — a comment on a record, a
 * prompt to an agent — so each says so.
 */
const WRITE_TRANSPORT =
  ' A read-only console may carry no write path, so it is named here rather than drawn. It ' +
  'renders on your own pages.'

/** One write-surface refusal: what IT composes, plus the shared tail. */
const writeTransportRefusal = (opening: string): CatalogSpecimen['refusal'] => ({
  state: 'not-previewable',
  note: opening + WRITE_TRANSPORT,
})

/** The nine specialty types — five drawn, four reported. */
const SPECIALTY_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'number-input',
    component: component({
      type: 'number-input',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 12,
      showStepper: true,
      props: { label: 'Quantity' },
    }),
  },
  {
    type: 'time-picker',
    component: component({
      type: 'time-picker',
      timeFormat: '24h',
      minuteStep: 15,
      props: { label: 'Due time' },
    }),
  },
  {
    type: 'file-upload',
    // `Choose a file` and not `Upload file`: the reference app's label is the
    // second, and `upload` is fine — but the whole family here is renamed away
    // from imperative verbs so the forbidden-verb sweep stays readable rather
    // than becoming a list of near-misses someone has to re-check.
    component: component({
      type: 'file-upload',
      accept: 'image/*,.pdf',
      props: { label: 'Choose a file' },
    }),
  },
  {
    type: 'reorderable-list',
    component: component({
      type: 'reorderable-list',
      reorderable: true,
      props: { className: 'flex flex-col gap-1 text-xs' },
      children: [
        { type: 'list-item', content: 'First — research', props: { id: 'kit-task-1' } },
        { type: 'list-item', content: 'Second — draft', props: { id: 'kit-task-2' } },
      ],
    }),
  },
  {
    // A preview of a preview: `badge` at `badgeVariant: 'outline'`, with the
    // readout above it and a caption under it. Drawn rather than refused —
    // nothing here carries a write path, and the whole claim of [internal ref] is that
    // the drawing goes through the same catalogue path a `specimen` takes,
    // which a card that only described it could not show.
    //
    // The option is `badgeVariant` and NOT `variant`, which is a different axis
    // on the same type: `variant` selects the badge's MODE (`status` /
    // `contrast`), `badgeVariant` its paint. Both are published option paths,
    // so naming the wrong one is accepted rather than refused — the write lands
    // on a real key, changes nothing visible, and leaves the card announcing a
    // value beside a picture of the default.
    //
    // The subject is a LITERAL, deliberately. A `$param.` or `$record.` one
    // would resolve to nothing on the kit page, and a card that reported "no
    // subject" would document the deferral rather than the component.
    type: 'preview',
    component: component({
      type: 'preview',
      subject: { type: 'badge', option: 'badgeVariant', value: 'outline' },
      caption: 'A quieter badge, for a status the reader is not being asked to act on.',
    }),
  },
  {
    type: 'comments',
    refusal: writeTransportRefusal(
      'Hydrates a comment composer — a form with a live submit control that posts a comment onto ' +
        'a record.'
    ),
  },
  {
    type: 'language-switcher',
    refusal: {
      state: 'needs-data-source',
      note:
        'Draws the languages an app declares in languages[]. This console’s own surface app ' +
        'declares none — it carries your design system and deliberately nothing else — so the ' +
        'component has no list to draw. It renders on your pages.',
    },
  },
  // ─── THE TWO SPECIMEN PRIMITIVES, REPORTED ─────────────────────────────
  //
  // Both are published kit types a reader can reach, and until now each had a
  // card that neither drew nor said why — the exact signature of a type literal
  // added to a barrel with no registry entry behind it, which is the invariant
  // `[internal ref]` now sweeps for across every category.
  //
  // Their two reasons are DIFFERENT, and the notes say so rather than sharing
  // one sentence: a line pasted across two types goes false on both together
  // and no reader can tell which one it stopped describing.
  {
    type: 'specimen',
    refusal: {
      state: 'not-previewable',
      // Structural and decode-time, not editorial: `SPECIMEN_REFUSED_TYPES` in
      // `specialty/specimen-refusal.ts` names `specimen` itself, so a card
      // holding one would not decode. The reason is unboundedness rather than
      // safety — each level projects its snippet from the level below, so the
      // nesting has no bottom.
      note:
        'A frame around a drawn component and the config that produced it. It refuses to hold ' +
        'another one — each level would print the level below, with no bottom — so it cannot be ' +
        'drawn inside this page. Every card here is one.',
    },
  },
  {
    type: 'field-specimen',
    refusal: {
      state: 'not-previewable',
      // The `custom` argument, one category over: a type whose whole output is
      // supplied by the author has no generic appearance to document. Drawing
      // it would mean naming one arbitrary field type, and the card would then
      // document THAT field type rather than this component — while the field
      // catalogue already draws all of them, each in every state.
      note:
        'Has no appearance of its own: it draws whatever control the fieldType you name gets, so ' +
        'a card here would document one field type instead of this component. The field types are ' +
        'all drawn, in every state, in the field catalogue.',
    },
  },
]

/**
 * The one AI type, DRAWN — and what changed was the transport, not the picture.
 *
 * `ai-chat` was reported because it hydrates a composer: a `<form>` with a
 * `type="submit"` Send button that POSTs a prompt to this instance's AI
 * provider. That is a write path with a friendly name, and a read-only console
 * may carry none.
 *
 * [internal ref] A3 clause 1 draws the line one step in from where this refusal drew
 * it: a specimen form element is permitted *"while it carries no action and no
 * submit path"*. So the panel's SKELETON — the message log and the composer
 * row, which is the whole of what this type looks like — was never the problem;
 * the island behind it was. The renderer's specimen mode withholds exactly
 * that: no `data-island`, and `type="button"` on the send control. Nothing is
 * wired, nothing is posted, and a reader sees the real markup rather than a
 * sentence about it.
 *
 * `chatHeight` is a third of the live default: a 400px panel drawn three times
 * down a states strip is a column of empty boxes.
 */
const AI_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'ai-chat',
    component: component({
      type: 'ai-chat',
      props: {
        specimen: true,
        placeholder: 'Ask a question…',
        chatHeight: 140,
      },
    }),
  },
]

/** The four categories this module owns. */
export const TRIGGERED_SPECIMENS_BY_CATEGORY = {
  navigation: NAVIGATION_SPECIMENS,
  overlays: OVERLAY_SPECIMENS,
  specialty: SPECIALTY_SPECIMENS,
  ai: AI_SPECIMENS,
} as const satisfies Readonly<Record<string, readonly CatalogSpecimen[]>>
