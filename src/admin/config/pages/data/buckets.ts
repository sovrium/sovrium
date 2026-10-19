/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Files — the objects stored in each bucket, one browser per bucket.
//
// THREE pages, like Conversations:
//
//   `/files`          the bare collection, which 302s to the first bucket.
//   `/files/system`   the built-in bucket's browser, which also lists every
//                       file a record attaches — whichever bucket holds it —
//                       with the bucket, table, record and field it belongs to.
//   `/files/:bucket`  a declared bucket's browser: usage, upload, file grid.
//
// ─── WHY `system` IS ITS OWN PAGE ──────────────────────────────────────────
//
// The same reason as `/agents/system`, plus one: the blurb has to say what the
// built-in bucket IS, AND its grid carries four provenance columns no declared
// bucket's listing fills. A declared bucket showing four always-empty columns
// would be four columns of noise. Config cannot branch a body on a route
// parameter, so route ORDER does it: the literal page is listed before the
// `:bucket` page, `findMatchingRoute` takes the first match, and reversing the
// two silently drops both the sentence and the columns.
//
// ─── THERE IS ALWAYS A FIRST BUCKET ────────────────────────────────────────
//
// The bucket list always leads with the built-in `system` bucket, then every
// bucket the operator declares.
// So the directory page below is not an empty state and does not pretend to be
// one: it is the honest DEGRADATION path the redirect resolver documents, shown
// only when the list read itself fails. A failed read must cost the redirect,
// never the page.
//
// ─── WHAT MADE THIS AUTHORABLE ─────────────────────────────────────────────
//
// Only one thing, and it is small: `$param` substitution reaching every string
// leaf rather than a rows endpoint alone. This surface WRITES — it interpolates
// the selected bucket into an upload target and into per-row download and delete
// URLs — and none of those is a data source, so each used to carry the literal
// text `$param.bucket` and the browser sent it back as a path segment.
//
// Every endpoint here is under `/api/`, which the mount's href walk leaves
// alone: the JSON API is mounted once for the whole server, outside the
// console's base, so these addresses are already full and must not gain
// `/_admin`.

import { sectionCard } from '../../components/dashboard-blocks'
import { consolePage, fillHost, tabPanel, toolbarRow } from '../../components/data-page'
import { dataTable, STATUS_BADGE, toolbarSearch } from '../../components/data-table-blocks'
import { lineTabs } from '../../components/tabs-line'
import { BUCKETS_ENDPOINT, BUCKETS_OVERVIEW_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The file grid's id, referenced by the upload control's `onSuccess.refetch`.
 *
 * Named once: a refetch naming a grid that does not exist is an upload that
 * succeeds and leaves the operator staring at a list without their file in it,
 * with no error anywhere.
 */
const FILES_GRID_ID = 'admin-bucket-files-grid'

/** The Files crumb label, shared by both pages of the surface. */
const BREADCRUMB = { files: '$t:admin.crumb.files' } as const

/**
 * The admin file endpoints for the bucket the URL names.
 *
 * `$param.bucket` is substituted into every string leaf of the page before the
 * data-source resolver runs, so an `uploadAction` and a row action's `url` reach
 * the selected bucket exactly as a rows endpoint does.
 */
const ADMIN_FILES_ENDPOINT = '/api/admin/buckets/$param.bucket/files'

/**
 * The PUBLIC file route both row actions target — deliberately not an
 * `/api/admin/*` address.
 *
 * Its `:filename{.+}` pattern matches multi-segment storage keys, so
 * `$record.key` resolves for a path-prefixed file. `$record.*` is a different
 * grammar from `$param.*` and is filled client-side from the clicked row, so
 * the two compose in one string without either seeing the other.
 */
const PUBLIC_FILE_URL = '/api/buckets/$param.bucket/files/$record.key'

/** The built-in bucket's admin file list — a literal page, so no `$param`. */
const SYSTEM_FILES_ENDPOINT = '/api/admin/buckets/system/files'

/**
 * The public file route for a row of the SYSTEM listing.
 *
 * `$record.bucket`, not `system`: that listing includes files a record attaches
 * from a declared bucket, and the file route refuses a key whose recorded
 * bucket does not match the one it is addressed through. Every row of this
 * listing carries its `bucket` — its own uploads record `system`, a linked file
 * records the bucket that holds it.
 */
const SYSTEM_PUBLIC_FILE_URL = '/api/buckets/$record.bucket/files/$record.key'

/**
 * The usage tile: this listing's total size, formatted as a byte count.
 *
 * It reads the SAME endpoint the file grid reads, whose `totalBytes` is the
 * `SUM(size)` of the listing — invariant across the grid's type filter, search
 * and pagination — so the figure always describes the files on this page and
 * the two can never disagree. On a declared bucket that is the bucket's own
 * usage; on `/files/system` it also counts the record attachments the
 * listing gathers from declared buckets, which is why the label says "Total
 * size" rather than "Storage used": the page's total, not a partition of the
 * store.
 *
 * Until 2026-09-26 the page's ONLY tile read the instance-wide overview
 * total, so every bucket showed the same figure. That figure is kept, beside
 * this one rather than instead of it: storage is capped per deployment
 * (`STORAGE_MAX_TOTAL_SIZE`), never per bucket, so what an upload is measured
 * against is the instance total — see {@link instanceKpi}.
 */
const usageKpi = (endpoint: string): PageComponent =>
  sectionCard({
    label: '$t:admin.buckets.totalSize',
    endpoint,
    valuePath: 'totalBytes',
    kpiFormat: { type: 'bytes' },
  })

/**
 * The instance total: every byte the storage backend holds, across all
 * buckets. The context the bucket's own figure needs, because the only cap an
 * upload can hit is deployment-wide.
 */
const instanceKpi = (): PageComponent =>
  sectionCard({
    label: '$t:admin.buckets.all',
    endpoint: BUCKETS_OVERVIEW_ENDPOINT,
    valuePath: 'totals.totalBytes',
    kpiFormat: { type: 'bytes' },
  })

/**
 * The two usage tiles side by side — this listing first, the instance second.
 * Two columns at every width: a byte count is short, and stacking them at
 * 375px would push the upload control and the grid a whole tile further down.
 */
const usageRow = (endpoint: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'grid grid-cols-2 gap-4' },
    children: [usageKpi(endpoint), instanceKpi()],
  }) as PageComponent

/**
 * The upload control: POSTs the picked file as `multipart/form-data` to this
 * bucket, then re-queries the sibling grid so the file appears without a reload.
 *
 * `label` sits in `props` and nowhere else. It is the ONE control field the
 * file-upload renderer reads from `props` alone, while its siblings fall back
 * through the component level — and the component-level spelling is not declared
 * on `file-upload`, so decode drops it and the control ships unlabelled.
 */
const uploadControl = (endpoint: string): PageComponent =>
  ({
    type: 'file-upload',
    // A read-only operator is not offered an upload at all — absent, not
    // disabled; the files stay readable in the grid below.
    visibility: { capability: 'edit-operations' },
    props: {
      id: 'admin-bucket-upload',
      'aria-label': '$t:admin.buckets.upload.region',
      label: '$t:admin.buckets.add',
      // A tighter drop zone than the default: the list below it is the page,
      // and under the usage tiles and the Layout strip a laptop screen has no
      // height to spare above the list's three-row floor, now under a painted
      // page title too.
      className: '[&_[data-slot=empty]]:gap-1 [&_[data-slot=empty]]:p-3',
    },
    dropZone: true,
    // No `accept`, no `maxFileSize`, no `maxFiles`: one picked file is the
    // default, and the engine gives the control its bucket's types and size
    // cap — named in words in the drop zone — because the page is one config
    // for every bucket and cannot state a rule of its own.
    uploadAction: endpoint,
    onSuccess: {
      type: 'toast',
      variant: 'success',
      message: '$t:admin.buckets.added',
      refetch: FILES_GRID_ID,
    },
    // `{file}` names the file that did not go up; its chip stays, marked
    // failed, with Retry and Remove.
    onError: {
      type: 'toast',
      variant: 'destructive',
      message: '$t:admin.buckets.upload.failed',
    },
  }) as PageComponent

/**
 * Whether THIS bucket is public, read from its row of the bucket list — the
 * line under the upload control.
 *
 * There is no single-bucket read, so the row is picked the way the decision
 * register picks its document: the container expands every bucket of the list,
 * and `visibility.record` against `$param.bucket` keeps the one the URL names.
 * The route-param pass has made that literal against literal by expansion time.
 *
 * The types and the size cap are NOT repeated here: the drop zone above
 * derives its hint from the same bucket's rules ("PDF, images · 20 MB each"),
 * and a second line printing the raw MIME types said the same thing twice, the
 * second time in the server's words. A private bucket draws nothing at all.
 */
const bucketRules = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    // `contents list-none`: the expansion wraps each surviving row in a
    // synthesised `<li>`, which would otherwise draw a bullet. That `<li>` is
    // a flex item of the column, so on a bucket with nothing to say it would
    // still cost the column a gap; it is hidden when its line came out empty.
    props: { className: 'contents list-none [&>li:has(>:empty)]:hidden' },
    dataSource: { system: { endpoint: BUCKETS_ENDPOINT, rowsKey: 'items', idKey: 'name' } },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          'data-testid': 'admin-bucket-rules',
          className:
            'text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 text-sm',
        },
        visibility: { record: { field: 'name', eq: '$param.bucket' } },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { 'data-testid': 'admin-bucket-public', className: STATUS_BADGE.quiet.neutral },
            content: '$t:admin.buckets.public',
            visibility: { record: { field: 'public', eq: true } },
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The per-row controls: Download, then Delete.
 *
 * The confirm gate is the OBJECT form, not the bare string, for two reasons. It
 * states what is destroyed and that it is irreversible, rather than asking an
 * abstract question — this grid routinely shows near-identical rows. And it sets
 * both button labels explicitly: the confirm-gate runtime defaults them to
 * French, which would otherwise drop French into an English operator console.
 */
const fileRowActions = (url: string, deleteMessage: string) =>
  ({
    type: 'actions',
    label: '',
    actions: [
      {
        label: '$t:admin.buckets.download',
        icon: 'download',
        action: {
          type: 'fetch',
          mode: 'download',
          url,
          filename: '$record.filename',
        },
      },
      {
        label: '$t:admin.common.delete',
        action: { type: 'fetch', method: 'DELETE', url },
        confirm: {
          title: '$t:admin.buckets.deleteConfirm',
          message: deleteMessage,
          confirmLabel: '$t:admin.buckets.deleteFile',
          cancelLabel: '$t:admin.common.cancel',
        },
      },
    ],
  }) as const

/**
 * The file grid, bound to this bucket's admin file list.
 *
 * The `search` BLOCK is what renders the searchbox — `toolbar.search` alone does
 * not, which is the quiet way to ship a page whose copy advertises a control it
 * never painted.
 */
/**
 * The provenance columns only the SYSTEM listing fills: where a file lives, and
 * which record, through which field, attaches it.
 *
 * `sortable: false` on all four: the listing sorts server-side on
 * `createdAt`, `size` and `filename` alone, so a sortable header here would
 * paint an arrow that asks the endpoint for an order it refuses. A file the
 * system bucket stores for nobody has an empty Table, Record and Field — that
 * is the honest reading, not a gap.
 */
const PROVENANCE_COLUMNS = [
  // Each reads by the name people know it under — the bucket, table and field
  // labels the listing carries beside their ids.
  { field: 'bucketLabel', label: '$t:admin.buckets.bucket', sortable: false },
  { field: 'tableLabel', label: '$t:admin.common.table', sortable: false },
  // The record by the name its sheet heads itself with; `recordId` stays its address.
  { field: 'recordLabel', label: '$t:admin.common.record', sortable: false },
  { field: 'fieldLabel', label: '$t:admin.buckets.field', sortable: false },
] as const

/** What differs between the system bucket's grid and a declared bucket's. */
interface FilesGridVariant {
  readonly endpoint: string
  readonly fileUrl: string
  readonly provenance: boolean
  readonly deleteMessage: string
  readonly emptyMessage: string
  /** Draw the bucket's upload rules and public state under the upload control. */
  readonly rules: boolean
}

const DECLARED_GRID: FilesGridVariant = {
  endpoint: ADMIN_FILES_ENDPOINT,
  fileUrl: PUBLIC_FILE_URL,
  provenance: false,
  deleteMessage: '$t:admin.buckets.deleteMessage',
  emptyMessage: '$t:admin.buckets.noFiles',
  rules: true,
}

/**
 * The system bucket's grid. Its delete confirmation says the one thing that is
 * different here: most of these rows are attached to a record, and deleting
 * the file does not clear the record's field — the record keeps a reference to
 * a file that is gone. Its empty state names where files come from, since an
 * operator can reach this page before any record holds one.
 */
const SYSTEM_GRID: FilesGridVariant = {
  endpoint: SYSTEM_FILES_ENDPOINT,
  fileUrl: SYSTEM_PUBLIC_FILE_URL,
  provenance: true,
  deleteMessage: '$t:admin.buckets.deleteAttached',
  emptyMessage: '$t:admin.buckets.emptyFiles',
  // The built-in bucket declares no rule and is never public.
  rules: false,
}

/**
 * What a file IS, in a reader's words: `PDF`, `PNG image`, `Word document`.
 *
 * A render-only relabel of the stored media type, keyed by the types a bucket
 * commonly holds. A type with no entry prints as stored, so nothing is hidden;
 * the filter and the download keep the raw value.
 */
const FILE_TYPE_LABELS = {
  'application/pdf': '$t:admin.buckets.mime.pdf',
  'image/png': '$t:admin.buckets.mime.png',
  'image/jpeg': '$t:admin.buckets.mime.jpeg',
  'image/webp': '$t:admin.buckets.mime.webp',
  'image/avif': '$t:admin.buckets.mime.avif',
  'image/gif': '$t:admin.buckets.mime.gif',
  'image/svg+xml': '$t:admin.buckets.mime.svg',
  'image/heic': '$t:admin.buckets.mime.heic',
  'text/plain': '$t:admin.buckets.mime.text',
  'text/csv': '$t:admin.buckets.mime.csv',
  'application/json': '$t:admin.buckets.mime.json',
  'application/zip': '$t:admin.buckets.mime.zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '$t:admin.buckets.mime.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '$t:admin.buckets.mime.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    '$t:admin.buckets.mime.pptx',
  'video/mp4': '$t:admin.buckets.mime.mp4',
  'audio/mpeg': '$t:admin.buckets.mime.mp3',
} as const

/** The channel the file browser's search box publishes on and its grid listens to. */
const FILES_CHANNEL = 'files-filter'

const filesGrid = (variant: FilesGridVariant): PageComponent =>
  dataTable({
    props: { id: FILES_GRID_ID },
    dataSource: {
      system: {
        endpoint: variant.endpoint,
        rowsKey: 'items',
        idKey: 'key',
        bindTo: FILES_CHANNEL,
        sharedFilter: {},
      },
    },
    columns: [
      { field: 'filename', label: '$t:admin.buckets.file' },
      ...(variant.provenance ? PROVENANCE_COLUMNS : []),
      { field: 'mimeType', label: '$t:admin.common.type', valueLabels: FILE_TYPE_LABELS },
      { field: 'size', label: '$t:admin.common.size', align: 'right', format: 'bytes' },
      { field: 'createdAt', label: '$t:admin.buckets.modified', format: 'short-date' },
      fileRowActions(variant.fileUrl, variant.deleteMessage),
    ],
    // ─── THE FILE LIST OWNS ITS SCROLL ─────────────────────────────────────
    //
    // Founder call. The console canvas annotates `grid fills its container` on
    // the Records boards and on no other, so this is the one grid that fills
    // without a drawing asking for it — taken because the surface has the same
    // shape as Records and the same failure without it: the list is the last
    // thing on the page, so an unbounded one pushes its pager below the fold
    // and takes the column's scroll with it, carrying the header away.
    //
    // `fill` is HALF of the contract; the chain that bounds it is the other
    // half, and two links of three are worth nothing (measured on
    // `/tables/:table`). Here it runs `withShell({ fill: true })` → `fillHost`
    // → the gap-4 column → the browser section → this table, and every link
    // has to be allowed to shrink below its content. The three above the grid
    // — the usage tile, the upload control and the section heading — keep
    // their natural height and the grid takes what is left.
    layout: 'fill',
    // The tile view of the same rows is the sibling `filesGallery`, behind the
    // Layout tabs.
    emptyMessage: variant.emptyMessage,
    noMatchMessage: '$t:admin.buckets.noMatch',
  }) as PageComponent

/**
 * The same files as cards: an image shows itself, any other file its name.
 *
 * Bound to the source the list reads, on the same search channel, so the two
 * layouts always show the same files. The thumbnail is an `image` child bound
 * to the row's `file` — the file as an attachment value — which draws a file
 * only when its type is an image, so a PDF's card carries no broken picture.
 * The picture is named by the file, which is what a reader hears for it.
 */
const filesGallery = (variant: FilesGridVariant): PageComponent =>
  ({
    type: 'gallery',
    dataSource: {
      system: {
        endpoint: variant.endpoint,
        rowsKey: 'items',
        idKey: 'key',
        bindTo: FILES_CHANNEL,
        sharedFilter: {},
      },
    },
    gridColumns: { mobile: 2, md: 3, lg: 4, xl: 5 },
    // A card here has no cover, so its content pads its own top; the thumbnail
    // is a square the picture fills, whatever its own proportions.
    classes: {
      parts: {
        body: 'gap-2 pt-(--card-spacing) [&_img]:aspect-square [&_img]:w-full [&_img]:rounded-md [&_img]:object-cover',
      },
    },
    galleryCard: {
      children: [
        { type: 'image', src: '$record.file', alt: '$record.filename' },
        {
          type: 'text',
          element: 'p',
          content: '$record.filename',
          props: { className: 'truncate text-sm font-medium' },
        },
      ],
    },
    emptyMessage: variant.emptyMessage,
  }) as PageComponent

/**
 * The browser's two layouts, List first: the list is where an operator sorts,
 * searches and acts on a file, the grid where she recognises one by sight.
 *
 * The tab set is a link of the fill chain, so the list keeps owning its
 * scroll; the grid's panel scrolls on its own, as every sibling panel of a
 * filling set must. The search box above the strip serves both: the two
 * layouts read one channel, which takes one publisher.
 */
const layoutTabs = (variant: FilesGridVariant): PageComponent =>
  lineTabs({
    defaultTab: 'list',
    layout: 'fill',
    props: {
      'aria-label': '$t:admin.buckets.layout',
      // The panel's own 16 px above and below would cost the list its floor:
      // under the usage tiles and the drop zone, a laptop screen has no room
      // for the strip AND that padding, and the page would scroll instead of
      // the list. The page's own padding is below it.
      className: '[&_[role=tabpanel]]:pt-2 [&_[role=tabpanel]]:pb-0',
    },
    panels: [
      { id: 'list', label: '$t:admin.buckets.layout.list' },
      { id: 'grid', label: '$t:admin.buckets.layout.grid' },
    ],
    children: [tabPanel([filesGrid(variant)]), tabPanel([filesGallery(variant)], { scroll: true })],
  })

/**
 * The bucket list `redirectToFirst` reads its first row from — and, when that
 * read fails, the directory the page falls back to showing.
 *
 * The same endpoint and key the sidebar's Files disclosure lazy-loads
 * (the `buckets` disclosure in `../../components/sidebar`), so the bare path can never land on a bucket
 * the picker does not offer.
 */
const bucketDirectory = (): PageComponent =>
  ({
    type: 'list',
    props: { 'data-testid': 'admin-buckets-directory', className: 'flex flex-col gap-1' },
    dataSource: { system: { endpoint: BUCKETS_ENDPOINT, rowsKey: 'items' } },
    listDisplay: {
      itemTemplate: { title: '{name}' },
      emptyMessage: '$t:admin.buckets.none',
    },
  }) as PageComponent

/** `/files` — the bare collection, which always redirects. */
const directoryPage: PageConfig = consolePage({
  id: 'dashboard-data-buckets',
  path: '/files',
  title: '$t:admin.meta.buckets',
  heading: ['$t:admin.buckets.heading', '$t:admin.buckets.blurb'],
  page: {
    requires: ['buckets'],
    redirectToFirst: { hrefTemplate: '/files/{name}' },
  },
  shell: { breadcrumb: BREADCRUMB },
  body: [bucketDirectory()],
})

/**
 * One bucket's browser — `/files/system` or `/files/:bucket`.
 *
 * The grid is wrapped in a `section` named "File browser" so the surface keeps
 * the landmark the bespoke island carried, which is how a spec addresses the
 * browser without competing with every other grid on the console.
 */
const browserPage = (
  id: string,
  path: string,
  blurb: string,
  variant: FilesGridVariant
): PageConfig =>
  consolePage({
    id,
    path,
    title: '$t:admin.meta.buckets',
    heading: ['$t:admin.buckets.heading', blurb],
    showBlurb: true,
    page: {
      requires: ['buckets'],
      // The bucket itself, so the trail ends on its readable name ("Quote
      // documents") rather than its address; an unknown bucket 404s here.
      dataSource: {
        system:
          path === '/files/system'
            ? { endpoint: `${BUCKETS_ENDPOINT}/system` }
            : { endpoint: `${BUCKETS_ENDPOINT}/:bucket`, param: 'bucket' },
      },
    },
    shell: {
      breadcrumb: BREADCRUMB,
      // The built-in bucket's read answers its name as the engine spells it,
      // in English whatever the console language; the trail names it in the
      // reader's words instead. A declared bucket keeps its own label.
      breadcrumbCurrent: path === '/files/system' ? '$t:admin.crumb.systemBucket' : '$record.label',
      fill: true,
    },
    body: [
      // `fillHost`, not `fullWidth`: the two differ by `min-h-0` alone, and
      // that one utility is what lets this column shrink below its content so
      // the grid inside it can take the leftover height. The same swap the
      // Records page makes, for the same reason and with the same `fill: true`
      // on the shell below.
      fillHost([
        {
          type: 'container',
          element: 'div',
          // `min-h-0 flex-1` so the column both grows into the host and is
          // allowed to shrink. Its first two children — the usage tile and the
          // upload control — are not `flex-1`, so they keep their natural
          // height and the browser section below takes the remainder.
          props: { className: 'flex min-h-0 flex-1 flex-col gap-4' },
          children: [
            usageRow(variant.endpoint),
            uploadControl(variant.endpoint),
            ...(variant.rules ? [bucketRules()] : []),
            {
              type: 'container',
              element: 'section',
              props: {
                'aria-label': '$t:admin.buckets.browser.region',
                className: 'flex min-h-0 flex-1 flex-col gap-2',
              },
              children: [
                toolbarRow([toolbarSearch(FILES_CHANNEL, '$t:admin.buckets.search')]),
                layoutTabs(variant),
              ],
            },
          ],
        } as PageComponent,
      ]),
    ],
  })

/**
 * All three pages, with the LITERAL `/files/system` ahead of
 * `/files/:bucket` — that order is the whole mechanism behind the system
 * bucket's blurb and columns. See the header note before reordering.
 */
export default [
  directoryPage,
  browserPage(
    'dashboard-data-buckets-system',
    '/files/system',
    '$t:admin.buckets.blurbSystem',
    SYSTEM_GRID
  ),
  browserPage(
    'dashboard-data-buckets-bucket',
    '/files/:bucket',
    '$t:admin.buckets.blurbBucket',
    DECLARED_GRID
  ),
] satisfies readonly PageConfig[]
