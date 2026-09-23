/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The shape a RAILED console page has, said once for the pages that have one.
//
// ─── A RAIL IS THREE THINGS, AND ALL THREE MOVE TOGETHER ───────────────────
//
// An entry (`data-design-rail-entry`), the section it addresses (`id` AND
// `data-design-section` — the rail scrolls by the first, the scroll-spy finds
// the second, and a section carrying only one of them scrolls correctly while
// marking nothing), and the tail room that gives the LAST entry somewhere to
// travel to. Without that room the rail stops working two thirds of the way
// down; bought as a blanket spacer it is dead scroll nobody sees in review, so
// it is a floor on the last section — see `withTailRoom` below.
//
// ─── THE ENTRIES ARE UNCONDITIONAL, WHICH IS A DECISION ────────────────────
//
// The retired builder filtered its rail by re-running each block's own render
// and dropping the entries that drew nothing. A config page cannot: `render` is
// code, and `visibility.record` reads ONE record while five sections read five
// different row families. So every section renders — with its own honest empty
// state where it has nothing — and every entry therefore resolves. That trades
// a shorter rail on a bare app for the property the rail specs actually assert,
// which is that no entry is a dead link.

import { CHROME_BAR_OFFSET_CLASS } from '../../components/shell'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** One rail entry, and the section it addresses. */
export interface RailSection {
  readonly id: string
  readonly title: string
}

/**
 * The reading measure, per type size.
 *
 * A line of prose is comfortable between about 65 and 75 characters and hard
 * work beyond it, and a console column is wide: at 1440 the body of a railed
 * page is 829px, which is 113 characters of `text-md` and 138 of `text-sm`.
 * Halving the shell gutter from 40 to 16 gave every one of those lines another
 * 48px, so the cap is what keeps the extra width as margin rather than measure.
 *
 * The cap is per SIZE because the measure is in characters and the utility is
 * in pixels. Measured on IBM Plex Sans at this console's ladder, one character
 * averages half the type size, so:
 *
 *   `text-[11px]`  → `max-w-sm`  384px → 70ch
 *   `text-sm`  12px → `max-w-md`  448px → 75ch
 *   `text-md`  14px → `max-w-lg`  512px → 73ch
 *   `text-lg`  16px → `max-w-xl`  576px → 72ch
 *
 * A cap only ever narrows, so applying one to a block that is already inside a
 * card or a grid column costs nothing.
 */
export const MEASURE_XS = 'max-w-sm'
export const MEASURE_SM = 'max-w-md'
export const MEASURE_MD = 'max-w-lg'
export const MEASURE_LG = 'max-w-xl'

/** The quiet uppercase micro-label the whole console chrome is set in. */
export const microLabel = (label: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: {
      className: 'text-foreground-subtle text-[11px] font-medium tracking-[0.04em] uppercase',
    },
    content: label,
  }) as PageComponent

/** The same label, taken from a row rather than written out. */
export const microLabelOf = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: {
      className: 'text-foreground-subtle text-[11px] font-medium tracking-[0.04em] uppercase',
    },
    content,
  }) as PageComponent

/**
 * A section heading — the noun a rail entry names.
 *
 * `text-lg` is 16/24/600 on this ladder, which is the canvas's page title
 * exactly. The console spends one rung LESS than the canvas here, deliberately:
 * what the canvas calls a page title is, on these pages, a heading inside a
 * document that already has an `h1` above it. Set any larger and a section
 * reads as a page.
 */
export const sectionHeading = (label: string): PageComponent =>
  ({
    type: 'text',
    element: 'h2',
    props: { className: 'text-foreground text-lg font-semibold tracking-tight' },
    content: label,
  }) as PageComponent

/** One line of explanation at reading width. */
export const caption = (body: string, testId?: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: MEASURE_MD,
      ...(testId === undefined ? {} : { 'data-testid': testId }),
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-md leading-relaxed' },
        content: body,
      },
    ],
  }) as PageComponent

/**
 * The dashed card a section shows when the key behind it is not declared.
 *
 * ─── AN EMPTY LABEL ROW IS WORSE THAN AN EMPTY SECTION ─────────────────────
 *
 * A section bound to an undeclared key used to render its label rows with
 * nothing beside them — `Address the reader as`, `Personality`, and a blank.
 * That reads as a page that failed to load rather than an app that has not
 * declared something, and the reader has no way to tell the two apart.
 *
 * ─── AND THE NEXT ACTION IS THE POINT ──────────────────────────────────────
 *
 * Restraint deletes adjectives, not the sentence that says what happens next.
 * So the card carries three things and no fourth: that it is not configured,
 * what the app does INSTEAD in the meantime, and the one key to declare. The
 * affordance is a link to the published article rather than a control — this
 * console reads configuration and never writes it, so a button here would be
 * the first thing on it that promised otherwise.
 */
export const notConfiguredCard = (input: {
  readonly body: string
  readonly configKey: string
  readonly href: string
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border flex w-full flex-col items-start gap-2.5 rounded-md border border-dashed p-4',
      'data-design-not-configured': input.configKey,
    },
    children: [
      microLabel('Not configured'),
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_MD} text-md leading-relaxed` },
        content: input.body,
      },
      {
        type: 'link',
        props: {
          href: input.href,
          className:
            'border-border text-foreground hover:bg-background-subtle rounded-md border px-2.5 py-1 text-[11px] font-medium no-underline',
          ...kitType('link'),
        },
        content: `Declare ${input.configKey} \u2192`,
      },
    ],
  }) as PageComponent

/**
 * Mark one element as a live instance of the kit type it is drawn with.
 *
 * The console documents the kit and is BUILT from the kit, and the footer below
 * says which types each page used. A sentence like that is worth nothing typed
 * by hand — "Built from 14 kit types" beside a page that draws nine is exactly
 * the drift this console exists to remove — so the claim is checkable: every
 * name in the footer has to be found on an element the page really stamped.
 *
 * Spread into a component's `props`, beside whatever else it carries.
 */
export const kitType = (type: string): Readonly<Record<string, string>> => ({
  'data-design-kit-type': type,
})

/**
 * One anchored section: the heading, its body, and BOTH markers the rail and
 * the scroll-spy read.
 */
export const anchoredSection = (
  section: RailSection,
  children: readonly PageComponent[]
): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-4',
      id: section.id,
      'data-design-section': section.id,
    },
    children: [sectionHeading(section.title), ...children],
  }) as PageComponent

/**
 * The rail column.
 *
 * The scroll-spy rides beside it as a marker-mounted island: it renders nothing
 * and adds only the `aria-current` the rail specs read, so the rail is fully
 * functional server-side and the island is a pure enhancer.
 *
 * ─── IT STICKS UNDER THE BAR, AND IT IS THE FIRST THING A PHONE LOSES ──────
 *
 * `sticky` sits on the SAME element that carries `data-testid`, not on a child:
 * a chrome spec reads the computed `position` off the element it addressed, and
 * an outer wrapper holding a sticky inner div reads back `static` while
 * behaving correctly. `self-start` is what makes it work at all — a flex item
 * stretched to the row's height has nowhere to travel.
 *
 * The offset clears the 48px shell bar by one 16px step. Two sticky elements
 * sharing an offset overlap, and the one that loses is the rail: its first
 * entries slide behind the bar exactly when a reader reaches for them.
 *
 * ─── AND IT IS READ, NOT COPIED ────────────────────────────────────────────
 *
 * `CHROME_BAR_OFFSET_CLASS` comes from `components/shell.ts`, which declares
 * the bar's height and the two clearances derived from it. It used to be
 * spelled `top-16` here as well — the same number in two files against one bar
 * — and when the bar went 53px → 48px only this copy failed to move, leaving a
 * 24px misalignment and turning `[internal ref]` red. A number
 * copied into two files is a property of neither, which is why
 * `[internal ref]` compares the two columns against EACH OTHER
 * rather than against a literal: with one declaration, a bar that changes
 * height now moves both columns together.
 *
 * `build:admin-preset` evaluates this config and emits literals, so the import
 * costs nothing at runtime and the emitted class still reaches the Tailwind
 * candidate corpus.
 *
 * `xl:`, not `lg:`. A 210px column beside a reading-width body needs 1280px to
 * exist; at 1024 it either wraps — pushing the body into a gutter — or pans the
 * page sideways. Dropping it is the honest answer, and the rail is the one
 * thing on these pages a reader can lose without losing content.
 */
export const railFrame = (input: {
  readonly heading: string
  readonly entries: readonly PageComponent[]
}): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: {
      className: `sticky ${CHROME_BAR_OFFSET_CLASS} hidden w-[210px] flex-none self-start xl:block`,
      'data-testid': 'design-system-rail',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'border-border flex flex-col gap-0.5 border-l py-1' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'pb-2 pl-3' },
            children: [microLabel(input.heading)],
          },
          {
            type: 'container',
            element: 'div',
            // `list-none` for the same reason the preview surface carries it: a
            // rail built from a rows binding wraps every entry in an `li`, and a
            // bare `li` still computes `display: list-item`, so the Components
            // rail drew a bullet beside each of its four entries. The authored
            // rails have no `li` at all, so this is inert for them.
            props: { className: 'flex list-none flex-col' },
            children: [...input.entries],
          },
        ],
      },
    ],
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'hidden', 'data-island': 'design-system-rail' },
    children: [],
  } as PageComponent,
]

/**
 * The class every rail entry is set in, whether it was authored or bound.
 *
 * ─── THE CURRENT ENTRY ANSWERS A HOVER TOO, AND IT NEEDS ITS OWN ANSWER ────
 *
 * Every other entry answers with ink: `text-foreground-subtle` darkening to
 * `text-foreground`. The entry the reader is ON is ALREADY `text-foreground`,
 * so that same rule resolves to the colour it is already wearing and the hover
 * is a no-op by construction — one entry in the rail that does not react, and
 * the one the pointer is most often over.
 *
 * So the band is what every entry answers with, and the ink change rides on top
 * for the entries that have somewhere to go. `hover:bg-background-subtle` is
 * not a new affordance: it is what the kit's own navigation column already uses
 * (`kit-nav.ts`), so the two navigations of one console now react alike.
 */
export const RAIL_ENTRY_CLASS =
  'text-foreground-subtle hover:text-foreground hover:bg-background-subtle transition-colors border-l-2 border-transparent py-[3px] pl-3 text-sm aria-[current]:border-foreground aria-[current]:text-foreground aria-[current]:font-medium'

/** One rail entry for a section this page declared by hand. */
export const railEntry = (section: RailSection): PageComponent =>
  ({
    type: 'link',
    props: {
      href: `#${section.id}`,
      className: RAIL_ENTRY_CLASS,
      'data-design-rail-entry': section.id,
      ...kitType('link'),
    },
    content: section.title,
  }) as PageComponent

/** The rail for a page whose sections are known when the page is written. */
export const railPanel = (sections: readonly RailSection[]): readonly PageComponent[] =>
  railFrame({ heading: 'On this page', entries: sections.map((section) => railEntry(section)) })

/**
 * The room the LAST section needs before its rail entry can be the one being
 * read — and not one pixel more.
 *
 * The scroll-spy marks the last section whose top has passed a reading line
 * 120px below the top of the scrolling column
 * (`islands/admin/design-system-rail-island.tsx`). A short last section can
 * never get its top up there: at the bottom of the scroll it sits wherever its
 * own height leaves it, so the entry beside it is unreachable and the rail
 * silently stops one short.
 *
 * What used to buy that room was a 75vh block after the footer — 675px of dead
 * scroll on a 900px viewport, on every railed page, whether or not the page
 * needed any. It needed none on a page whose last section is already taller
 * than the viewport, and it was over half the scrollable height of the
 * Components page.
 *
 * So the room goes ON the last section as a floor rather than AFTER it as a
 * block: `min-height` is what the section is short OF, so a tall one is
 * untouched and a short one grows exactly enough. The sections are transparent
 * layout boxes, so a floor on one is invisible — which is the reason this is a
 * class on the section and not on the card a page happens to end with.
 *
 * `120px`, not a token: it is the island's reading line, and the two numbers
 * are one decision. Change either and change both.
 *
 * `xl:`, matching the rail's own breakpoint. Below 1280 there is no rail to
 * keep in step with, so the room would be dead scroll bought for nobody — which
 * is what the 75vh spacer did at every width, phones included.
 */
const TAIL_ROOM_CLASS = 'xl:min-h-[calc(100vh-120px)]'

/**
 * Give a page its tail room, on its LAST CHILD rather than on its last anchored
 * section.
 *
 * Those are the same element on most pages, and where they are not the
 * difference is the whole point: Foundations closes with a short disclosure
 * AFTER its last section, so a floor on the section renders as a visible hole
 * between two blocks of content. Reserved room has to sit at the END of a page,
 * where it reads as the page being over rather than as something failing to
 * load.
 *
 * The invariant survives the move. The last section needs the distance from its
 * own top to the bottom of the document to be at least a viewport less the
 * reading line; flooring the last CHILD guarantees at least that much below the
 * last section — exactly that on a page whose last section is its last child,
 * and more on a page with a tail. Over-reserving is the honest failure here: it
 * is invisible, and under-reserving silently costs the last rail entry.
 */
export const withTailRoom = (children: readonly PageComponent[]): readonly PageComponent[] => {
  const propsOf = (child: PageComponent): Readonly<Record<string, unknown>> =>
    (child as { readonly props?: Record<string, unknown> }).props ?? {}
  const hasSection = children.some((child) => propsOf(child)['data-design-section'] !== undefined)
  const last = hasSection ? children.length - 1 : -1
  if (last < 0) return children
  return children.map((child, index) => {
    if (index !== last) return child
    const props = propsOf(child)
    const className = typeof props['className'] === 'string' ? props['className'] : ''
    return {
      ...child,
      props: { ...props, className: `${className} ${TAIL_ROOM_CLASS}`.trim() },
    } as PageComponent
  })
}

/**
 * The whole body of a railed console page: the heading, the scoped surface the
 * operator's own design paints inside, and the rail beside it.
 *
 * ONE scope, wrapping every specimen on the page. It is the boundary
 * that separates a control this console DREW as documentation from a control
 * the console offers, and every edit-affordance sweep in the section counts
 * text entry OUTSIDE it.
 *
 * `preview-surface` carries `bg-background text-foreground` as UTILITY classes
 * rather than `var(--sv-*)` reads, which is what makes it prove the operator's
 * palette is actually USED here: a wrapper re-declaring only the `--sv-*` names
 * reads back perfectly on every variable probe and paints every utility stale.
 *
 * ─── AND `list-none`, WHICH IS NOT COSMETIC ────────────────────────────────
 *
 * A rows binding wraps every row in an `li`, and a bare `li` outside a `ul`
 * still computes `display: list-item` — so it draws a marker disc in the gutter
 * beside whatever the row template drew. Measured across the console before
 * this class was added: 165 rows drew one, on five of the six pages (75 of them
 * on a single type page). The canvas draws a marker on none of its 136 boards.
 *
 * It goes HERE, once, rather than on each row container, because
 * `list-style-type` INHERITS: one declaration on the surface clears every row
 * below it, including the ones a page adds later. The kit index reached the
 * same conclusion one level down and says so beside its grid.
 *
 * ─── THE HEAD IS A TITLE AND NOTHING ELSE ──────────────────────────────────
 *
 * There is no deck under the `h1`. The canvas's page head carries a title and
 * the page's own facts, never a sentence restating the title — and every deck
 * this console carried did restate it: "Foundations" was decked "Seven
 * properties, each shown by the components it moves", which is what the seven
 * section headings below it already say, in the same order.
 *
 * The `h1` stays, and it stays exact. It is this page's oracle — the one string
 * a spec can address to prove the route resolved to the page it asked for — so
 * the title is load-bearing in a way the deck never was.
 */
export const railedConsoleBody = (input: {
  readonly title: string
  readonly sections: readonly RailSection[]
  readonly children: readonly PageComponent[]
}): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', ...kitType('container') },
    children: [
      {
        type: 'text',
        element: 'h1',
        props: { className: 'text-3xl font-semibold tracking-tight', ...kitType('text') },
        content: input.title,
      },
    ],
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-row items-start gap-8' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-1 flex-col gap-6' },
        children: [
          {
            type: 'card',
            variant: 'scoped',
            props: { ...kitType('card') },
            children: [
              {
                type: 'container',
                element: 'div',
                props: {
                  className: 'bg-background text-foreground flex list-none flex-col gap-8 p-6',
                  'data-testid': 'preview-surface',
                },
                children: [...withTailRoom(input.children)],
              },
            ],
          },
        ],
      },
      ...railPanel(input.sections),
    ],
  } as PageComponent,
]

// ---------------------------------------------------------------------------
// Option showcases
// ---------------------------------------------------------------------------

/**
 * One drawing in its own frame.
 *
 * Centred, generously padded, bordered: the example panel a component library
 * puts one rendering in. The drawing is given the width of the column rather
 * than a thumbnail's, which is the whole difference between a page that shows a
 * component and one that shows a grid of stamps.
 *
 * ─── WHY THE FRAME CARRIES A TYPE STEP ─────────────────────────────────────
 *
 * `text-base` is the console's own body step (13px), and it sits here rather
 * than on each drawing because font-size INHERITS. A component that rules its
 * own step keeps it; one that rules none — an authored `text` span, a `swatch`
 * label, a renderer that paints no typography class — otherwise falls through
 * to the document root at 16px and draws BIGGER than the page around it. That
 * is the "lead" the 2026-09-16 review reported: not a step anybody chose, an
 * inheritance gap. One class on the frame every drawing sits in closes it for
 * the whole catalogue.
 */
export const previewCard = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border flex flex-wrap items-start justify-center gap-4 rounded-lg border px-6 py-10 text-base',
      'data-design-preview-card': 'true',
    },
    children: [...children],
  }) as PageComponent

/**
 * One value of one option: the config line, the drawing, and what it costs.
 *
 * The label is MONO and is the line an author would write, not a prose name for
 * it — `rowHeight: short`, `legend: none`. A reader scanning this page is
 * looking for the key, and a paraphrase of the key is one more thing to
 * translate back.
 */
export const drawingBlock = (input: {
  readonly label: string
  readonly children: readonly PageComponent[]
  /**
   * The catalogued type this drawing is OF, which marks it as a SPECIMEN.
   *
   * [internal ref] A2 forbids config-editing affordances, not `<input>` elements, and
   * the sweeps that enforce it separate a control this console DREW from one it
   * offers by asking which specimen wrapper the control sits in. An option
   * showcase draws the same real components the variant sections do — a
   * `comments` composer is a textarea, a `select` showcase is a select — so a
   * drawing that carried no wrapper read as an edit affordance loose in the
   * page chrome. It is the same marker, on the same kind of drawing.
   */
  readonly specimenType?: string
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-design-option': input.label },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-baseline gap-x-2' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground font-mono text-[11px]' },
            content: input.label,
          },
          // The drawing's `note` is deliberately NOT drawn. The mono label
          // beside it already says which config line this drawing is OF, and
          // that line is what an author writes; a sentence saying what the
          // value does is documentation, and the drawing under it is the
          // demonstration this console exists to give.
        ],
      } as PageComponent,
      // A BLOCK wrapper, and the block is the load-bearing half.
      //
      // The preview frame is a centring flex row, so a drawing that declares
      // `w-full` inside it is a flex ITEM sizing to its content: a chart laid
      // out 26px wide with no canvas to draw on, mounted, ready, and blank.
      // Measured on this page. A flex wrapper reproduces it one level down —
      // the fix is a plain block, which is what the variant sections already
      // wrap their drawings in.
      previewCard([
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'w-full',
            ...(input.specimenType === undefined
              ? {}
              : { 'data-design-specimen': input.specimenType }),
          },
          children: [...input.children],
        } as PageComponent,
      ]),
    ],
  }) as PageComponent

/** The anchor one option showcase answers to, on one type's page. */
export const optionAnchor = (type: string, id: string): string =>
  `design-system-option-${type}-${id}`

/**
 * One option showcase: heading, mono key, optional line, then a block per value.
 *
 * Emits BOTH rail markers, so the entry beside it cannot name a section that is
 * not here. The rail is built from the same array — see `optionRailEntry` — and
 * that is the only defence a page with a hundred-odd sections has against its
 * own table of contents drifting from it.
 */
export const optionShowcase = (input: {
  readonly type: string
  readonly id: string
  readonly title: string
  readonly configKey: string
  readonly drawings: readonly PageComponent[]
}): PageComponent => {
  const anchor = optionAnchor(input.type, input.id)
  return {
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-4',
      id: anchor,
      'data-design-section': anchor,
      'data-design-option-section': input.id,
    },
    children: [
      sectionHeading(input.title),
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle font-mono text-[11px]' },
        content: input.configKey,
      } as PageComponent,
      // The option's `note` is deliberately NOT drawn — same reason as the
      // variant sections on `type-page.ts`. The heading names the option, the
      // mono line names the config key that sets it, and the drawings show
      // what each value does. A sentence explaining the option in prose is
      // documentation, and it lives in the published docs.
      ...input.drawings,
    ],
  } as PageComponent
}

/** The rail entry for one showcase, built from the same object as the section. */
export const optionRailEntry = (input: {
  readonly type: string
  readonly id: string
  readonly title: string
}): PageComponent =>
  ({
    type: 'link',
    props: {
      href: `#${optionAnchor(input.type, input.id)}`,
      className: RAIL_ENTRY_CLASS,
      'data-design-rail-entry': optionAnchor(input.type, input.id),
      ...kitType('link'),
    },
    visibility: { record: { field: 'type', eq: input.type } },
    content: input.title,
  }) as PageComponent
