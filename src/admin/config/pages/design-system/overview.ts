/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The section root — and the one page that answers "how much of this system is
// MINE", then hands the whole of it over.
//
// The `h1` is exactly `Design system`, matching the sidebar row a reader
// arrives from. `[internal ref]` and `-008` resolve it by role at
// level 1 with `exact: true` on every one of the six pages, so the heading is
// the section's NAME rather than a framing of it; the "what is yours" framing
// belongs to the deck below it, where it costs nothing to say.
//
// ─── ONE ENDPOINT, READ THREE TIMES, FOR THREE DIFFERENT QUESTIONS ────────
//
// `GET /api/admin/design-system/coverage` publishes one row per layer:
// `{ key, label, declared, count, configPath, state }`, and a tally of the
// three states beside them. The page binds it three times because a reader asks
// three things of it in different registers:
//
//   The SUMMARY   — "what is this system made of": the count beside its own
//                   noun, so `2` and `font families` read as one phrase. The
//                   `label` is the product's only name for a layer, which is
//                   why the page prints it rather than choosing its own.
//   The TALLY     — "what shape is my config in", before a single row is read.
//                   The four counts beside the rows, bound as the PAGE's own
//                   record. A headline typed beside a list is the drift this
//                   console exists to remove, and a rows template cannot count
//                   itself — so the endpoint publishes the counts and the page
//                   reads them, server-side and with no island.
//   The LEDGER    — "which of it did I choose": the same rows, each stating
//                   which of the three states it is in, and each UNDECLARED one
//                   naming the key that would change that.
//
// ─── THE THIRD STATE IS THE POINT ─────────────────────────────────────────
//
// `declared` was a boolean, so it read every key the operator did not write as
// the same thing. It is not. A key the platform SUPPLIES — the colour roles,
// the type steps, the spacing ladder — is answered, working, and needs nothing;
// a key nobody supplies is a gap. Marking both "not declared" tells an author
// they have twelve problems when they have three, which is worse than saying
// nothing, because it is confidently wrong.
//
// So `configPath` is published on EVERY row and the page decides where it is
// worth showing: only on a row nothing supplies. A declared layer has nothing
// to offer, and neither does an inherited one — pointing at documentation for a
// key the reader does not need to write is the same noise in a different place.
//
// [internal ref] keeps this console read-only, so the affordance is NAVIGATION to the
// key rather than a control that writes it.
//
// ─── THE SEVENTH PAGE IS HERE, NOT BESIDE THIS ONE ────────────────────────
//
// `/design-system/agents` is retired. What it carried — the share link, the two
// export documents and the CLI block — is the `Share and export` section at the
// foot of this page, because a hand-over is what a reader does AFTER reading
// what they have, and a page of its own put it somewhere nobody arrived at. The
// route is gone rather than redirected: a page nothing links to is not a page
// nobody opens, it is an unaudited one still serving a second copy of the
// affordances to whoever bookmarked it.

import { consolePage } from '../../components/data-page'
import { designPageHeader } from '../../components/page-header'
import { DESIGN_COVERAGE_ENDPOINT, SHARES_ENDPOINT } from '../../system-sources'
import { designSystemBreadcrumb } from './chrome'
import { MEASURE_MD, kitType, microLabel } from './sections'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The markdown export, the one a reader is most likely to hand over. */
const MARKDOWN_EXPORT = '/api/admin/design-system.md'

/** The token document, the one a build step reads. */
const JSON_EXPORT = '/api/admin/design-system.json'

/**
 * The CLI form of the same two documents, WITH the config file it reads.
 *
 * A command pasted without its argument fails at the first prompt, which is the
 * worst possible place to learn that a copy button was approximate.
 */
const CLI_COMMAND = 'sovrium design-system app.ts --format md'

/**
 * The four destinations below the Overview, each with the noun it renders and
 * one line about what is on it.
 *
 * The line matters as much as the noun: a bare noun does not say which page answers a question.
 */
const SECTIONS: readonly (readonly [slug: string, title: string, blurb: string])[] = [
  ['foundations', '$t:admin.common.foundations', '$t:admin.ds.overview.foundations'],
  ['components', '$t:admin.common.components', '$t:admin.ds.overview.components'],
  ['brand', '$t:admin.common.brand', '$t:admin.ds.overview.brand'],
  ['voice', '$t:admin.common.voice', '$t:admin.ds.overview.voice'],
]

// ─── THE PREVIEW BESIDE EACH ROW ───────────────────────────────────────────
//
// A row naming a page and describing it in a line still leaves a reader
// guessing what is on the other side of the chevron. A small drawing lifted
// from that page answers it in the width the row already has — the colour
// ramp for Foundations, the console topbar for Components, the mark for Brand, one sentence in the app's own
// voice for Voice.
//
// Each is composed from real kit types, drawn at rest. None of them is a
// screenshot and none is an iframe: the console renders its own components, so
// a drawing here IS the thing it previews, and it moves when the theme does.

/**
 * The frame every preview sits in, so the five read as one column.
 *
 * It carries the console's body step because font-size INHERITS: a drawing
 * holding a component that rules no typography class would otherwise inherit
 * the document root and draw bigger than the row naming it.
 */
const previewSlot = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-muted hidden min-h-[4.5rem] flex-1 items-center justify-center gap-3 rounded-md border px-4 text-base md:flex',
    },
    children: [...children],
  }) as PageComponent

/** Foundations: the neutral ramp, and the one colour left with a job. */
const foundationsPreview = (): PageComponent =>
  previewSlot(
    ['foreground', 'foreground-subtle', 'foreground-muted', 'border', 'error'].map(
      (token) =>
        ({ type: 'swatch', token, size: 24, props: { ...kitType('swatch') } }) as PageComponent
    )
  )

/** Components: the console topbar, which is one of the four declared. */
const componentsPreview = (): PageComponent =>
  previewSlot([
    {
      type: 'container',
      element: 'div',
      props: {
        className:
          'border-border bg-background flex w-full items-center gap-2 rounded-sm border px-3 py-2',
      },
      children: [
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-muted-foreground text-[10px]' },
          content: '$t:admin.common.records',
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-muted-foreground text-[10px]' },
          content: '/',
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-foreground text-[10px] font-medium' },
          content: '$t:admin.ds.overview.invoices',
        },
        {
          type: 'icon',
          props: {
            name: 'search',
            size: 12,
            className: 'text-muted-foreground ml-auto',
            ...kitType('icon'),
          },
        } as PageComponent,
        {
          type: 'icon',
          props: { name: 'moon', size: 12, className: 'text-muted-foreground' },
        } as PageComponent,
      ],
    } as PageComponent,
  ])

/** Brand: the mark beside the wordmark, at the size a header uses. */
const brandPreview = (): PageComponent =>
  previewSlot([
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex items-center gap-2.5' },
      children: [
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              'bg-foreground text-background flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-semibold',
          },
          content: 'S',
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-foreground text-md font-semibold tracking-tight' },
          content: 'Sovrium',
        },
      ],
    } as PageComponent,
  ])

/** Voice: the rule stated in the voice it describes. */
const voicePreview = (): PageComponent =>
  previewSlot([
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-md italic' },
      content: '$t:admin.ds.overview.fact',
    } as PageComponent,
  ])

const PREVIEWS: Readonly<Record<string, () => PageComponent>> = {
  foundations: foundationsPreview,
  components: componentsPreview,
  brand: brandPreview,
  voice: voicePreview,
}

/**
 * One destination row: the page's name, what is on it, its preview, and a chevron.
 *
 * A rule-separated ROW rather than a card in a grid, and it is the same anatomy
 * the Components index uses — one row shape across both indexes. A card is a square and a page's purpose is a line
 * of prose; the grid answered "what is this called" and never "which of these
 * do I want".
 */
const sectionRow = (slug: string, title: string, blurb: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border border-b last:border-b-0',
      'data-testid': `design-system-card-${slug}`,
    },
    children: [
      {
        type: 'link',
        props: {
          href: `/design-system/${slug}`,
          className:
            'hover:bg-muted group flex flex-col items-start gap-1.5 px-4 py-3.5 no-underline md:flex-row md:items-center md:gap-4',
          ...kitType('link'),
        },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground text-md font-medium md:w-36 md:shrink-0' },
            content: title,
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle min-w-0 text-md md:w-80 md:shrink' },
            content: blurb,
          },
          PREVIEWS[slug]?.() ?? {
            type: 'container',
            element: 'div',
            props: { className: 'flex-1' },
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-muted-foreground hidden shrink-0 text-md md:inline' },
            content: '›',
          },
        ],
      },
    ],
  }) as PageComponent

/** The five rows under one heading — the section's own table of contents. */
const pagesList = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3', 'aria-label': '$t:admin.common.pages' },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-lg font-semibold tracking-tight', ...kitType('text') },
        content: '$t:admin.common.pages',
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'border-border rounded-md border' },
        children: SECTIONS.map(([slug, title, blurb]) =>
          gatedRow(slug, sectionRow(slug, title, blurb))
        ),
      },
      // The engine's catalogue is shadcn's and ships with the binary: one line says where.
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'text-muted-foreground text-sm',
          'data-testid': 'design-system-catalogue-pointer',
        },
        children: [
          {
            type: 'text',
            element: 'span',
            content: '$t:admin.ds.overview.engineTypes',
          },
          {
            type: 'text',
            element: 'code',
            props: { className: 'bg-muted rounded px-1 py-0.5 font-mono text-xs' },
            content: 'sovrium docs components',
          },
        ],
      },
    ],
  }) as PageComponent

/** The feature each destination requires: a row to a page the host does not serve is a 404 link. */
const ROW_REQUIRES: Readonly<Record<string, string>> = {
  components: 'components',
  brand: 'design.brand',
  voice: 'design.voice',
}

const gatedRow = (slug: string, row: PageComponent): PageComponent => {
  const feature = ROW_REQUIRES[slug]
  return feature === undefined
    ? row
    : ({ ...(row as Record<string, unknown>), visibility: { declares: feature } } as PageComponent)
}

/**
 * Which published article explains each undeclared layer.
 *
 * Every one of these resolves: `apps/website/content/docs/{en,fr}/design.md`,
 * `design-components.md`, `design-type-scale.md` and `design-density.md` all
 * exist in both locales. The four that point at the components article do so
 * because that is where colour roles, component guidance, imagery and the
 * per-type restyling block are actually documented — sending all seven to the
 * design article would be one link that is right about the subject and wrong
 * about the page.
 */
const DOC_LINKS: readonly (readonly [key: string, slug: string])[] = [
  ['principles', 'design'],
  ['writing-rules', 'design'],
  ['logo', 'design'],
  ['color-roles', 'design-components'],
  ['component-guidance', 'design-components'],
  ['imagery', 'design-components'],
  ['types-restyled', 'design-components'],
]

/** One address, linked to the article that explains it. */
const docsLink = (key: string, slug: string): PageComponent =>
  ({
    type: 'link',
    visibility: { record: { field: 'key', eq: key } },
    props: {
      href: `/en/docs/${slug}`,
      className: 'text-foreground-subtle hover:text-foreground font-mono text-sm',
      'data-design-coverage-doc': slug,
    },
    content: '$record.configPath',
  }) as PageComponent

/**
 * The coverage ledger: which layers are the operator's, which are the
 * platform's showing through, and which nothing answers at all.
 *
 * `data-design-coverage` and `-state` are minted per row from the record, which
 * is what makes a row addressable at all — a fixed island shape has no way to
 * carry them. The state is read off the payload rather than derived here: a
 * console that recomputed it would be a second opinion about the operator's
 * config, and two opinions is one too many.
 */
const coverageLedger = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex flex-col gap-4',
      'aria-label': '$t:admin.ds.overview.declared',
      'data-testid': 'design-system-coverage',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-lg font-semibold tracking-tight' },
        content: '$t:admin.ds.overview.declared',
      },
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'border-border divide-border list-none divide-y rounded-md border',
        },
        dataSource: {
          system: { endpoint: DESIGN_COVERAGE_ENDPOINT, rowsKey: 'items', idKey: 'key' },
        },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5',
              'data-design-coverage': '$record.key',
              'data-design-coverage-declared': '$record.declared',
              'data-design-coverage-state': '$record.state',
            },
            children: [
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex items-baseline gap-2' },
                children: [
                  {
                    type: 'text',
                    element: 'span',
                    props: { className: 'text-foreground text-md' },
                    content: '$record.label',
                  },
                  {
                    type: 'text',
                    element: 'span',
                    props: { className: 'text-muted-foreground text-sm tabular-nums' },
                    content: '$record.count',
                  },
                  // The human reading of the layer, where the payload carries
                  // one. It is published per row rather than derived here: a
                  // count says how many keys answer a layer and never what they
                  // add up to, and "0 of 88 types restyled" is a sentence only
                  // the layer itself can write. Gated on the field being
                  // non-empty, because most layers do not carry one yet and a
                  // blank span beside every count reads as a broken column.
                  {
                    type: 'text',
                    element: 'span',
                    props: { className: 'text-foreground-subtle text-sm' },
                    visibility: { record: { field: 'summary', isNotEmpty: true } },
                    content: '$record.summary',
                  },
                ],
              },
              {
                type: 'container',
                element: 'div',
                props: { className: 'flex items-baseline gap-3' },
                children: [
                  {
                    type: 'badge',
                    props: { ...kitType('badge') },
                    content: '$record.state',
                  },
                  // Shown ONLY where nothing answers the layer yet. A row that
                  // printed an address on every line would tell an author
                  // nothing about which of them is worth opening — and an
                  // INHERITED row printing one would send them to write a key
                  // the platform has already answered.
                  //
                  // ─── ONE LINK PER KEY, BECAUSE A PAGE HAS NO MAP ─────────
                  //
                  // The article that explains a layer is not derivable from its
                  // config path: four of them are covered by the components
                  // article and the rest by the design one. A page has no
                  // lookup, so the pairing is a gated node per key — and a
                  // `visibility.record` names ONE field, which is why the state
                  // gate is the wrapper and the key gate is inside it.
                  {
                    type: 'container',
                    element: 'div',
                    props: { className: 'contents' },
                    visibility: { record: { field: 'state', eq: 'not-declared' } },
                    children: DOC_LINKS.map(([key, slug]) => docsLink(key, slug)),
                  } as PageComponent,
                ],
              },
            ],
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * One document, as the two things a reader wants from it: a name they can open
 * and an address they can paste.
 *
 * They are different KINDS of thing and one control would get one of them
 * wrong. The name is a LINK — it is a place a reader can go, and a button
 * labelled "Export" would be a verb this console refuses. The address renders
 * as `GET /api/…` because a reader needs the verb, and COPIES the path alone,
 * because `GET ` pasted into a browser bar, a fetch call or an agent brief is
 * broken in all three. So the displayed verb sits OUTSIDE the copy target.
 */
const exportRow = (input: {
  readonly name: string
  readonly path: string
  readonly nameTestId: string
  readonly pathTestId: string
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0',
    },
    children: [
      {
        type: 'link',
        props: {
          href: input.path,
          className: 'text-foreground w-40 shrink-0 text-md font-medium',
          'data-testid': input.nameTestId,
        },
        content: input.name,
      },
      {
        type: 'container',
        element: 'div',
        props: {
          className:
            'border-border bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-1.5',
          'data-code-copy-scope': 'true',
        },
        children: [
          {
            type: 'text',
            element: 'span',
            props: {
              className:
                'bg-border text-muted-foreground shrink-0 rounded-[2px] px-[7px] font-mono text-[10px]',
            },
            content: 'GET',
          },
          {
            type: 'link',
            props: {
              href: input.path,
              className: 'text-foreground min-w-0 truncate font-mono text-sm',
              'data-copy-target': 'true',
              'data-testid': input.pathTestId,
            },
            content: input.path,
          },
          {
            type: 'button',
            variant: 'link',
            props: {
              type: 'button',
              className:
                'text-foreground-subtle hover:text-foreground ml-auto shrink-0 font-mono text-[10px] leading-none',
              'data-copy-code': 'true',
              'data-copied-label': '$t:admin.common.copied',
              'aria-label': `$t:admin.common.copy ${input.path}`,
              ...kitType('button'),
            },
            content: '$t:admin.common.copy',
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The terminal half — the same two documents without a session.
 *
 * The copy affordance is MARKUP, not an island: the delegated `copyCodeScript`
 * every page already carries resolves a scope from the BUTTON upward
 * (`closest('[data-code-copy-scope]')`) and copies the first
 * `[data-copy-target]` inside it. An island here would buy nothing and cost the
 * read-only guarantee a whole console page is swept for.
 */
const terminalBlock = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1.5', 'data-testid': 'design-system-copy-cli' },
    children: [
      microLabel('$t:admin.ds.share.terminal'),
      {
        type: 'container',
        element: 'div',
        props: {
          className:
            'border-border bg-muted flex items-center justify-between gap-3 rounded-md border px-3 py-2',
          'data-code-copy-scope': 'true',
        },
        children: [
          {
            type: 'text',
            element: 'p',
            props: {
              className: 'text-foreground min-w-0 truncate font-mono text-sm',
              'data-copy-target': 'true',
              'data-testid': 'design-system-cli',
            },
            content: CLI_COMMAND,
          },
          {
            type: 'button',
            variant: 'link',
            props: {
              type: 'button',
              className:
                'text-foreground-subtle hover:text-foreground shrink-0 font-mono text-[10px] leading-none',
              'data-copy-code': 'true',
              'data-copied-label': '$t:admin.common.copied',
              'aria-label': `$t:admin.common.copy ${CLI_COMMAND}`,
            },
            content: '$t:admin.common.copy',
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The share links, as config rather than as an island.
 *
 * ─── IT WAS AN ISLAND AND DID NOT NEED TO BE ───────────────────────────────
 *
 * The whole panel — the listing, the mint control and the revoke — was one
 * hand-written `data-island` marker with a skeleton under it. Every part of it
 * is expressible: the listing is a rows binding, and both writes are a `button`
 * with a `fetch` action and a `refresh` on success, which is the same shape the
 * file console already uses to delete a stored object. Config is what this
 * console documents; a bespoke island in the middle of it was the one section
 * that could not be read as an example of anything.
 *
 * ─── THE LISTING CARRIES NO TOKEN, AND THAT IS THE ENDPOINT'S DOING ────────
 *
 * `GET` answers with an id and a creation date per link. The token is returned
 * exactly once, by the mint, and never again — so a page that drew the listing
 * could not leak it even if it tried to.
 *
 * ─── REVOKE CONFIRMS, AND SAYS WHAT HAPPENS ────────────────────────────────
 *
 * It is destructive and irreversible: anyone holding the link loses access the
 * moment it lands, and a new link is a different address. The confirmation says
 * that rather than asking "Are you sure?", which is a question nobody has ever
 * answered with information.
 */
/** The region the minted address is written into, and addressed by. */
const SHARE_URL_ID = 'design-system-share-url'

const sharePanel = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    // The panel is the heading AND the rows, not the rows alone: a panel that
    // does not contain its own name is not a named panel.
    props: {
      className: 'flex flex-col gap-3',
      'data-testid': 'design-system-share-active',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-center justify-between gap-3' },
        children: [
          {
            type: 'text',
            element: 'h3',
            props: { className: 'text-foreground text-md font-medium' },
            content: '$t:admin.ds.share.active',
          },
          {
            type: 'button',
            variant: 'secondary',
            visibility: { capability: 'edit-operations' },
            props: {
              type: 'button',
              'data-testid': 'design-system-share-mint',
              ...kitType('button'),
            },
            // ─── THE DISCLOSURE COMES BEFORE THE LINK, NOT AFTER ────────
            //
            // Minting publishes more than the visual tokens: the principles,
            // the voice and its tone, the colour roles and the component
            // guidance are the operator's own authoring notes, mirrored
            // nowhere public. An operator who wrote a `dont` entry as a note to
            // their own team must not learn it was public from a stranger
            // quoting it back.
            //
            // So the four categories are named, the exposure is stated as
            // wider than the theme, and the audience is named — all of it
            // BEFORE anything exists. A disclosure shown after the mint informs
            // someone of a decision already taken, which is not a disclosure.
            confirm: {
              title: '$t:admin.ds.share.publishConfirm',
              message: '$t:admin.ds.share.publishMessage',
              // The affirm label avoids every verb the console's read-only sweep
              // forbids — `save`, `set`, `apply`, `edit`, `update`, `reset`,
              // `publish`. "Publish and create the link" tripped it, rightly: a
              // button named for a write looks like an editor. The message says
              // what publishing means; the button says what the click does.
              confirmLabel: '$t:admin.ds.share.createConfirm',
              cancelLabel: '$t:admin.ds.share.keepPrivate',
            },
            action: {
              type: 'fetch',
              method: 'POST',
              url: SHARES_ENDPOINT,
              onSuccess: {
                type: 'toast',
                message: '$t:admin.ds.share.created',
                // ─── THE ONE PLACE THE ADDRESS EVER EXISTS ───────────────
                //
                // `POST` answers with the forwarding address; `GET` never
                // does, and the token behind it is stored only as a digest. So
                // this write is the single moment it can be read, and the
                // message is the address and NOTHING else — a reader copies it,
                // and prose inside the same region would be copied with it.
                //
                // The region is promoted to `role="status"` by the runtime, so
                // it is announced when it fills. What it says beyond the
                // address is said by the toast above and by the label beside
                // it, neither of which is the thing being copied.
                status: { target: SHARE_URL_ID, message: '$response.url' },
                refetch: 'design-system-share-list',
              },
            },
            children: [{ type: 'text', element: 'span', content: '$t:admin.ds.share.create' }],
          } as PageComponent,
        ],
      },
      // ─── WHERE THE ADDRESS LANDS ────────────────────────────────────────
      //
      // Outside the list on purpose. `refetch` re-renders the list the instant
      // after the address is written, which would destroy it; a sibling
      // survives. It is a plain span rather than a read-only input for the
      // reason the read-only bound gives — an `input` is a `textbox`, and a
      // console that acquires one has acquired something that looks like an
      // editor.
      {
        type: 'text',
        element: 'span',
        props: {
          id: SHARE_URL_ID,
          'data-testid': SHARE_URL_ID,
          className: 'text-foreground font-mono text-sm break-all empty:hidden',
        },
      } as PageComponent,
      {
        // ─── ONE BOX, TWO STATES ────────────────────────────────────────────
        //
        // The border moved OUT of the rows list and onto this wrapper, and that
        // is what makes the empty state a box rather than a hairline. A bound
        // list with no rows is emptied by the resolver and then stamped with an
        // inline `min-height:1px;display:inline-block` by the contentless-
        // element rule, which beats any `min-h-*` class an author can write —
        // so a border ON the list drew a 2px line where a panel should be.
        // Bordering the wrapper instead sidesteps it: the wrapper always has a
        // child, so it is never contentless, and the emptied list inside it is
        // an unstyled zero-size node nobody can see.
        //
        // The list keeps its id and its binding untouched — it is the `refetch`
        // target the mint control names, and a gate on it would remove the node
        // that write needs to find.
        type: 'container',
        element: 'div',
        props: { className: 'border-border rounded-md border' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              id: 'design-system-share-list',
              className: 'divide-border list-none divide-y',
            },
            dataSource: { system: { endpoint: SHARES_ENDPOINT, rowsKey: 'items', idKey: 'id' } },
            children: [
              {
                type: 'container',
                element: 'div',
                props: {
                  className: 'flex flex-wrap items-center justify-between gap-3 px-4 py-2.5',
                  'data-design-share': '$record.id',
                },
                children: [
                  // ─── WHAT A READER RECOGNISES A LINK BY ────────────────────
                  //
                  // The URL is the token and the token is not recoverable: it is
                  // returned once, at mint, and stored only as a digest. So the id
                  // is all a row can carry, and it is safe to carry — the list
                  // route publishes `{ id, createdAt }` and nothing else, and an id
                  // is not a credential.
                  //
                  // It is drawn ABBREVIATED rather than whole. A full identifier
                  // beside a revoke button reads as a secret whatever the prose
                  // says. What the reference draws is the last six characters; a
                  // config page has no substring, so this is the head under a width
                  // cap, with the whole value in the title attribute. A true TAIL
                  // needs either a `format` value for it or a published field —
                  // both platform work, neither fakeable here.
                  {
                    type: 'container',
                    element: 'div',
                    props: { className: 'flex min-w-0 items-baseline gap-3' },
                    children: [
                      {
                        type: 'record-field',
                        props: {
                          field: 'id',
                          className: 'text-foreground max-w-[9ch] truncate font-mono text-sm',
                        },
                        format: 'truncate',
                      } as PageComponent,
                    ],
                  },
                  {
                    type: 'container',
                    element: 'div',
                    props: { className: 'flex items-baseline gap-2' },
                    children: [
                      {
                        type: 'text',
                        element: 'span',
                        props: { className: 'text-muted-foreground text-sm' },
                        content: 'created',
                      },
                      {
                        type: 'record-field',
                        props: { field: 'createdAt', className: 'text-foreground-subtle text-sm' },
                        format: 'short-date',
                      } as PageComponent,
                    ],
                  },
                  {
                    type: 'button',
                    variant: 'secondary',
                    visibility: { capability: 'edit-operations' },
                    props: { type: 'button', 'data-testid': 'design-system-share-revoke' },
                    action: {
                      type: 'fetch',
                      method: 'DELETE',
                      url: `${SHARES_ENDPOINT}/$record.id`,
                      onSuccess: {
                        type: 'toast',
                        message: '$t:admin.ds.share.revoked',
                        refetch: 'design-system-share-list',
                      },
                      // ─── A REFUSED REVOKE MUST NOT BE SILENT ──────────────
                      //
                      // Without this key the DELETE's failure response was
                      // discarded: the confirm dialog closed, the row stayed in
                      // the list, and nothing said why. On this control that is
                      // the worst available failure mode — an operator who
                      // revoked a link and saw the dialog close has every reason
                      // to believe the link is dead, and it is not.
                      //
                      // `variant: 'error'` is load-bearing beyond the colour: an
                      // error toast PERSISTS rather than expiring after 5 s
                      // (`runtime/toast-duration.ts`, clause 2 — "a failure the
                      // operator never read is a failure that did not happen").
                      // A success toast for the same event would auto-dismiss,
                      // which on a security control is the same silence wearing
                      // a label.
                      //
                      // The sentence says what did NOT happen and what to do,
                      // because a bare "Revoke failed." leaves the reader to
                      // guess whether the link is live. It is not parameterised
                      // on the response — the toast message interpolates the
                      // record, not the error body — so it states the invariant
                      // instead of the cause.
                      onError: {
                        type: 'toast',
                        variant: 'error',
                        message: '$t:admin.ds.share.revokeFailed',
                      },
                    },
                    confirm: {
                      title: '$t:admin.ds.share.revokeConfirm',
                      message: '$t:admin.ds.share.revokeMessage',
                      confirmLabel: '$t:admin.common.revoke',
                      cancelLabel: '$t:admin.ds.share.keep',
                    },
                    children: [
                      { type: 'text', element: 'span', content: '$t:admin.common.revoke' },
                    ],
                  } as PageComponent,
                ],
              } as PageComponent,
            ],
          },
          // ─── WHAT STANDS IN THE BOX WHEN NOTHING ELSE DOES ────────────────
          //
          // `visibility.record` reads the PAGE's record — the share envelope's
          // own `total` — because the rows binding above cannot answer the
          // question: zero rows render zero rows, and a gate inside a row
          // template is never reached on the pass that would have dropped it.
          //
          // It states the fact and stops. The next action is the control
          // directly above it, two lines away and named for what it does, so a
          // second invitation here would be the same sentence twice.
          {
            type: 'text',
            element: 'p',
            props: {
              className: 'text-foreground-subtle px-4 py-2.5 text-sm',
              'data-testid': 'design-system-share-empty',
            },
            visibility: { record: { field: 'total', eq: 0 } },
            content: '$t:admin.ds.share.none',
          } as PageComponent,
        ],
      },
    ],
  }) as PageComponent

/**
 * Share and export — the one place in the section that hands the system over.
 *
 * ONE home, deliberately. The affordance was a page of its own and is now a
 * section here, because a reader hands a system over AFTER reading what they
 * have, and because two places to do it is two places to keep true.
 *
 * The mint control is the section's only island, and it is one because minting
 * a link is a WRITE. Everything around it is markup: the prose, the two
 * document rows, and the terminal block are all server-rendered, so a reader
 * who only wanted to paste a path pays for no client component.
 *
 * The island renders nothing server-side but a skeleton. A button rendered
 * server-side would be clickable during the window before hydration and the
 * click would go nowhere — an operator pressing "Create share link", seeing
 * nothing, and pressing it again.
 */
const shareAndExport = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      className: 'flex flex-col gap-4',
      'aria-label': '$t:admin.common.shareExport',
      'data-testid': 'design-system-share',
    },
    children: [
      {
        type: 'text',
        element: 'h2',
        props: { className: 'text-lg font-semibold tracking-tight' },
        content: '$t:admin.common.shareExport',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_MD} text-md leading-relaxed` },
        content: '$t:admin.ds.share.blurb',
      },
      // TWO COLUMNS from `md` up: what the system is handed over AS on the
      // left, and who currently holds it on the right. Stacked, the addresses
      // and the terminal line pushed the active links most of a screen below
      // the heading that names them, and an operator checking who can read
      // their system had to scroll past two things they were not asking about.
      {
        type: 'container',
        element: 'div',
        props: { className: 'grid grid-cols-1 items-start gap-6 md:grid-cols-2' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex min-w-0 flex-col gap-4' },
            children: [
              {
                type: 'container',
                element: 'div',
                props: { className: 'border-border rounded-md border' },
                children: [
                  exportRow({
                    name: '$t:admin.ds.share.brief',
                    path: MARKDOWN_EXPORT,
                    nameTestId: 'design-system-export-markdown',
                    pathTestId: 'design-system-overview-export',
                  }),
                  exportRow({
                    name: '$t:admin.ds.share.tokens',
                    path: JSON_EXPORT,
                    nameTestId: 'design-system-export-json',
                    pathTestId: 'design-system-export-json-path',
                  }),
                ],
              },
              terminalBlock(),
            ],
          } as PageComponent,
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex min-w-0 flex-col' },
            children: [sharePanel()],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  }) as PageComponent

export default consolePage({
  id: 'design-system-overview',
  path: '/design-system',
  title: '$t:admin.ds.overview.specimenTitle',
  page: {
    // ─── THE PAGE RECORD IS THE SHARE ENVELOPE ──────────────────────────────
    //
    // It is here for exactly one gate: whether this app has any active share
    // link, which decides between the list of links and the empty box that
    // stands in for it. No rows binding can answer that — zero rows render zero
    // rows and leave nothing for a row gate to test — and ONLY a page may carry
    // a record: `applyPageLevelRecordBinding` reads `page.dataSource` and
    // nothing else, so the same binding one level down would bind ROWS instead.
    // With no `recordKey` the record is the whole body, so `total` is readable.
    //
    // It used to be the coverage envelope, for a tally strip that has since
    // been deleted; a page has one record and nothing else now wants it.
    //
    // The two rows bindings underneath are unaffected: a row template's
    // `$record.*` survives the page record, because the collection substitution
    // leaves the children of a `dataSource`-bearing node alone. That is what
    // lets one page carry a record AND two rows bindings.
    dataSource: { system: { endpoint: SHARES_ENDPOINT, idKey: 'total' } },
  },
  shell: { breadcrumb: designSystemBreadcrumb('design-system', '$t:admin.common.designSystem') },
  body: [
    designPageHeader('$t:admin.common.designSystem'),
    pagesList(),
    coverageLedger(),
    shareAndExport(),
  ],
}) satisfies PageConfig
