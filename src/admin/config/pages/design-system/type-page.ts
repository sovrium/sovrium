/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// One page per catalogued component type — every route the catalogue publishes,
// from one declaration.
//
// The UI kit answers "what types exist". This answers the question an author
// actually arrives with: what may I write into THIS one, and what does each
// thing I could write LOOK like.
//
// ─── ONE RENDERING AT A TIME, AT FULL WIDTH, IN ITS OWN FRAME ──────────────
//
// The page used to draw a label-and-specimen list and then the cross product of
// every variant with every state: 32 cells for `button`, 20 for `alert`, each a
// thumbnail two centimetres wide. A matrix that size is a proof that the axes
// exist rather than a drawing of the component, and nobody reads it.
//
// It is one section per variant now. A heading carrying the variant's own name,
// one bordered card under it, the drawing centred in the card. That is what a
// component library shows a reader, and it is what the rail indexes: the entries
// are the variant NAMES, so the rail is a table of contents for the page rather
// than a list of five fixed nouns that were the same on all eighty-seven pages.
//
// ─── AND A VARIANT IS THE AXIS THE SCHEMA PUBLISHES, NOT A LIST ────────────
//
// The sections are DERIVED, from the same `variants` rows this page already
// binds: the members the schema declares, in the published order, each headed by
// the value an author writes. They were a hand-typed list per type, and the
// lists disagreed with the schema on all six types that have an axis — `button`
// drew four of seven, `image` one of four, and `progress` and `skeleton` headed
// sections with words no union contains, so a reader copying a heading wrote
// config that fails to decode.
//
// Three paths, and exactly one of them renders on any page: the DERIVED sections
// where the schema publishes an axis, the AUTHORED ones for `badge`, which is the
// single declared exception, and a RESTING section for the eighty-two types with
// no axis at all — one section holding however many demonstrations the type has,
// anchored `design-system-type-default` and claiming nothing about the schema.
//
// ─── AND WHY THERE IS NO CONFIGURATION TABLE ───────────────────────────────
//
// There was one, derived from the schema census: a group per top-level key, a
// row per option value, roughly two hundred chips on `table`. It documented the
// SCHEMA. This surface is a showcase of how this app's own design is applied to
// the kit — what the components look like here, in this theme, at this density —
// and a reader who wants to know which words a key accepts is better served by
// the published documentation for that type, where the words sit beside their
// meanings. The schema now feeds this page exactly two things: the variant names
// and the size names.
//
// ─── THE ROUTE'S DOMAIN IS DECLARED, NOT DISCOVERED ────────────────────────
//
// `params.type` names the catalogue as the closed set of segments this page
// serves, so `/ui-kit/nonsense` and `/ui-kit/comment-count` both answer 404
// rather than rendering a page-shaped emptiness. The second is the case worth
// declaring for: gibberish is obviously wrong, whereas a retired name reads
// plausibly and holds nothing — `commentCount` became `comments` with
// `display: count`. An author who writes that name into CONFIG meets the
// migration at the decode seam (`retired-types.ts`); this route owes a reader
// who guesses the URL only a 404.
//
// ─── THE PAGE IS BOUND TWICE, AND BOTH ARE NEEDED ──────────────────────────
//
// As its page RECORD it supplies every scalar the gates read — `variantCount`,
// `sizeCount`, `pageCount`, `siblingCount`, `drawable`, `configured`,
// `styleable` — because `visibility.record` compares a field against a literal
// and has no length operator, so "this type has variants" is only askable of a
// count. As ROWS bindings it supplies the four lists the page draws: the
// variants, the sizes, the routes and the siblings.

import { withShell } from '../../components/shell'
import {
  COMPONENT_TYPES_ENDPOINT,
  COMPONENT_TYPE_DETAIL_ENDPOINT,
  COMPONENT_TYPE_DETAIL_ROWS_ENDPOINT,
} from '../../system-sources'
import { kitNavColumn } from './kit-nav'
import {
  MEASURE_SM,
  kitType,
  RAIL_ENTRY_CLASS,
  railFrame,
  sectionHeading,
  withTailRoom,
  drawingBlock,
  optionRailEntry,
  optionShowcase,
  previewCard,
} from './sections'
import { TYPE_BODIES } from './types/type-bodies'
import type { TypeDrawing } from './types/body-shape'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** A `visibility.record` predicate — one field against one literal. */
type RecordGate = Readonly<Record<string, unknown>>

/** The kit page, which is this page's parent in the trail. */
const KIT_SLUG = 'ui-kit'

/** One rows binding over the detail envelope. */
const detailRows = (rowsKey: string): Readonly<Record<string, unknown>> => ({
  system: { endpoint: COMPONENT_TYPE_DETAIL_ROWS_ENDPOINT, rowsKey },
})

/**
 * The types that author their variant sections although they publish an axis.
 *
 * ONE member, and it is a ruling rather than a convenience. `badge`'s six
 * headings are not values of one axis: `badgeVariant` picks the fill and
 * `variant` picks the mode, and each heading names a point in that product.
 * Every other type with a published axis derives its sections from it, which is
 * what stops a page heading a value the decoder refuses.
 *
 * Read as a `notIn` predicate rather than as an `in` one, so a type that gains
 * an axis tomorrow derives by default and has to be named here to opt out.
 */
const AUTHORED_AXIS_TYPES = ['badge'] as const

/** The kit types this page is built from, each stamped on a real instance. */

// ---------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------

/** The three sections that are not a variant, and are addressed by name. */
const sectionId = (slug: string): string => `design-system-type-${slug}`

/** One anchored section: BOTH markers, its own heading, and its gate. */
const section = (
  slug: string,
  title: string,
  gate: RecordGate | undefined,
  children: readonly PageComponent[]
): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-3',
      id: sectionId(slug),
      'data-design-section': sectionId(slug),
      'data-design-type-section': slug,
    },
    ...(gate === undefined ? {} : { visibility: { record: gate } }),
    children: [sectionHeading(title), ...children],
  }) as PageComponent

// ---------------------------------------------------------------------------
// The heading strip
// ---------------------------------------------------------------------------

/**
 * One figure of the meta line, in the number it is.
 *
 * Two nodes per figure, because a page has no arithmetic: `1 variant` and
 * `4 variants` differ by a letter nothing here can add, and each is gated on its
 * own count so an axis a type does not have is omitted rather than printed as
 * zero.
 */
const factChip = (
  field: string,
  singular: string,
  plural: string,
  lead: string
): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'span',
    visibility: { record: { field, eq: 1 } },
    content: `${lead}$record.${field} ${singular}`,
  } as PageComponent,
  {
    type: 'text',
    element: 'span',
    visibility: { record: { field, gt: 1 } },
    content: `${lead}$record.${field} ${plural}`,
  } as PageComponent,
]

/**
 * The variant figure a type AUTHORED, for the two cases the record cannot give.
 *
 * A type with no published axis draws exactly ONE section — its resting form —
 * whatever the number of demonstrations inside it, so the honest figure is `1`
 * and the record's `variantCount` is `0`. `badge` authors six sections against a
 * published four. Both are spans gated on the type's own name, with the singular
 * or plural already chosen: a page has no arithmetic and cannot add the letter.
 *
 * Every other type takes the figure from the record, beside the sections the
 * same record drew — see {@link derivedVariantFactChips}.
 */
const authoredVariantFactChips = (): readonly PageComponent[] =>
  Object.entries(TYPE_BODIES)
    // A type whose body carries only options or only a size ladder draws no
    // section of its own here, and its figure comes from the record. Emitting a
    // span for it would print a second variant figure beside the derived one.
    .filter(([, body]) => body.variants !== undefined || body.drawings !== undefined)
    .map(([type, body]) => {
      const count = body.variants === undefined ? 1 : body.variants.length
      return {
        type: 'text',
        element: 'span',
        visibility: { record: { field: 'type', eq: type } },
        content: `${count} ${count === 1 ? 'variant' : 'variants'}`,
      } as PageComponent
    })

/**
 * The variant figure a DERIVED page takes from the record that drew it.
 *
 * Gated away from the authored exception by the same predicate its sections
 * carry, so exactly one of the two figures renders on every page. Its own gate
 * is the count, which is `0` on the eighty-two types with no axis — so those
 * fall through to the authored span above rather than printing `0 variants`.
 */
const derivedVariantFactChips = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'contents' },
    visibility: { record: { field: 'type', notIn: [...AUTHORED_AXIS_TYPES] } },
    children: [...factChip('variantCount', 'variant', 'variants', '')],
  } as PageComponent,
]

/**
 * The size figure, authored where the axis is not the schema's.
 *
 * `drawer` writes its width on `drawerSize`, which `sizeCount` never sees, so it
 * authors both its section and its figure. The five types with a real `size`
 * union take theirs from the record.
 */
const authoredSizeFactChips = (): readonly PageComponent[] =>
  Object.entries(TYPE_BODIES)
    .filter(([, body]) => (body.sizes ?? []).length > 0)
    .map(([type, body]) => {
      const count = (body.sizes ?? []).length
      return {
        type: 'text',
        element: 'span',
        visibility: { record: { field: 'type', eq: type } },
        content: ` · ${count} ${count === 1 ? 'size' : 'sizes'}`,
      } as PageComponent
    })

/**
 * The one line on this page that is about the READER rather than the platform.
 *
 * Every other figure here answers identically on two instances of one build.
 * This one says whether their own config restyles the type, and — when it does
 * not — names the key that would. The console is read-only, so the affordance is
 * the address, not a control.
 *
 * Gated on a CAPABILITY and not on a name: a type the engine draws no element
 * for has no `design.components` key at all, so a chip naming one would send a
 * reader to write config the schema refuses.
 */
const configuredChip = (label: string, configured: boolean): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: {
      className:
        'border-border text-foreground-subtle rounded-full border px-2 py-0.5 font-mono text-[11px]',
      'data-testid': 'design-system-type-configured',
      title: 'design.components.$param.type',
    },
    visibility: { record: { field: 'configured', eq: configured } },
    content: label,
  }) as PageComponent

/**
 * The heading strip: the type, its category, whether it is restyled, and the
 * axes it has.
 *
 * The meta line is right-aligned by `ml-auto` on its own wrapper rather than by
 * the row's justification, so a long category name pushes it rather than
 * re-centring everything to its left.
 *
 * There is no state count on it any more: the states it counted were drawn by
 * the matrix, and the matrix is gone.
 *
 * ─── AND NO DECK ─────────────────────────────────────────────────────────────
 *
 * The line that ran under the heading is gone too. It bound the registry's
 * `purpose` — never authored here, which is why it survived the pass that
 * deleted the ten hand-written ones — but the head this console draws is a
 * title and its facts, and the drawing under it is what a reader came for.
 *
 * `purpose` is still published per type and still required, so the sentence is
 * not lost: it is what the API answers and what a page that wants it can bind.
 * Reinstating it HERE means reinstating a paragraph on eighty-seven pages.
 */
const typeHeader = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-wrap items-center gap-3' },
    children: [
      {
        type: 'text',
        element: 'h1',
        props: {
          className: 'text-foreground font-mono text-3xl font-semibold tracking-tight',
          ...kitType('text'),
        },
        content: '$record.type',
      },
      {
        type: 'text',
        element: 'span',
        props: {
          className:
            'border-border text-foreground-subtle rounded-full border px-2 py-0.5 text-[11px]',
          'data-testid': 'design-system-type-category',
        },
        content: '$record.title',
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        visibility: { record: { field: 'styleable', eq: true } },
        children: [configuredChip('Configured', true), configuredChip('Not configured', false)],
      } as PageComponent,
      {
        type: 'container',
        element: 'article',
        props: {
          className: 'text-foreground-subtle ml-auto flex flex-wrap gap-x-2 font-mono text-[11px]',
          'data-testid': 'design-system-type-facts',
        },
        children: [
          // The separator LEADS each figure rather than trailing it, because a
          // figure that is absent must take its separator with it — a trailing
          // one would leave `7 variants ·` on a type with no size union. The
          // spaces are inside the string for the same reason the numbers are:
          // the row is `flex`, and flex eats the whitespace between children.
          //
          // Each figure comes in a derived form and an authored one, and exactly
          // one of the pair renders on any page — the derived chips gate on a
          // count the authored cases make zero, and the authored spans gate on
          // the type's own name. Both forms of a figure are listed TOGETHER so
          // the order on the page is variants, then sizes, then pages, whichever
          // form each figure took: interleaving them put ` · 3 sizes` in front of
          // `1 variant` on every type with a size union and no variant one.
          ...derivedVariantFactChips(),
          ...authoredVariantFactChips(),
          ...factChip('sizeCount', 'size', 'sizes', ' · '),
          ...authoredSizeFactChips(),
          ...factChip('pageCount', 'page', 'pages', ' · used on '),
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

// ---------------------------------------------------------------------------
// The variants
// ---------------------------------------------------------------------------

/**
 * ONE variant section, as a row template over the published axis.
 *
 * Every string leaf is substituted per row, which is what makes the anchor, the
 * marker, the heading, the address and the specimen's own subject four
 * projections of ONE value rather than four lists that agree today. `$param.type`
 * is the route segment; `$record.value` is the member.
 */
const derivedVariantSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-3',
      id: 'design-system-variant-$record.value',
      'data-design-section': 'design-system-variant-$record.value',
      'data-design-variant': '$record.value',
    },
    children: [
      // The heading is the VALUE, not a prose name for it. A page heading the
      // role a variant plays — `primary` over the fill the config calls
      // `default` — sends a reader to write a value the decoder refuses, which
      // is worse than documenting nothing.
      sectionHeading('$record.value'),
      previewCard([
        {
          type: 'container',
          element: 'article',
          props: {
            className: 'w-full',
            'data-design-specimen': '$param.type',
            'data-testid': 'design-system-specimen-$param.type-$record.value',
          },
          children: [
            {
              type: 'specimen',
              subject: { type: '$param.type', variant: '$record.value' },
              props: { ...kitType('specimen') },
            },
          ],
        } as PageComponent,
      ]),
    ],
  }) as PageComponent

/**
 * The variant sections: the axis the schema publishes, in the published order.
 *
 * ─── WHY THIS IS A BINDING AND NOT A LIST ──────────────────────────────────
 *
 * It was a list, per type, and the lists disagreed with the schema on every one
 * of the six types that has an axis: `button` drew four of seven, `image` one of
 * four, and `progress` and `skeleton` headed sections with words — `labelled`,
 * `indeterminate`, `card` — that are not members of any union, so a reader
 * copying the heading wrote config that fails to decode. A list cannot be told
 * from a derivation by looking at one member; only by where the set came from.
 *
 * Two gates, nested because `visibility.record` names ONE field. The outer is
 * the count, so the eighty-two types with no axis draw their resting section
 * instead; the inner is the authored exception, so `badge` keeps its own.
 */
const derivedVariantSections = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'contents' },
    visibility: { record: { field: 'variantCount', gt: 0 } },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        visibility: { record: { field: 'type', notIn: [...AUTHORED_AXIS_TYPES] } },
        children: [
          {
            type: 'container',
            element: 'div',
            // `list-none` for the reason the rail carries it: a rows binding
            // wraps every row in an `li`, and a bare `li` still computes
            // `display: list-item`.
            props: { className: 'flex list-none flex-col gap-8' },
            dataSource: detailRows('variants'),
            children: [derivedVariantSection()],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/**
 * One authored variant section — `badge` only. Same shape as the derived one.
 *
 * A reader cannot tell which path drew a page, which is the point: the two
 * differ in where the set came from, never in what the page is.
 */
const authoredVariantSection = (type: string, drawing: TypeDrawing): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-3',
      id: `design-system-variant-${drawing.label}`,
      'data-design-section': `design-system-variant-${drawing.label}`,
      'data-design-variant': drawing.label,
    },
    children: [
      sectionHeading(drawing.label),
      // The variant's `note` is deliberately NOT drawn. This console shows how
      // a component renders; what a variant is FOR belongs to the published
      // documentation, and a paragraph above every specimen was reading as
      // documentation rather than as a showcase.
      previewCard([
        {
          type: 'container',
          element: 'article',
          props: {
            className: 'w-full',
            'data-design-specimen': type,
            'data-testid': `design-system-specimen-${type}-${drawing.label}`,
          },
          children: [...drawing.children],
        } as PageComponent,
      ]),
    ],
  }) as PageComponent

/** The authored exception's sections, behind its own name. */
const authoredVariantBodies = (): readonly PageComponent[] =>
  Object.entries(TYPE_BODIES)
    .filter(([, body]) => (body.variants ?? []).length > 0)
    .map(
      ([type, body]) =>
        ({
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-8' },
          visibility: { record: { field: 'type', eq: type } },
          children: (body.variants ?? []).map((drawing) => authoredVariantSection(type, drawing)),
        }) as PageComponent
    )

/**
 * The resting section: what a type with no published axis looks like.
 *
 * ─── ONE SECTION, HOWEVER MANY DRAWINGS ────────────────────────────────────
 *
 * Eighty-two of the eighty-eight types publish no variant axis, and most of them
 * still have more than one thing worth showing: `divider` does three things to a
 * page, `code` frames its content five ways, `sidebar` draws six arrangements.
 * Those drawings were sections of their own, each marked `data-design-variant`
 * and anchored `#design-system-variant-<label>` — which claimed an axis the
 * schema does not have, on three quarters of the catalogue.
 *
 * They keep every drawing and lose the claim. One section, anchored
 * `design-system-type-default` and indexed once in the rail, with each drawing
 * labelled inside it in the same mono line the size ladder and the option
 * showcases use. A type with a single drawing shows it bare: its own name is the
 * section, and a label repeating the heading is a word doing no work.
 */
const restingDrawing = (type: string, drawing: TypeDrawing, labelled: boolean): PageComponent => {
  const card = previewCard([
    {
      type: 'container',
      element: 'article',
      props: {
        className: 'w-full',
        'data-design-specimen': type,
        'data-design-drawing': drawing.label,
        // Each drawing keeps an address of its own, because a spec that wants
        // ONE of them — the icon inside a split button, the sentence a
        // `record-field` binds — cannot reach it through the section. The
        // type-level address sits on the section instead; see there.
        'data-testid': `design-system-specimen-${type}-${drawing.label}`,
      },
      children: [...drawing.children],
    } as PageComponent,
  ])
  if (!labelled) return card
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground font-mono text-[11px]' },
        content: drawing.label,
      } as PageComponent,
      card,
    ],
  } as PageComponent
}

/** One resting section per type that draws one, each behind its own name. */
const restingSections = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'contents' },
    // Gated on the COUNT as well as on the name, so a type that gains an axis
    // tomorrow switches to the derived sections rather than drawing both.
    visibility: { record: { field: 'variantCount', eq: 0 } },
    children: Object.entries(TYPE_BODIES)
      .filter(([, body]) => (body.drawings ?? []).length > 0)
      .map(([type, body]) => {
        const drawings = body.drawings ?? []
        const labelled = drawings.length > 1
        return {
          type: 'container',
          element: 'section',
          props: {
            className: 'flex scroll-mt-6 flex-col gap-3',
            id: sectionId('default'),
            'data-design-section': sectionId('default'),
            'data-design-type-section': 'default',
            // The type's own address, WITHOUT a variant segment — the other
            // half of the distinction the anchor makes, since this type has no
            // member to name. It sits on the section because the section IS the
            // resting drawing; the drawings inside it are named parts of it.
            'data-testid': `design-system-specimen-${type}`,
          },
          visibility: { record: { field: 'type', eq: type } },
          children: [
            sectionHeading('default'),
            ...(labelled
              ? [
                  {
                    type: 'container',
                    element: 'div',
                    props: { className: 'flex flex-col gap-4' },
                    children: drawings.map((drawing) => restingDrawing(type, drawing, true)),
                  } as PageComponent,
                ]
              : drawings.map((drawing) => restingDrawing(type, drawing, false))),
          ],
        } as PageComponent
      }),
  } as PageComponent,
]

/**
 * The Sizes section, derived from the closed `size` union the schema declares.
 *
 * Five types declare one — `button`, `progress`, `avatar`, `toggle`,
 * `toggle-group` — and each member is drawn by the real renderer at that size.
 * The cell is marked with the member's own name, which is the word an author
 * writes: the authored ladder it replaces marked its cells `size: 'sm'`, so a
 * spec looking for `sm` found nothing and a reader read a config line where a
 * value belonged.
 */
const derivedSizeSection = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'section',
    props: {
      className: 'flex scroll-mt-6 flex-col gap-3',
      id: sectionId('sizes'),
      'data-design-section': sectionId('sizes'),
      'data-design-type-section': 'sizes',
    },
    visibility: { record: { field: 'sizeCount', gt: 0 } },
    children: [
      sectionHeading('Sizes'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex list-none flex-col gap-4' },
        dataSource: detailRows('sizes'),
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-2' },
            children: [
              {
                type: 'text',
                element: 'span',
                props: { className: 'text-foreground font-mono text-[11px]' },
                content: '$record.value',
              } as PageComponent,
              previewCard([
                {
                  type: 'container',
                  element: 'article',
                  props: {
                    className: 'w-full',
                    'data-design-size': '$record.value',
                    'data-design-specimen': '$param.type',
                  },
                  children: [
                    {
                      type: 'specimen',
                      subject: { type: '$param.type', size: '$record.value' },
                      props: { ...kitType('specimen') },
                    },
                  ],
                } as PageComponent,
              ]),
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/**
 * The Sizes section of the one type whose size axis the schema cannot see.
 *
 * `drawer` writes its width on `drawerSize`, so the projection that computes
 * `sizeCount` never sees it and the derived section never fires on a type whose
 * size axis is real, declared and documented. It supplies its own.
 */
const authoredSizeSections = (): readonly PageComponent[] =>
  Object.entries(TYPE_BODIES)
    .filter(([, body]) => (body.sizes ?? []).length > 0)
    .map(
      ([type, body]) =>
        ({
          type: 'container',
          element: 'section',
          props: {
            className: 'flex scroll-mt-6 flex-col gap-3',
            id: sectionId('sizes'),
            'data-design-section': sectionId('sizes'),
            'data-design-type-section': 'sizes',
          },
          visibility: { record: { field: 'type', eq: type } },
          children: [
            sectionHeading('Sizes'),
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex list-none flex-col gap-4' },
              children: (body.sizes ?? []).map((drawing) => sizeDrawing(type, drawing)),
            } as PageComponent,
          ],
        }) as PageComponent
    )

/** One authored size: its mono label and the drawing in a card. */
const sizeDrawing = (type: string, drawing: TypeDrawing): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground font-mono text-[11px]' },
        content: drawing.label,
      } as PageComponent,
      previewCard([
        {
          type: 'container',
          element: 'article',
          props: {
            className: 'w-full',
            'data-design-size': drawing.label,
            'data-design-specimen': type,
          },
          children: [...drawing.children],
        } as PageComponent,
      ]),
    ],
  }) as PageComponent

/**
 * The rail entries for the variant sections — the derived list, bound to the
 * SAME rows the sections are.
 *
 * One row, two projections: the rail cannot list a member the page did not draw,
 * and a member cannot be drawn without an entry. `-096` compares the rail with
 * what the page drew, which passes on two hand-typed lists so long as both were
 * typed the same way; binding them to one read is what makes that comparison
 * mean something.
 */
const derivedVariantRailEntries = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'contents' },
    visibility: { record: { field: 'variantCount', gt: 0 } },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        visibility: { record: { field: 'type', notIn: [...AUTHORED_AXIS_TYPES] } },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'contents' },
            dataSource: detailRows('variants'),
            children: [
              {
                type: 'link',
                props: {
                  href: '#design-system-variant-$record.value',
                  className: RAIL_ENTRY_CLASS,
                  'data-design-rail-entry': 'design-system-variant-$record.value',
                  ...kitType('link'),
                },
                content: '$record.value',
              } as PageComponent,
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** The rail entries for the authored exception's sections. */
const authoredVariantRailEntries = (): readonly PageComponent[] =>
  Object.entries(TYPE_BODIES).flatMap(([type, body]) =>
    (body.variants ?? []).map(
      (drawing) =>
        ({
          type: 'link',
          props: {
            href: `#design-system-variant-${drawing.label}`,
            className: RAIL_ENTRY_CLASS,
            'data-design-rail-entry': `design-system-variant-${drawing.label}`,
            ...kitType('link'),
          },
          visibility: { record: { field: 'type', eq: type } },
          content: drawing.label,
        }) as PageComponent
    )
  )

// ---------------------------------------------------------------------------
// The option showcases
// ---------------------------------------------------------------------------

/**
 * Every authored option of every type, gated on the type it belongs to.
 *
 * One wrapper per type rather than one per section: `visibility.record` names a
 * single field, and twenty sections each carrying the same `type eq` predicate
 * is twenty predicates where one does.
 */
const authoredOptionSections = (): readonly PageComponent[] =>
  Object.entries(TYPE_BODIES)
    .filter(([, body]) => (body.options ?? []).length > 0)
    .map(
      ([type, body]) =>
        ({
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-8' },
          visibility: { record: { field: 'type', eq: type } },
          children: (body.options ?? []).map((showcase) =>
            optionShowcase({
              type,
              id: showcase.id,
              title: showcase.title,
              configKey: showcase.configKey,
              drawings: showcase.drawings.map((drawing) =>
                drawingBlock({
                  label: drawing.label,
                  children: drawing.children,
                  specimenType: type,
                })
              ),
            })
          ),
        }) as PageComponent
    )

/** The rail half of the same array, so the two cannot name different sections. */
const authoredOptionRailEntries = (): readonly PageComponent[] =>
  Object.entries(TYPE_BODIES).flatMap(([type, body]) =>
    (body.options ?? []).map((showcase) =>
      optionRailEntry({ type, id: showcase.id, title: showcase.title })
    )
  )

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

/**
 * The state vocabulary, drawn once for the type rather than once per variant.
 *
 * ─── ONE STRIP, NOT A MATRIX ───────────────────────────────────────────────
 *
 * States used to be the second axis of a cross product, and the product is what
 * made the old page unreadable: `button` drew its four states seven times over.
 * They are a property of the TYPE, not of each variant — hover looks like hover
 * on all seven — so one strip says the whole of it, and most cells are small
 * because a state is a difference rather than a subject.
 *
 * ─── EXCEPT THE WIDE TYPES, WHICH RENDER AT FULL SIZE ──────────────────────
 *
 * Six types draw their live component in the cell rather than a reduction:
 * `table`, `kanban`, `list`, `calendar`, `gallery` and `code`. A grid at
 * thumbnail scale shows that SOMETHING is loading or empty and not what a
 * loading grid looks like — and for these six the state IS the subject, because
 * what changes between `default`, `loading` and `empty` is the whole surface
 * rather than a border or a tint. `table`'s cell is 4,831px for that reason,
 * which is more than a tenth of its page and is deliberate.
 *
 * Founder ruling, 2026-09-14, after the parity review measured the cell against
 * the capped console and found the size real rather than an accident of an
 * uncapped binding. The sentence above used to read "every cell is small",
 * which this contradicted; a note that a shipped surface disproves is worse
 * than no note, because the next reader trusts it.
 *
 * `data-design-state` rides on the cell, once per state, which is the count the
 * state-vocabulary criterion reads. In the matrix it had to be gated to one row
 * of the product to stay at one; here there is only one row.
 *
 * `source` says whether the console RENDERED the state or DEPICTED it — a
 * `:hover` cannot be forced in a static document, so some cells are drawn to
 * look like the state rather than put into it. Publishing which is which is the
 * difference between a drawing and a claim.
 *
 * ─── THE GATE IS `drawableStateCount`, NOT `stateCount` ────────────────────
 *
 * `stateCount` is how many states the VOCABULARY distinguishes for the type —
 * four whether or not one of them can be painted. Where the catalogue refuses a
 * specimen, every cell can only repeat the same refusal sentence, so the strip
 * became a heading over an apology printed four times. `drawableStateCount` is
 * the same number where the catalogue draws and zero where it refuses, read off
 * the same refusal the sentence comes from — so the block is dropped rather
 * than apologised for, and the count and the sentence cannot drift apart.
 *
 * A refused type is not left without its states: `record-picker` draws them as
 * an authored option section on its own page, which is then the ONE section
 * named `States` rather than the second of two.
 */
const statesSection = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    // ONE STATE PER ROW, at the full width of the page.
    //
    // The cells used to size to their own content and wrap, so how many landed
    // on a row was decided by whatever the type happened to draw. At three a
    // cell's label stopped sitting above its drawing and wrapped beside it; at
    // two a `table` state clipped its last column. Both are the same defect —
    // a cell squeezed by a neighbour it knows nothing about — and only the full
    // width answers it for every type at once, including the six where the
    // state IS the whole surface rather than a border or a tint.
    props: { className: 'flex list-none flex-col gap-3' },
    dataSource: detailRows('states'),
    children: [
      {
        type: 'container',
        element: 'article',
        props: {
          // `items-stretch`, NOT `items-start`. A cross-start cell shrink-wraps
          // its stage, so the drawing is sized by its own widest row instead of
          // by the box it was given — and an `accordion` then GREW from 164px
          // to 251px inside a 621px cell the moment a panel was opened. The
          // stage is a block element, so stretching it hands a full-width
          // component its width and leaves an inline one (a button, a badge) at
          // its natural size: the same class answers both.
          //
          // `text-base` for the reason `previewCard` carries it: a state cell
          // is a drawing frame that is NOT a preview card, so without it a
          // component ruling no typography class inherits the document root,
          // and the same `link` reads 13px in its drawing and 16px in its
          // states — a difference the strip exists to deny.
          className:
            'border-border flex flex-col items-stretch gap-2 rounded-md border px-4 py-3 text-base',
          'data-design-specimen': '$param.type',
          'data-design-state': '$record.state',
          'data-design-state-source': '$record.source',
          'data-testid': 'design-system-specimen-$param.type-state-$record.state',
        },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle font-mono text-[10px]' },
            content: '$record.state',
          },
          {
            type: 'specimen',
            subject: { type: '$param.type', state: '$record.state' },
            props: { ...kitType('specimen') },
          },
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

/**
 * Where this type is already written, as routes rather than as a bare count.
 *
 * ─── NOT YET TRUNCATED, AND THAT IS A GAP RATHER THAN A CHOICE ─────────────
 *
 * The reference shows the first six routes and an inert `+ N more`. Neither half
 * is expressible: a rows binding has no limit — `SystemSourceSchema` declares
 * none — and a page has no arithmetic with which to say how many were left out.
 * Publishing a per-row `overflow` flag and an `overflowCount` scalar would give
 * both, exactly as the variant-state matrix used to publish `exhibit` for the
 * same reason. Until then a heavily-used type prints its whole route list, which
 * is the honest failure: over-long rather than silently short.
 */
const usedOnSection = (): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'p',
    props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
    visibility: { record: { field: 'pageCount', eq: 0 } },
    content:
      'Not used on any page of this app yet. Write it into a page and its routes appear here.',
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex list-none flex-wrap gap-1.5' },
    dataSource: detailRows('routes'),
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
  } as PageComponent,
]

/**
 * The other types the registry places in this category.
 *
 * ─── THE ADDRESS IS COMPOSED, NOT TAKEN FROM THE ROW ───────────────────────
 *
 * Each row publishes its own `href` and this deliberately ignores it. The mount
 * prefixing pass runs BEFORE row expansion, so a literal path is rewritten and a
 * value arriving from a row is not: `$record.href` would reach the browser as
 * `/design-system/ui-kit/alert`, a 404 under `/_admin`.
 *
 * The empty state is gated on `siblingCount`, not on the list being empty:
 * `visibility.record` has no length operator, so "this is the only type in its
 * category" is only askable of a count.
 */
const relatedSection = (): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'p',
    props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
    visibility: { record: { field: 'siblingCount', eq: 0 } },
    content: 'This is the only type in its category, so it has no siblings here.',
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex list-none flex-wrap gap-2' },
    dataSource: detailRows('siblings'),
    children: [
      {
        type: 'link',
        props: {
          href: `/design-system/${KIT_SLUG}/$record.type`,
          className:
            'border-border text-foreground-subtle hover:text-foreground rounded-md border px-2 py-1 font-mono text-[11px]',
          ...kitType('link'),
        },
        content: '$record.type',
      },
    ],
  } as PageComponent,
]

// ---------------------------------------------------------------------------
// The rail
// ---------------------------------------------------------------------------

/** One rail entry addressing a section this page declared by hand. */
const fixedRailEntry = (slug: string, title: string, gate?: RecordGate): PageComponent =>
  ({
    type: 'link',
    props: {
      href: `#${sectionId(slug)}`,
      className: RAIL_ENTRY_CLASS,
      'data-design-rail-entry': sectionId(slug),
      ...kitType('link'),
    },
    ...(gate === undefined ? {} : { visibility: { record: gate } }),
    content: title,
  }) as PageComponent

/**
 * The rail: the drawings, then the sections that are not drawings.
 *
 * The derived entries are BOUND to the same rows the sections are, so the rail
 * cannot list a member the page did not draw and a member cannot be drawn
 * without an entry. That is one row and two projections, which is stronger than
 * the gate-per-entry coupling it replaced.
 *
 * `States` and `Sizes` carry their sections' own gates, because they are the
 * conditional ones. `Used on` and `Related` always render — both state their
 * empty case — so an unconditional entry always resolves.
 */
const typeRail = (): readonly PageComponent[] =>
  railFrame({
    heading: 'On this page',
    entries: [
      // Exactly one of the first three renders on any page: the derived list
      // where the schema publishes an axis, the authored list for the one
      // exception, the resting entry where there is no axis at all. Gating a
      // section and not its entry is what once left a type carrying the
      // SCHEMA's variant names in its rail, every one pointing at a section the
      // page no longer drew.
      ...derivedVariantRailEntries(),
      ...authoredVariantRailEntries(),
      {
        ...fixedRailEntry('default', 'default'),
        visibility: { record: { field: 'variantCount', eq: 0 } },
      } as PageComponent,
      ...authoredOptionRailEntries(),
      // `drawableStateCount`, never `stateCount` — see `statesSection` for the
      // difference. The rail and the section read the SAME field, for the same
      // reason the variant entries are bound to the rows their sections are:
      // an entry pointing at a section the page did not draw is a dead link.
      fixedRailEntry('states', 'States', { field: 'drawableStateCount', gt: 0 }),
      fixedRailEntry('sizes', 'Sizes', { field: 'sizeCount', gt: 0 }),
      ...Object.entries(TYPE_BODIES)
        .filter(([, body]) => (body.sizes ?? []).length > 0)
        .map(
          ([type]) =>
            ({
              ...fixedRailEntry('sizes', 'Sizes'),
              visibility: { record: { field: 'type', eq: type } },
            }) as PageComponent
        ),
      fixedRailEntry('used-on', 'Used on'),
      fixedRailEntry('related', 'Related'),
    ],
  })

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const typePage: PageConfig = withShell(
  {
    id: 'design-system-type-page',
    name: 'design-system-type-page',
    path: `/design-system/${KIT_SLUG}/:type`,
    meta: {
      lang: 'en-US',
      title: 'Component type',
      description: 'What an author may write into one component type of this engine.',
    },
    params: {
      type: { system: { endpoint: COMPONENT_TYPES_ENDPOINT }, valueKey: 'type' },
    },
    dataSource: {
      system: { endpoint: COMPONENT_TYPE_DETAIL_ENDPOINT, param: 'type', idKey: 'type' },
    },
    components: [
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
              // ONE scope, wrapping every specimen on the page — the boundary
              // the OPERATOR's design paints inside, and what separates a
              // control this console DREW as documentation from one the console
              // offers. Every edit-affordance sweep counts text entry OUTSIDE
              // it, so a drawn `input` specimen must be within.
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
                      ...kitType('container'),
                    },
                    children: [
                      ...withTailRoom([
                        ...typeHeader(),
                        // Exactly one of the three renders — see the rail, which
                        // is gated the same way and in the same order.
                        ...derivedVariantSections(),
                        ...authoredVariantBodies(),
                        ...restingSections(),
                        // The option showcases follow the variants and precede
                        // the fixed sections, which is the order the reference
                        // reads in: what the type LOOKS like, then what an author
                        // may write into it, then where it is used.
                        ...authoredOptionSections(),
                        // States are drawn ONCE for the type rather than once
                        // per variant — see `statesSection` for why the cross
                        // product went.
                        section(
                          'states',
                          'States',
                          { field: 'drawableStateCount', gt: 0 },
                          statesSection()
                        ),
                        ...derivedSizeSection(),
                        ...authoredSizeSections(),
                        section('used-on', 'Used on', undefined, usedOnSection()),
                        section('related', 'Related', undefined, relatedSection()),
                      ]),
                    ],
                  },
                ],
              },
            ],
          },
          ...typeRail(),
        ],
      } as PageComponent,
    ],
  },
  {
    breadcrumb: { 'design-system': 'Design system', [KIT_SLUG]: 'UI kit' },
    // The kit's own column, so a reader who arrived at one type can reach every
    // other one. COLLAPSED here: twelve category rows with only the one this
    // type belongs to open, the other eleven a click away. The index draws the
    // same content with every group expanded, which is what an index is for.
    navColumn: kitNavColumn({ onIndex: false }),
  }
)

export default typePage
