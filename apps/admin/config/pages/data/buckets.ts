/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Files — the objects stored in each bucket, one browser per bucket.
//
// TWO pages, like Records:
//
//   `/buckets`          the bare collection, which 302s to the first bucket.
//   `/buckets/:bucket`  that bucket's browser: quota, upload, file grid.
//
// ─── THERE IS ALWAYS A FIRST BUCKET ────────────────────────────────────────
//
// The bucket list is `app.buckets` when the operator declares any, and the
// single virtual `default` otherwise — uploads land there regardless of config.
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

import { fillHost, pageHeading } from '../../components/dataPage'
import { withShell } from '../../components/shell'
import { BUCKETS_ENDPOINT, BUCKETS_OVERVIEW_ENDPOINT } from '../../systemSources'
import type { PageConfig } from 'sovrium'

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
const BREADCRUMB = { buckets: '$t:admin.crumb.buckets' } as const

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

/**
 * The storage-quota tile: one pre-computed scalar, formatted as a byte count.
 *
 * Reads the WHOLE instance's total rather than this bucket's, exactly as the
 * retired builder did — the overview endpoint takes no bucket argument.
 */
const quotaKpi = (): PageComponent =>
  ({
    type: 'kpi',
    label: 'Storage used',
    dataSource: { system: { endpoint: BUCKETS_OVERVIEW_ENDPOINT, valuePath: 'totals.totalBytes' } },
    kpiFormat: { type: 'bytes' },
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
const uploadControl = (): PageComponent =>
  ({
    type: 'file-upload',
    props: {
      id: 'admin-bucket-upload',
      'aria-label': '$t:admin.buckets.upload.region',
      label: 'Add file',
    },
    dropZone: true,
    maxFiles: 1,
    uploadAction: ADMIN_FILES_ENDPOINT,
    onSuccess: {
      type: 'toast',
      variant: 'success',
      message: 'File added',
      refetch: FILES_GRID_ID,
    },
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
const fileRowActions = () =>
  ({
    type: 'actions',
    label: '',
    actions: [
      {
        label: 'Download',
        icon: 'download',
        action: {
          type: 'fetch',
          mode: 'download',
          url: PUBLIC_FILE_URL,
          filename: '$record.filename',
        },
      },
      {
        label: 'Delete',
        action: { type: 'fetch', method: 'DELETE', url: PUBLIC_FILE_URL },
        confirm: {
          title: 'Delete this file?',
          message: 'Deleting this file removes it from the bucket. This cannot be undone.',
          confirmLabel: 'Delete file',
          cancelLabel: 'Cancel',
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
const filesGrid = (): PageComponent =>
  ({
    type: 'table',
    props: { id: FILES_GRID_ID },
    dataSource: { system: { endpoint: ADMIN_FILES_ENDPOINT, rowsKey: 'items', idKey: 'key' } },
    columns: [
      { field: 'filename', label: 'File' },
      { field: 'mimeType', label: 'Type' },
      { field: 'size', label: 'Size', align: 'right', format: 'compact' },
      { field: 'createdAt', label: 'Modified', format: 'short-date' },
      fileRowActions(),
    ],
    search: { enabled: true, placeholder: 'Search files' },
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
    // — the quota tile, the upload control and the section heading — keep
    // their natural height and the grid takes what is left.
    layout: 'fill',
    // ─── NO VIEW SWITCHER, AND IT WAS TRIED BEFORE IT WAS REFUSED ──────────
    //
    // `FilesBucketGrid` is the one board in the whole console canvas that draws
    // an alternate view of the same rows — this bucket's files as tiles rather
    // than as a list — and a file is exactly the console row an operator knows
    // by shape. `views: ['grid', 'gallery']` + `toolbar.viewSwitcher` is the
    // authorable spelling, it decodes, and the switcher renders.
    //
    // It was shipped, measured against four real uploaded files, and reverted.
    // The gallery drew a one-column stack of `f2d69c57-a951-485f-aea4-…-note-d
    // .txt` — the raw STORAGE KEY, which is this source's `idKey` — with no
    // filename, no type, no size, no date and none of the row actions. Strictly
    // worse than the list it replaced, on every axis.
    //
    // It is not fixable from config: `AlternateView`
    // (`presentation/islands/data-table/island/alternate-view.tsx:119`) hands
    // the gallery `records` and `emptyMessage` and nothing else — no columns,
    // no title field, no media field — so there is no key that would name
    // `filename` as the caption. Routed as a platform gap rather than shipped
    // as a control that degrades the surface it decorates.
    toolbar: { search: true, filters: true, sort: true },
    emptyMessage: 'No files',
    noMatchMessage: 'No file matches “{query}”',
  }) as PageComponent

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
      emptyMessage: 'No buckets',
    },
  }) as PageComponent

/** `/buckets` — the bare collection, which always redirects. */
const directoryPage: PageConfig = withShell(
  {
    id: 'dashboard-data-buckets',
    name: 'dashboard-data-buckets',
    path: '/buckets',
    meta: { title: '$t:admin.meta.buckets', lang: 'en-US' },
    redirectToFirst: { hrefTemplate: '/buckets/{name}' },
    components: [
      pageHeading('$t:admin.buckets.heading', '$t:admin.buckets.blurb'),
      bucketDirectory(),
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB }
)

/**
 * `/buckets/:bucket` — one bucket's browser.
 *
 * The grid is wrapped in a `section` named "File browser" so the surface keeps
 * the landmark the bespoke island carried, which is how a spec addresses the
 * browser without competing with every other grid on the console.
 */
const browserPage: PageConfig = withShell(
  {
    id: 'dashboard-data-buckets-bucket',
    name: 'dashboard-data-buckets-bucket',
    path: '/buckets/:bucket',
    meta: { title: '$t:admin.meta.buckets', lang: 'en-US' },
    components: [
      pageHeading('$t:admin.buckets.heading', '$t:admin.buckets.blurb'),
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
          // allowed to shrink. Its first two children — the quota tile and the
          // upload control — are not `flex-1`, so they keep their natural
          // height and the browser section below takes the remainder.
          props: { className: 'flex min-h-0 flex-1 flex-col gap-4' },
          children: [
            quotaKpi(),
            uploadControl(),
            {
              type: 'container',
              element: 'section',
              props: {
                'aria-label': '$t:admin.buckets.browser.region',
                className: 'flex min-h-0 flex-1 flex-col gap-2',
              },
              children: [filesGrid()],
            },
          ],
        } as PageComponent,
      ]),
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB, fill: true }
)

/** Both pages, directory first — see `tables.ts` for why the order is written down. */
export default [directoryPage, browserPage] satisfies readonly PageConfig[]
