/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The operator's OWN reusable templates, each drawn on its own.
//
// A shared header exists in the config exactly once and appears in the product
// only ever embedded inside a page, so reviewing it means finding a page that
// happens to use it and reading around everything else on that page. Here it is
// rendered by the same renderer, under the same theme, and nothing else.
//
// ─── THE ONE THING THIS PAGE CANNOT SUPPLY ITSELF ──────────────────────────
//
// `specimen.subject.component` resolves a name against the RENDERING app's
// `components`, and under a mount that is the console's, which declares none. So
// the mount merges the operator's templates — and their ENGLISH string table
// with them, because a real template takes its text from `$t:` lookups and an
// unresolved lookup prints its own key as body text. Both merges are scoped to
// this surface's two paths in `mount/embedded-app-mount.ts`, which is the one
// place that holds both apps.
//
// ─── TWO PAGES, AND THE SECOND IS WHAT A QUERY COULD NOT BE ────────────────
//
// A page drawing every template at full height puts the fourth below three
// screenfuls of the first three, and a site footer's own specimen is taller than
// the viewport. So a heavy template collapses to one row and offers a way in —
// and the way in is an ADDRESS rather than a toggle, because this console
// navigates rather than holding state a reader cannot bookmark.
//
// That address is a SUB-ROUTE and not `?expand=<name>`. `page.query` clamps a
// value to a declared `enum` by design — it is what keeps attacker-controlled
// text out of every substitution site — and a component NAME is open-valued, so
// there is no enum to write. `page.params` is the mechanism for an open segment
// whose domain is a read endpoint: the same declaration that admits the name
// also refuses one the operator does not declare, with a 404 rather than an
// empty card.

import { withShell } from '../../components/shell'
import { DESIGN_GUIDANCE_ENDPOINT, DESIGN_USAGE_ENDPOINT } from '../../system-sources'
import { SCHEME_DEEP_LINK_SCRIPT, designSystemBreadcrumb } from './chrome'
import { NAV_ROW_CLASS, NAV_ROW_CURRENT_CLASS, docsNavOverviewRow } from './kit-nav'
import { MEASURE_XS, caption, kitType, microLabel, sectionHeading } from './sections'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** This page's own slug and the noun it carries in the trail and the `h1`. */
const SLUG = 'components'
const TITLE = 'Components'

/** The kit types this index is built from, each stamped on a real instance. */
// `specimen` and `button` are drawn on this page — inside a card — and are
// deliberately NOT claimed: a page may only claim a type it ALWAYS draws, and
// both arrive with a row. On an app declaring no reusable component this page
// draws neither, so naming them would be a line a reader cannot check against
// the page in front of them. Under-claiming is the honest failure of the two.

/** The rows every card index reads: the operator's templates, with their usage. */
const COMPONENT_ROWS = {
  system: {
    endpoint: DESIGN_USAGE_ENDPOINT,
    rowsKey: 'items',
    idKey: 'name',
    query: { subject: 'component' },
  },
} as const

/**
 * The section's own navigation column, beside its content on BOTH its pages.
 *
 * ─── WHY COMPONENTS GETS ONE, AND WHAT IT IS NOT ──────────────────────────
 *
 * Same shape as the UI kit's column and the same row vocabulary, because a
 * reader crossing from one section to the next is still in one console. The kit
 * indexes a catalogue the engine ships, so its column is authored; this one
 * indexes the templates the OPERATOR declared, so it is bound to the same rows
 * the cards and the rail read. A column that could list a component this app
 * does not declare would be the drift this console exists to remove.
 *
 * It is NOT the rail. The rail is an anchor index over ONE page — it moves the
 * reader to a card already on screen — and it exists only on the index. This
 * column lists ROUTES, and it is present on the detail page too, which is the
 * half of the tree the rail cannot reach.
 *
 * ─── THE CURRENT MARK IS A ROW GATE, NOT `activeWhen` ─────────────────────
 *
 * `activeWhen`/`activeProps` cannot do it: they compare LITERALS, and the pass
 * that spends them runs inside `page-collection-resolver`, BEFORE the system
 * rows expand. A row template's `$record.name` is still the literal token at
 * that moment whichever side of the comparison holds it, so the mark could
 * never hold.
 *
 * `visibility.record` runs at the other end — as each row expands — and by then
 * `$param.name` HAS been substituted, because the route-param pass walks every
 * string leaf of the page and reaches a predicate's `eq` like any other. So on
 * the DETAIL page the template carries the row twice, gated `eq` and `neq`
 * against the segment, and exactly one of the two survives.
 *
 * Only on the detail page. The index declares no `:name` segment and the
 * validator refuses a page that names a param its own path does not carry —
 * rightly, since a reference nothing can fill is a silent blank, not a default.
 * So the index draws one plain row and marks nothing, which is what an index
 * should do anyway: it is not inside any of them.
 *
 * `Overview` is marked from a build-time flag instead, exactly as the kit's
 * column marks its own root: it is authored rather than fetched, so there is no
 * record to gate it on, and each page knows at authoring time whether it IS the
 * index.
 */
const componentNavColumn = (input: { readonly onIndex: boolean }): readonly PageComponent[] => [
  docsNavOverviewRow({
    label: 'Overview',
    href: `/design-system/${SLUG}`,
    current: input.onIndex,
  }),
  {
    type: 'container',
    element: 'div',
    // `contents`, so each expanded row sits in the column's own flow rather
    // than inside a second box — the shape the rail next door already proves.
    props: { className: 'contents' },
    dataSource: COMPONENT_ROWS,
    children: input.onIndex
      ? [
          {
            type: 'link',
            props: {
              href: `/design-system/${SLUG}/$record.name`,
              className: NAV_ROW_CLASS,
              'data-testid': 'design-system-component-nav-$record.name',
              ...kitType('link'),
            },
            content: '$record.name',
          },
        ]
      : [
          {
            type: 'link',
            props: {
              href: `/design-system/${SLUG}/$record.name`,
              className: NAV_ROW_CURRENT_CLASS,
              'data-testid': 'design-system-component-nav-$record.name',
              'aria-current': 'page',
              ...kitType('link'),
            },
            visibility: { record: { field: 'name', eq: '$param.name' } },
            content: '$record.name',
          },
          {
            type: 'link',
            props: {
              href: `/design-system/${SLUG}/$record.name`,
              className: NAV_ROW_CLASS,
              'data-testid': 'design-system-component-nav-$record.name',
              ...kitType('link'),
            },
            visibility: { record: { field: 'name', neq: '$param.name' } },
            content: '$record.name',
          },
        ],
  } as PageComponent,
]

/**
 * The header strip over a card: its name, its usage, and its copy control.
 *
 * ─── THE COPY PAYLOAD IS `sr-only`, NEVER `display:none` ───────────────────
 *
 * The platform's delegated copy handler reads the scope's first
 * `[data-copy-target]`, and a node hidden with `display:none` has no text to
 * copy at all. `aria-hidden` on top, because a screen-reader user reading this
 * card wants the component rather than a serialised config object — the
 * button's own label is what announces the affordance.
 *
 * The payload is the endpoint's published `snippet`: the operator's own
 * declaration, serialised by the same walker the type page's config block
 * spends. A card carrying its config in full would be mostly JSON, which is why
 * it is offered rather than printed.
 */
const cardHeader = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-2.5',
      'data-code-copy-scope': 'true',
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground font-mono text-sm font-medium' },
        content: '$record.name',
      },
      // Two nodes, because a page has no arithmetic and no string operations:
      // `1 page` and `3 pages` differ by a letter nothing here can add, and
      // "embedded by no page" is a different sentence rather than a zero.
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        visibility: { record: { field: 'count', eq: 0 } },
        content: 'Declared, and embedded by no page yet.',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        visibility: { record: { field: 'count', eq: 1 } },
        content: 'Used on $record.count page.',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        visibility: { record: { field: 'count', gt: 1 } },
        content: 'Used on $record.count pages.',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'sr-only', 'data-copy-target': 'true', 'aria-hidden': 'true' },
        content: '$record.snippet',
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'ml-auto flex items-baseline gap-3' },
        children: [
          {
            type: 'button',
            variant: 'link',
            props: {
              type: 'button',
              className:
                'text-foreground-subtle hover:text-foreground font-mono text-[11px] leading-none',
              'data-copy-code': 'true',
              'data-copied-label': 'Copied',
              'aria-label': 'Copy this component’s config',
              ...kitType('button'),
            },
            content: 'Copy config',
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The routes this template reaches, as chips.
 *
 * A NESTED rows binding, which is what the depth-2 expansion primitive exists
 * for: `routeRows` is published flat at the top of the response precisely
 * because a bare `string[]` is unbindable, and a card must show its OWN routes.
 * The inner read is narrowed by `$record.name` from the outer row, so N cards
 * are N different reads rather than one list every card repeats.
 *
 * The inner row wrapper is a `div` and NOT an `li`, and that is the HTML parser
 * rather than taste: an `<li>` start tag closes any open `<li>` in list-item
 * scope, so an inner `li` would close the outer row's wrapper and the browser
 * would re-parent every route chip as a SIBLING of its card.
 */
const routeChips = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-wrap gap-1.5 px-4 pt-3' },
    dataSource: {
      system: {
        endpoint: DESIGN_USAGE_ENDPOINT,
        rowsKey: 'routeRows',
        query: { subject: 'component', name: '$record.name' },
      },
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: {
              className:
                'border-border bg-background-subtle text-foreground-muted rounded border px-1.5 py-0.5 font-mono text-[11px]',
              'data-design-usage-route': '$record.route',
            },
            content: '$record.route',
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * One register of the guidance an author acts on.
 *
 * Three separate reads rather than three fields on the usage row, because the
 * guidance endpoint is where every declared sentence already lives — split into
 * the instruction a reader obeys and the reason the same line gave for it. A
 * second copy on the usage row would be two publishers of one sentence.
 *
 * The registers are kept APART rather than run together into a paragraph: the
 * sentence a reader most needs to obey is the prohibition, and joining them
 * would deliver it as the tail of a sentence that opened by explaining what the
 * component is good for. `dont` takes the error ink for the same reason.
 */
const guidanceRegister = (kind: string, label: string, ink: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1' },
    dataSource: {
      system: {
        endpoint: DESIGN_GUIDANCE_ENDPOINT,
        rowsKey: 'items',
        query: { kind, label: '$record.name' },
      },
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-1' },
        children: [
          microLabel(label),
          {
            type: 'text',
            element: 'p',
            props: { className: `${ink} text-md leading-relaxed` },
            content: '$record.instruction',
          },
          // BOTH registers, and the trailing one only when the line carried it.
          // A declared rule written as an instruction followed by its rationale
          // reads complete with the instruction alone while having lost its
          // scope, which is the failure this second node exists to prevent.
          {
            type: 'text',
            element: 'p',
            props: {
              className: `text-foreground-subtle ${MEASURE_XS} text-[11px] leading-relaxed`,
            },
            content: '$record.reason',
          },
        ],
      },
    ],
  }) as PageComponent

/** The three registers under one rule. */
const guidanceStrip = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-3 border-t px-4 py-3' },
    children: [
      guidanceRegister('component.usage', 'Usage', 'text-foreground'),
      guidanceRegister('component.when', 'When', 'text-foreground'),
      guidanceRegister('component.dont', 'Don’t', 'text-error-fg'),
    ],
  }) as PageComponent

/**
 * One viewport, drawn and headed — the detail page's grammar.
 *
 * The index used a `?viewport=` switcher and the detail page inherited it. A
 * switcher shows one width and hides two, and the question a reader opens a
 * template page with is what it does BETWEEN them: which crumb drops at 768,
 * which control leaves at 375. So all three are drawn, stacked, each headed
 * with the width it is.
 *
 * `overflow-x-auto`, so a frame SCROLLS rather than clipping. A clipped
 * specimen shows the top-left corner of a component and calls it the component.
 *
 * The frame is pinned LEFT rather than centred. Three widths centred inside one
 * column start at three different x positions, so the reader compares them by
 * eye against three different origins — which is the one thing a stack of
 * widths exists to make easy. Sharing an edge is what makes the difference
 * between them readable.
 *
 * ─── THE NUMBER IN THE HEADING IS NOW THE DOCUMENT'S OWN WIDTH ────────────
 *
 * `viewport` re-renders the subject in a document of its own at the stated
 * width, so the subject's `@media` rules answer THAT width. Before it, the
 * three frames were three boxes in one 1440px document: a header declaring
 * `lg:flex` drew its desktop cluster in all three and overflowed the 375 box
 * sideways, which reads as proof the operator's responsive design is broken.
 *
 * Desktop is 1280 EXPLICITLY, not the column it happens to get. The column is
 * ~854px, below Tailwind's `lg`, so a Desktop frame taking its width from the
 * layout would draw the mobile layout under a heading that says 1280 — the
 * same lie the frames were built to remove, one level in.
 *
 * The wrapper keeps the width too, clamped to the column: at 1280 it scrolls
 * to reach the rest of the document rather than shrinking it, because `-240`
 * is the promise that the number in the heading is the number in the frame.
 */
const stackedFrame = (label: string, width: number): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-3',
      id: `viewport-${label.toLowerCase()}`,
      'data-design-section': `viewport-${label.toLowerCase()}`,
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-baseline gap-3' },
        children: [
          sectionHeading(label),
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-muted font-mono text-[11px]' },
            content: String(width),
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'border-border bg-background rounded-lg border p-5' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'overflow-x-auto',
              'data-design-viewport-frame': label.toLowerCase(),
              style: { width: `${width}px`, maxWidth: '100%' },
            },
            children: [
              {
                type: 'specimen',
                subject: { component: '$record.name' },
                viewport: { width },
                props: { ...kitType('specimen') },
              },
            ],
          },
        ],
      },
    ],
  }) as PageComponent

/** One template, in full: header, routes, the three widths, the guidance. */
const detailBody = (): PageComponent =>
  ({
    type: 'container',
    element: 'article',
    props: { ...cardRootProps, className: 'flex flex-col gap-8' },
    children: [
      cardHeader(),
      routeChips(),
      stackedFrame('Desktop', 1280),
      stackedFrame('Tablet', 768),
      stackedFrame('Mobile', 375),
      guidanceStrip(),
    ],
  }) as PageComponent

/** The props every card root carries, drawn or collapsed. */
const cardRootProps = {
  'data-design-component': '$record.name',
  // Addressable from a deep link, and reported back as the card being read. One
  // marker, both directions — the rail beside this page scrolls to it, and an
  // anchor into a card is what a shared address uses.
  id: 'design-system-app-component-$record.name',
  'data-design-section': 'design-system-app-component-$record.name',
} as const

// ─── THE CARDS ARE BOUND, AND THAT IS THE WHOLE CORRECTNESS ARGUMENT ───────
//
// This index once drew four templates from a hard-coded list of NAMES —
// Sovrium's own console chrome, composed into a records page. It read well on
// the standalone preview, where the console IS the app being documented, and it
// was wrong everywhere else: mounted at `/_admin` on a host, the page drew four
// templates the operator does not declare and linked each one to a sub-route
// whose domain is the HOST's components. Four links, four 404s, on every host,
// by construction — and a page claiming another app's chrome as "the templates
// this app declares".
//
// So the cards read the same rows the rail reads and the sub-route's `:name`
// domain is drawn from: `DESIGN_USAGE_ENDPOINT`, `subject: component`, which
// resolves the OPERATOR app under a mount. One source, three consumers. A card
// cannot name a template the route would refuse, because the set that admits
// the name is the set that drew it.

/**
 * The three widths, and `undefined` for Desktop is the point rather than a gap.
 *
 * The default must be the column's natural width, or every reader who never
 * touches the chips gets a 1280px box scrolling inside a narrower console. The
 * label still names 1280 because that is the width the chip DESCRIBES.
 */
const VIEWPORTS: readonly (readonly [label: string, value: string, width: string | undefined])[] = [
  ['Desktop', '1280', undefined],
  ['Tablet', '768', '768px'],
  ['Mobile', '375', '375px'],
]

const VIEWPORT_VALUES = VIEWPORTS.map(([, value]) => value)

/** The `?viewport=` declaration the index carries. */
const VIEWPORT_QUERY = {
  viewport: { default: '1280', enum: VIEWPORT_VALUES, onUnknown: '1280' },
} as const

/** The `?viewport=` chips, and the disclosure that keeps them honest. */
const viewportChips = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-wrap items-center gap-3' },
    children: [
      microLabel('Viewport'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-center gap-3', 'data-testid': 'design-system-viewport' },
        // Two nodes per chip rather than one, because a page has no conditional
        // and "the chip in force" is a different element from "a chip you may
        // follow": the first carries `aria-current` and the second an `href`. A
        // set of links that never reflects which one is active is a filter with
        // no state.
        children: VIEWPORTS.flatMap(([label, value]) => [
          {
            type: 'link' as const,
            props: {
              href: `/design-system/${SLUG}?viewport=${value}`,
              className: 'text-foreground text-sm font-medium',
              'aria-current': 'true',
            },
            visibility: { query: { name: 'viewport', eq: value } },
            content: `${label} · ${value}`,
          },
          {
            type: 'link' as const,
            props: {
              href: `/design-system/${SLUG}?viewport=${value}`,
              className: 'text-foreground-subtle hover:text-foreground text-sm',
              ...kitType('link'),
            },
            visibility: { query: { name: 'viewport', neq: value } },
            content: `${label} · ${value}`,
          },
        ]),
      },
    ],
  } as PageComponent,
  // ─── THE DISCLOSURE IS NOT DECORATION ────────────────────────────────────
  //
  // A chip labelled `Mobile · 375` promises a mobile RENDERING, and a
  // server-side width constraint cannot deliver one: Tailwind's responsive
  // variants are MEDIA queries, so they answer the browser viewport rather than
  // the box a component is drawn in. A real `site-header` carrying `lg:flex`
  // keeps its DESKTOP layout inside a 375px frame on a 1280px browser and
  // scrolls sideways. Undisclosed, an operator reads that squeeze as proof their
  // responsive design is broken — the well-formed, confident and wrong class
  // this console exists to remove.
  {
    type: 'text',
    element: 'p',
    props: {
      className: `text-foreground-subtle ${MEASURE_XS} text-[11px] leading-relaxed`,
      'data-testid': 'design-system-viewport-note',
    },
    content:
      'A width, and only a width. Responsive variants answer the browser viewport rather than ' +
      'this frame, so a narrow specimen scrolls sideways instead of collapsing to its mobile ' +
      'layout. Nothing is clipped, and nothing here proves a layout broken.',
  } as PageComponent,
]

/**
 * One width's frame on the index, drawn only when its chip is in force.
 *
 * `overflow-x-auto`, so a frame SCROLLS rather than clipping. A clipped
 * specimen shows the top-left corner of a component and calls it the component.
 *
 * The frame is pinned LEFT rather than centred. Three widths centred inside one
 * column start at three different x positions, so the reader compares them by
 * eye against three different origins — which is the one thing a stack of
 * widths exists to make easy. Sharing an edge is what makes the difference
 * between them readable.
 */
const specimenFrame = (label: string, value: string, width: string | undefined): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'bg-background p-5' },
    visibility: { query: { name: 'viewport', eq: value } },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'overflow-x-auto',
          'data-design-viewport-frame': label.toLowerCase(),
          ...(width === undefined ? {} : { style: { width, maxWidth: '100%' } }),
        },
        children: [
          {
            type: 'specimen',
            subject: { component: '$record.name' },
            props: { ...kitType('specimen') },
          },
        ],
      },
    ],
  }) as PageComponent

/** A short template drawn in full: header, routes, the chosen width, guidance. */
const drawnCard = (): PageComponent =>
  ({
    type: 'container',
    element: 'article',
    props: {
      ...cardRootProps,
      className:
        'border-border bg-background-raised flex flex-col overflow-hidden rounded-lg border',
    },
    visibility: { record: { field: 'heavy', eq: false } },
    children: [
      cardHeader(),
      routeChips(),
      ...VIEWPORTS.map(([label, value, width]) => specimenFrame(label, value, width)),
      guidanceStrip(),
    ],
  }) as PageComponent

/**
 * A tall template drawn as ONE ROW: its name, its usage, and a way in.
 *
 * A page drawing every template at full height puts the fourth below three
 * screenfuls of the first three, and a site footer's own specimen is taller than
 * the viewport. So a heavy template collapses and offers an ADDRESS rather than
 * a toggle — this console navigates rather than holding state a reader cannot
 * bookmark.
 *
 * The link is composed as a literal with the name interpolated. Taking
 * `$record.href` from the row would not survive the mount: the prefixing pass
 * runs BEFORE row expansion, so a literal path is rewritten onto this console's
 * base and a value arriving from a row is not.
 */
const collapsedCard = (): PageComponent =>
  ({
    type: 'container',
    element: 'article',
    props: {
      ...cardRootProps,
      className:
        'border-border bg-background-raised flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-4 py-3',
    },
    visibility: { record: { field: 'heavy', eq: true } },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground font-mono text-sm font-medium' },
        content: '$record.name',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        visibility: { record: { field: 'count', eq: 0 } },
        content: 'Declared, and embedded by no page yet.',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        visibility: { record: { field: 'count', eq: 1 } },
        content: 'Used on $record.count page.',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        visibility: { record: { field: 'count', gt: 1 } },
        content: 'Used on $record.count pages.',
      },
      {
        type: 'link',
        props: {
          href: `/design-system/${SLUG}/$record.name`,
          className: 'text-foreground hover:text-foreground-muted ml-auto text-[11px] font-medium',
        },
        content: 'Expand →',
      },
    ],
  }) as PageComponent

/**
 * The honest empty state: an app declaring no reusable component at all.
 *
 * That is the COMMON case — the console's own surface app is one — so this is
 * the page most readers see, not an edge. Without it they get a heading, a
 * viewport switcher and a blank panel, which reads as a page that failed to
 * render rather than a page with nothing to show.
 *
 * ─── IT LIVES IN THE READING COLUMN, AND THAT IS THE WHOLE FIX ─────────────
 *
 * It was authored as the page's LAST top-level node, after the flex row that
 * holds the content column, the footer and a 75vh rail spacer. Measured at
 * 1280x900 it therefore rendered 758px below the `Built from` footer, past a
 * 675px void, on a page whose document height was the viewport's — so the
 * sentence was in the HTML, was not hidden, and was still unreachable. An empty
 * state a reader cannot reach is the state it was written to prevent.
 *
 * `visibility.record` reads the PAGE's own record — `total` off the usage
 * envelope — because no rows binding can answer "were there any rows": zero
 * rows render zero rows and leave nothing for a row gate to test.
 */
const emptyState = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    visibility: { record: { field: 'total', eq: 0 } },
    children: [
      sectionHeading('No reusable components'),
      caption(
        'This app declares no reusable components. Declare one under the components key of ' +
          'your config and embed it by name from a page; it appears here, on its own, the ' +
          'moment you do.'
      ),
    ],
  }) as PageComponent

/**
 * The console's own scope and painted surface, wrapping every specimen.
 *
 * The scope qualifier is load-bearing rather than decorative: this page draws
 * the OPERATOR's own components, so one rendered outside it would be a real
 * component drawn in Sovrium's palette — a picture of something the operator
 * will never see. It looks correct and documents the wrong app.
 */
const scoped = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'card',
    variant: 'scoped',
    props: { ...kitType('card') },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'bg-background text-foreground flex list-none flex-col gap-6 p-6',
          'data-testid': 'preview-surface',
          ...kitType('container'),
        },
        children: [...children],
      },
    ],
  }) as PageComponent

/**
 * The page heading, shared by the index and the sub-route.
 *
 * A title and nothing under it. The deck that used to sit here restated the
 * `meta.description` word for word, on a page whose first card already shows
 * what a reusable template is.
 */
const heading = (title: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'h1',
        props: { className: 'text-3xl font-semibold tracking-tight', ...kitType('text') },
        content: title,
      },
    ],
  }) as PageComponent

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

const componentsIndex: PageConfig = withShell(
  {
    id: 'design-system-components',
    name: 'design-system-components',
    path: `/design-system/${SLUG}`,
    meta: {
      lang: 'en-US',
      title: TITLE,
      description: 'Every reusable template this app declares, drawn on its own.',
    },
    query: VIEWPORT_QUERY,
    // The ONE gate no rows binding can answer: whether this app declares any
    // reusable component at all. `visibility.record` has no length operator and
    // no presence operator, so zero rows render zero rows and there is nothing
    // left for a row gate to test. The envelope's own `total` answers it.
    dataSource: {
      system: {
        endpoint: DESIGN_USAGE_ENDPOINT,
        query: { subject: 'component' },
        idKey: 'total',
      },
    },
    components: [
      heading(TITLE),
      ...viewportChips(),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-1 flex-col gap-6' },
        children: [
          scoped([
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-4' },
              dataSource: COMPONENT_ROWS,
              children: [drawnCard(), collapsedCard()],
            } as PageComponent,
          ]),
          emptyState(),
        ],
      } as PageComponent,
    ],
  },
  {
    breadcrumb: designSystemBreadcrumb(SLUG, TITLE),
    navColumn: componentNavColumn({ onIndex: true }),
  }
)

// ---------------------------------------------------------------------------
// The sub-route: one component, always drawn
// ---------------------------------------------------------------------------

const componentDetail: PageConfig = withShell(
  {
    id: 'design-system-component-detail',
    name: 'design-system-component-detail',
    path: `/design-system/${SLUG}/:name`,
    meta: {
      lang: 'en-US',
      title: 'Component',
      description: 'One reusable template of this app, drawn on its own.',
    },
    // ─── THE DEEP LINK HAS TO REACH THE HOST BEFORE IT REACHES THE FRAMES ──
    //
    // The three viewport frames below are documents of their own, and each one
    // resolves its scheme by reading the RESOLVED answer off the hosting
    // document rather than re-deriving it. That is the right way round — one
    // resolution, read twice, so the two cannot disagree — but it means a page
    // that does not honour `?scheme=` itself hands every frame a light answer
    // while the sender was reading dark.
    //
    // The shared no-FOUC script only reads storage, so without this a link
    // someone was SENT arrives in the recipient's own scheme instead. A page
    // whose content differs from what its address asked for is the defect
    // `[internal ref]` names; three framed documents differing from
    // the chrome around them is that defect drawn three more times.
    scripts: { inlineScripts: [{ code: SCHEME_DEEP_LINK_SCRIPT, position: 'head' }] },
    // The route's own domain: the names this app actually declares. A segment
    // outside the set answers 404 rather than drawing an empty card, which is
    // the difference between "you have no such component" and "the console
    // failed to render one".
    params: {
      name: {
        system: {
          endpoint: DESIGN_USAGE_ENDPOINT,
          rowsKey: 'items',
          query: { subject: 'component' },
        },
        valueKey: 'name',
      },
    },
    components: [
      // The COMPONENT, not the noun. The page printed `Component` over a card
      // saying `site-header`, a breadcrumb saying `site-header` and three
      // frames drawing it — one heading doing no work, on the one surface whose
      // whole job is to show a reader WHICH component they are looking at.
      // `:name` is the route's own segment and every card below is already
      // narrowed by it, so the title can say it too.
      heading('$param.name'),
      {
        type: 'link',
        props: {
          href: `/design-system/${SLUG}`,
          className: 'text-foreground-subtle hover:text-foreground text-[11px] font-medium',
        },
        content: '← All components',
      } as PageComponent,
      scoped([
        // A ONE-ROW envelope, narrowed by the segment. There is no gate here:
        // a reader who followed the way in asked for this template drawn.
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-4' },
          dataSource: {
            system: {
              endpoint: DESIGN_USAGE_ENDPOINT,
              rowsKey: 'items',
              idKey: 'name',
              query: { subject: 'component', name: '$param.name' },
            },
          },
          children: [detailBody()],
        } as PageComponent,
      ]),
    ],
  },
  {
    breadcrumb: designSystemBreadcrumb(SLUG, TITLE),
    navColumn: componentNavColumn({ onIndex: false }),
  }
)

export { componentDetail }
export default componentsIndex
