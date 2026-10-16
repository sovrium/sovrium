/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// One link's deep-dive (`/links/:slug`), split out of `links.ts`.

import { CARD_SURFACE } from '../../components/card'
import { consolePage } from '../../components/data-page'
import { dataTable, recordSheet } from '../../components/data-table-blocks'
import {
  ANALYTICS_CAMPAIGNS_ENDPOINT,
  ANALYTICS_DEVICES_ENDPOINT,
  ANALYTICS_EVENTS_ENDPOINT,
  ANALYTICS_OVERVIEW_ENDPOINT,
  ANALYTICS_REFERRERS_ENDPOINT,
  LINK_DETAIL_ENDPOINT,
  LINKS_ENDPOINT,
} from '../../system-sources'
import {
  DEFINITION_DRAWER_ID,
  ONE_LINK_QUERY,
  ONE_LINK_SCAN_QUERY,
  WINDOW,
  kpiTile,
  panelSection,
  periodRail,
  systemGrid,
  trendChart,
  windowCopy,
} from './links-shared'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

// ─── One link's deep-dive ───────────────────────────────────────────────────

/**
 * The definition panel: the catalog row for this one slug.
 *
 * Bound to the catalog narrowed by `?q={slug}` rather than read off the
 * page-level record, for one reason worth keeping: `state` comes back DERIVED by
 * the resolver — the same function the redirect handler uses — so this panel
 * cannot report `active` for a link whose visitors are getting a 410, which a
 * second reading of the lifecycle rules here eventually would.
 */
const definitionPanel = (): PageComponent =>
  dataTable({
    props: { id: 'admin-link-definition', 'aria-label': '$t:admin.links.definition.region' },
    dataSource: {
      system: {
        endpoint: LINKS_ENDPOINT,
        rowsKey: 'items',
        idKey: 'slug',
        query: { q: '$param.slug' },
      },
    },
    // The one row IS the affordance: clicking it opens the half of the
    // definition this page cannot print — the target list and the campaign
    // parameters. `idKey: 'slug'` makes the row id the slug, which is exactly
    // what the drawer's detail endpoint wants in its `:slug` slot.
    onRowClick: { action: 'openSheet', component: DEFINITION_DRAWER_ID },
    columns: [
      { field: 'shortUrl', label: '$t:admin.links.shortLink' },
      { field: 'destination', label: '$t:admin.links.destination' },
      {
        field: 'source',
        label: '$t:admin.common.source',
        valueLabels: {
          config: '$t:admin.links.source.config',
          db: '$t:admin.links.source.console',
        },
      },
      { field: 'state', label: '$t:admin.common.state' },
      { field: 'validFrom', label: '$t:admin.links.starts', format: 'datetime' },
      { field: 'validUntil', label: '$t:admin.common.expires', format: 'datetime' },
    ],
    emptyMessage: '$t:admin.links.undeclared',
  }) as PageComponent

/**
 * The full definition, as a read-only drawer over `GET /api/admin/links/:slug`.
 *
 * Everything the catalog row omits for width: every candidate destination with
 * its weight, the five campaign parameters, the operator notes, the click cap
 * and the expired-destination fallback.
 *
 * `renderAs` is what makes it readable. `targets` is an array of objects and
 * `utm` is a nested object, and BOTH are unprintable anywhere else in config —
 * see {@link DEFINITION_DRAWER_ID}. `canEdit: false` is not a choice: a system
 * detail source has no records table to PATCH, so the drawer is read-only by
 * construction, and the writes live under it on the page.
 *
 * No `password` in any cell, because there is none in the payload: the endpoint
 * does not emit one, which is what makes the redaction real rather than
 * cosmetic — masking in the UI would still ship the value to the browser, the
 * proxy and the error tracker.
 */
const definitionDrawer = (): PageComponent =>
  recordSheet({
    id: DEFINITION_DRAWER_ID,
    // No `role`, so this is a `dialog` — the default, and the only one of the
    // two surfaces that carries a dismiss contract. A `region` is a LANDMARK:
    // it has no Escape handling and no focus management by design, so the
    // drawer opened over a row could only be closed by re-navigating. All four
    // console record drawers are dialogs.
    // A LITERAL, not a `$t:` token. `props.title` is threaded into
    // `data-island-props` verbatim and the island is not on the translation
    // path, so a token here reaches the DOM as its own text — the same trap the
    // tab-label count badges hit one component over.
    props: { title: '$t:admin.links.definition' },
    dataSource: { system: { endpoint: LINK_DETAIL_ENDPOINT, param: 'slug', recordKey: 'link' } },
    canEdit: false,
    recordFields: [
      { name: 'shortUrl', type: 'single-line-text', label: '$t:admin.links.shortLink' },
      { name: 'targets', type: 'json', label: '$t:admin.links.targets', renderAs: 'list' },
      { name: 'utm', type: 'json', label: '$t:admin.links.utm', renderAs: 'key-value' },
      // No `renderAs`: a string array's default `String(value)` coercion is the
      // comma-separated reading an operator wants, and an EMPTY one becomes an
      // empty line. `renderAs: 'json'` printed a literal `[]` for a link with no
      // tags, which reads as a value rather than as an absence.
      { name: 'tags', type: 'single-line-text', label: '$t:admin.links.tags' },
      { name: 'notes', type: 'long-text', label: '$t:admin.links.notes' },
      { name: 'maxClicks', type: 'single-line-text', label: '$t:admin.links.clickCap' },
      { name: 'expiredTo', type: 'single-line-text', label: '$t:admin.links.whenExpired' },
    ],
  }) as PageComponent

/**
 * The QR preview and its download, both pointing at the PUBLIC image route.
 *
 * `$record.qrUrl` comes from the page-level record rather than being composed
 * from the slug, so there is one authority on where a link's QR lives and no
 * second renderer to drift from it.
 *
 * The DOWNLOAD is absolute (`$app.origin` + the path) and the preview is not,
 * and that asymmetry is load-bearing rather than sloppy. A mount-local `href`
 * is rewritten onto the console's base at boot, so a bare `/l/…` download link
 * would resolve to `/_admin/l/…` and 404 — the `$app.origin` prefix is the
 * documented way a preset page points OUT of the console. `src` is not a
 * navigation key, so the preview is left alone and stays root-relative.
 *
 * Exactly one symbol inside the region, deliberately: the download is a plain
 * text link rather than an icon button, so the preview is unambiguously the
 * thing an operator is looking at.
 *
 * ─── THE PREVIEW IS THE `qr-code` COMPONENT, NOT AN `<img>` ────────────────
 *
 * It was an `image` pointing at `$record.qrUrl`, and the argument for that was
 * single-authority: one place decides where a link's QR lives. What it cost was
 * three things the component gives for free. `qr-code` is SSR-only — the
 * renderer emits no `data-island` marker — so the symbol is in the first
 * response, costs no request, survives a browser with scripting off, and prints
 * from the browser's own dialog, which is most of what a printed QR is for. And
 * it encodes `/l/<slug>?qr=1`, the marker that makes a scan countable apart from
 * a click; the raw image route carries no such thing, so every scan was
 * indistinguishable from a paste.
 *
 * The DOWNLOAD still reads `$record.qrUrl`, so the authority argument survives
 * where it actually bites — the file an operator saves and sends to a printer is
 * the one the platform serves.
 */
const qrRegion = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.links.qr.region',
      className: `${CARD_SURFACE} flex w-fit flex-col items-center gap-3 p-4`,
    },
    children: [
      {
        type: 'qr-code',
        link: '$param.slug',
        props: {
          'aria-label': '$t:admin.links.qrFor /l/$param.slug',
          className: 'h-40 w-40',
        },
      },
      {
        type: 'link',
        content: '$t:admin.links.qr.download',
        props: {
          href: '$app.origin$record.qrUrl',
          download: '$record.slug-qr.svg',
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-muted-foreground hover:text-foreground text-sm underline',
        },
      },
    ],
  }) as PageComponent

// ─── The write half, and the exact shape config can express ────────────────
//
// The console has almost no write surfaces. This is one, and it is deliberately
// the narrowest honest version of the canvas's Edit drawer rather than a
// half-working copy of it.
//
// ─── WHY THERE IS NO PREFILLED EDIT FORM ───────────────────────────────────
//
// `renderEndpointControl`
// (src/presentation/render/elements/crud-form/endpoint-form-renderer.tsx:80)
// reads exactly three keys off a field: `field`, `control` and `options`. It
// ignores `defaultValue`, `placeholder`, `description`, `required`, `readOnly`
// and `optionsSource`. So an endpoint-bound `form` renders EMPTY, always —
// measured with a literal `defaultValue: 'LITERAL-X'`, which did not reach the
// input either, so this is not a `$record` substitution problem. An edit form
// whose every field starts blank is not an edit form: `PATCH` is sparse, but the
// runtime submits every input including the untouched ones, so saving would
// blank whatever the operator did not retype.
//
// What CAN be authored is a form over the fields the operator is retyping
// anyway. Re-pointing a link is exactly that gesture — one required field, a
// value that is always new — so it ships, and the rest of the edit surface waits
// on prefill support in that renderer.
//
// ─── THE TWO GATES, AND WHY THEY NEST ──────────────────────────────────────
//
// `visibility.record` names ONE field and has no conjunction, and Disable needs
// "db-sourced AND currently active". Two gates nest instead: `source` on the
// outer container, `state` on the inner one. The page-level record is what makes
// that possible at all — the same record the heading reads — and it is why these
// controls live here rather than on a directory row, where `visibleWhen` is also
// a single condition and there is no outer scope to put the second one in.

/**
 * Re-point the link: `PATCH /api/admin/links/:slug` with one field.
 *
 * `$param.slug` resolves into the URL server-side (the route-param pass walks
 * every string leaf), so the form posts to the link it is sitting on.
 *
 * `control: 'url'` gives the browser's own validation before anything is sent;
 * an empty submit still reaches the endpoint and comes back **400 `Invalid link
 * payload`**, which the `onError` toast reports rather than swallowing.
 */
const repointForm = (): PageComponent =>
  ({
    type: 'form',
    props: {
      id: 'admin-link-repoint-form',
      'aria-label': '$t:admin.links.manage.repoint',
      // The form's own card prestyle is dropped here, the opposite way round
      // from the create form: this one sits INSIDE the Manage frame, beside the
      // state buttons, and its own border would draw a box around one field in
      // the middle of a section that is already a box. `resolveClasses` merges
      // through `tailwind-merge`, so a same-property author class wins over the
      // recipe.
      className: 'border-0 bg-transparent p-0',
    },
    endpoint: {
      url: `${LINKS_ENDPOINT}/$param.slug`,
      method: 'PATCH',
      submitLabel: '$t:admin.links.repoint.submit',
      onSuccess: {
        type: 'toast',
        variant: 'success',
        message: '$t:admin.links.repoint.done',
        refetch: 'admin-link-definition',
      },
      onError: {
        type: 'toast',
        variant: 'destructive',
        message: '$t:admin.links.repoint.failed',
      },
    },
    fields: [{ field: 'destination', control: 'url', label: '$t:admin.links.newDestination' }],
  }) as PageComponent

/**
 * One state button — Disable or Enable — gated on the state it reverses.
 *
 * Disable confirms and Enable does not, which is the same asymmetry the users
 * directory draws: confirmation is reserved for the direction that removes
 * access. Both labels are spelled out because the confirm gate's own defaults
 * are French.
 */
const stateButton = (config: {
  readonly label: string
  readonly state: string
  readonly path: string
  readonly message: string
  readonly confirm?: Readonly<Record<string, string>>
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: 'state', eq: config.state } },
    children: [
      {
        type: 'button',
        label: config.label,
        variant: 'secondary',
        ...(config.confirm === undefined ? {} : { confirm: config.confirm }),
        action: {
          type: 'fetch',
          method: 'POST',
          url: `${LINKS_ENDPOINT}/$param.slug/${config.path}`,
          onSuccess: {
            type: 'toast',
            message: config.message,
            refetch: 'admin-link-definition',
          },
          onError: { type: 'toast', variant: 'destructive', message: '$t:admin.links.unchanged' },
        },
      },
    ],
  }) as PageComponent

/** The whole write block, shown only for a link the console may write. */
const manageSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { record: { field: 'source', eq: 'db' }, capability: 'edit-operations' },
    props: {
      'aria-label': '$t:admin.links.manage.region',
      className: `${CARD_SURFACE} flex flex-col gap-4 p-4`,
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.links.manage.heading',
      },
      repointForm(),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-center gap-2' },
        children: [
          stateButton({
            label: '$t:admin.links.disable',
            state: 'active',
            path: 'disable',
            message: '$t:admin.links.disabled',
            confirm: {
              title: '$t:admin.links.disableConfirm',
              message: '$t:admin.links.disableMessage',
              role: 'alertdialog',
              confirmLabel: '$t:admin.links.disableLink',
              cancelLabel: '$t:admin.common.cancel',
            },
          }),
          stateButton({
            label: '$t:admin.links.enable',
            state: 'disabled',
            path: 'enable',
            message: '$t:admin.links.enabled',
          }),
          {
            type: 'button',
            label: '$t:admin.common.delete',
            variant: 'destructive',
            confirm: {
              title: '$t:admin.links.deleteConfirm',
              message: '$t:admin.links.deleteMessage',
              role: 'alertdialog',
              confirmLabel: '$t:admin.links.delete',
              cancelLabel: '$t:admin.common.cancel',
            },
            action: {
              type: 'fetch',
              method: 'DELETE',
              url: `${LINKS_ENDPOINT}/$param.slug`,
              // Back to the directory: the page this button is on stops having a
              // subject the moment it succeeds.
              onSuccess: { type: 'toast', message: '$t:admin.links.deleted' },
              onError: {
                type: 'toast',
                variant: 'destructive',
                message: '$t:admin.links.notDeleted',
              },
            },
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The counterpart note for a CONFIG-declared link.
 *
 * It appears exactly where the write block would be, and says where the link is
 * authored instead of leaving a silent hole. `POST`, `PATCH` and `DELETE`
 * naming a config slug answer 409 `LINK_IS_CONFIG_DECLARED`, so no control is
 * painted at all — the note is the honest substitute for one.
 */
const configSourceNote = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { record: { field: 'source', eq: 'config' } },
    props: {
      'aria-label': '$t:admin.links.manage.region',
      className: `${CARD_SURFACE} flex flex-col gap-2 p-4`,
    },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.links.manage.config.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-muted-foreground max-w-2xl text-md leading-relaxed' },
        content: '$t:admin.links.manage.config.body',
      },
    ],
  }) as PageComponent

/** Visits and share, the shape every breakdown reader returns. */
const BREAKDOWN_COLUMNS = [
  { field: 'name', label: '$t:admin.common.name' },
  { field: 'count', label: '$t:admin.analytics.clicks', align: 'right' },
  // The endpoint already returns a scaled percentage (33.33, not 0.3333) and
  // there is no formatter that leaves an already-scaled number alone — so the
  // unit lives in the header rather than being applied twice to the cell.
  { field: 'percentage', label: '$t:admin.analytics.share', align: 'right' },
]

/** The three breakdowns, each from a reader that already existed. */
const breakdowns = (): ReadonlyArray<PageComponent> => [
  systemGrid({
    label: '$t:admin.links.referrers.region',
    endpoint: ANALYTICS_REFERRERS_ENDPOINT,
    rowsKey: 'referrers',
    idKey: 'domain',
    columns: [
      { field: 'domain', label: '$t:admin.analytics.referrer' },
      { field: 'pageViews', label: '$t:admin.analytics.clicks', align: 'right' },
      { field: 'uniqueVisitors', label: '$t:admin.analytics.visitors', align: 'right' },
    ],
    emptyMessage: '$t:admin.analytics.noReferrers',
    query: ONE_LINK_QUERY,
  }),
  systemGrid({
    label: '$t:admin.links.devices.region',
    endpoint: ANALYTICS_DEVICES_ENDPOINT,
    rowsKey: 'deviceTypes',
    idKey: 'name',
    columns: BREAKDOWN_COLUMNS,
    emptyMessage: '$t:admin.links.noDevices',
    query: ONE_LINK_QUERY,
  }),
  systemGrid({
    label: '$t:admin.links.campaigns.region',
    endpoint: ANALYTICS_CAMPAIGNS_ENDPOINT,
    rowsKey: 'campaigns',
    idKey: 'campaign',
    columns: [
      { field: 'campaign', label: '$t:admin.analytics.campaign' },
      { field: 'source', label: '$t:admin.common.source' },
      { field: 'medium', label: '$t:admin.analytics.medium' },
      { field: 'pageViews', label: '$t:admin.analytics.clicks', align: 'right' },
    ],
    emptyMessage: '$t:admin.analytics.noCampaigns',
    query: ONE_LINK_QUERY,
  }),
]

/**
 * The raw click log for this link.
 *
 * Field names are `snake_case` because THIS reader's projection is snake_case,
 * unlike every other admin endpoint the console binds. That inconsistency is
 * recorded rather than papered over: camelCase bindings render blank cells,
 * which is exactly how it was found.
 */
const clickLog = (): PageComponent =>
  systemGrid({
    label: '$t:admin.links.clickLog.region',
    endpoint: ANALYTICS_EVENTS_ENDPOINT,
    rowsKey: 'events',
    idKey: 'id',
    columns: [
      { field: 'timestamp', label: '$t:admin.analytics.recorded', format: 'datetime' },
      { field: 'event_type', label: '$t:admin.common.type' },
      { field: 'session_hash', label: '$t:admin.analytics.session' },
    ],
    emptyMessage: '$t:admin.links.noClicks',
    query: ONE_LINK_QUERY,
  })

/** Everything on the deep-dive that needs a reachable `/api/analytics/*`. */
const detailAnalytics = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { declares: 'analytics' },
    props: { className: 'flex flex-col gap-6' },
    children: [
      periodRail('/links/$param.slug'),
      {
        type: 'container',
        element: 'section',
        props: {
          className: 'flex flex-col gap-3 pt-2',
          'aria-label': '$t:admin.links.metrics.region',
        },
        children: [
          windowCopy(),
          {
            // FOUR tiles, so the breakpoints change with them: three across a
            // tablet leaves a single orphan on the second row, where two-then-
            // two pairs Clicks with Scans — the two ways in — above the two
            // audience figures.
            type: 'container',
            props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' },
            children: [
              kpiTile(
                '$t:admin.analytics.clicks',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.pageViews',
                ONE_LINK_QUERY
              ),
              // Scans sits immediately beside Clicks because the pair only
              // means anything read together: either alone understates the
              // link. Same `kpiFormat` as its neighbour, so nothing about the
              // two invites a reader to compare units rather than values, and
              // a window with no scans reads `0` — measured, not blank: the
              // endpoint answers `summary.pageViews: 0` for a slug nobody has
              // scanned, which is the honest claim. See `ONE_LINK_SCAN_QUERY`
              // for why this is two figures and not one sum.
              kpiTile(
                '$t:admin.analytics.scans',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.pageViews',
                ONE_LINK_SCAN_QUERY
              ),
              kpiTile(
                '$t:admin.analytics.uniqueVisitors',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.uniqueVisitors',
                ONE_LINK_QUERY
              ),
              kpiTile(
                '$t:admin.analytics.sessions',
                ANALYTICS_OVERVIEW_ENDPOINT,
                'summary.sessions',
                ONE_LINK_QUERY
              ),
            ],
          },
        ],
      },
      trendChart(ONE_LINK_QUERY),
      panelSection('$t:admin.links.audience.heading', [
        {
          type: 'container',
          props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3' },
          children: breakdowns(),
        } as PageComponent,
      ]),
      panelSection('$t:admin.links.clickLog.heading', [clickLog()]),
    ],
  }) as PageComponent

/**
 * One link's deep-dive.
 *
 * The page-level `{ system }` binding is what names it: `recordKey: 'link'`
 * against `GET /api/admin/links/:slug`, resolved on the RENDER path with the
 * caller's identity borrowed, so the heading is in the first response and a slug
 * naming nothing is the page's own 404 rather than a document full of tokens.
 *
 * It renders the link's IDENTITY as VALUES and never as a config document — no
 * YAML view, no "view source", no diff, no history. Showing a runtime object's
 * identity is not a third introspection surface under [internal ref] A1, which bounds
 * surfaces whose subject is the configuration DOCUMENT.
 *
 * The write controls under it are painted for a DB-sourced link only, and are
 * the console's first real write surface. A config-declared slug gets a note
 * naming the file instead: `POST`, `PATCH` and `DELETE` answer 409
 * `LINK_IS_CONFIG_DECLARED` for one, and a control the backend refuses is a
 * defect rather than a cosmetic issue.
 *
 * And no `password`, in any cell or any payload the page fetches — the catalog
 * and detail endpoints do not emit one, which is what makes the redaction real
 * rather than cosmetic: masking in the UI would still ship the value to the
 * browser, the proxy and the error tracker.
 */
export const detail = consolePage({
  id: 'dashboard-data-link-detail',
  path: '/links/:slug',
  title: '$t:admin.meta.links',
  heading: [
    '$record.title|$record.slug', // "clicks and scans", not "clicks": the figures below are now two, and
    // a blurb naming one of them tells a reader the page is about half of
    // what it shows — the half that happens to exclude everyone who
    // arrived through the printed code.
    '$t:admin.links.detailBlurb',
  ],
  page: {
    requires: ['links'],
    window: WINDOW,
    dataSource: { system: { endpoint: LINK_DETAIL_ENDPOINT, param: 'slug', recordKey: 'link' } },
  },
  shell: { breadcrumb: { links: '$t:admin.crumb.links' } },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-6 pt-2' },
      children: [
        panelSection('$t:admin.links.definition.heading', [
          definitionPanel(),
          qrRegion(),
          definitionDrawer(),
        ]),
        manageSection(),
        configSourceNote(),
        detailAnalytics(),
      ],
    } as PageComponent,
  ],
}) satisfies PageConfig

/**
 * Both pages, directory first.
 *
 * Order is route precedence, and it is load-bearing: matching takes the first
 * pattern that matches, and there is no static-over-dynamic rule, so a
 * `/links/:slug` listed ahead of `/links` would still leave `/links` reachable
 * (one segment vs two) — but keeping the literal first is the convention every
 * other multi-page surface here follows, and it is one less thing to re-derive.
 */
