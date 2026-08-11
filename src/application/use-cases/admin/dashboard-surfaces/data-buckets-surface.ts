/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Files** page — the per-bucket file
 * browser, dogfooded onto generic Sovrium config (Consoles-as-Config).
 *
 * Pass 1 items 1.5a + 1.5c removed the duplicate in-pane bucket picker rail: the
 * authoritative bucket list is the sidebar's auto-expanded Files disclosure
 *. So a bare `/_admin/buckets` 302-REDIRECTS to the FIRST bucket's
 * file browser (`/_admin/buckets/{first}`), and the selected bucket mounts the
 * file browser FULL-WIDTH, no left rail. Read-only browse for the MVP; destructive
 * delete is a noted follow-up.
 *
 * The bespoke `admin-bucket-files` island (quota bar + toolbar + file table +
 * download + upload dialog) is now EXPRESSED ENTIRELY IN CONFIG — the dashboard
 * dogfoods its own components instead of a hand-rolled island (mirroring the
 * automation-runs + connections conversions):
 *  - the STORAGE QUOTA is a `kpi` bound via `dataSource.system` to
 *    `GET /api/admin/buckets/overview`, reading the `totals.totalBytes` scalar
 *    and formatting it as `bytes`;
 *  - the UPLOAD affordance is a `file-upload` POSTing the picked file as
 *    `multipart/form-data` to the admin upload endpoint
 *    (`POST /api/admin/buckets/:name/files`), then `onSuccess.refetch` re-queries
 *    the sibling file grid so the new file appears without a reload;
 *  - the FILE TABLE is a `data-table` bound via `dataSource.system` to the
 *    existing admin file-list endpoint (`GET /api/admin/buckets/:name/files`,
 *    `{ items, totalBytes }` envelope, rows keyed on `key`), with a
 *    search / type-filter / sort `toolbar`, and a per-row download `actions`
 *    column carrying a CAP-3 `mode: download` `fetch` action to the PUBLIC file
 *    route (`/api/buckets/:name/files/:key`). `app.tables` cross-validation is
 *    skipped for both system sources (the columns / value-path describe the
 *    endpoint envelope, not a declared table).
 *
 * The file table is wrapped in a `section` named "File browser" so the
 * surface still announces the same `region` landmark the bespoke island carried.
 *
 * Buckets ALWAYS redirect: the bucket list is `app.buckets` when the operator
 * declares any, otherwise the single virtual **default** bucket (uploads land
 * there regardless of config — the same projection the `/api/admin/buckets` index
 * endpoint uses), so there is always a first bucket to redirect to (no whole-page
 * empty state). Selection is a path segment, so it is URL-derived — back/forward +
 * the SPA content swap + the sidebar's active-row highlight compose for free.
 */

import {
  dataObjectFullWidth,
  dataPageIntro,
  firstObjectRedirect,
  objectScopedPage,
  type DataObjectRedirect,
} from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** An operator bucket (the redirect's first-object source). */
type OperatorBucket = App['buckets'] extends ReadonlyArray<infer T> | undefined ? T : never

/**
 * The virtual default bucket offered when the operator declares none. Uploads
 * land here regardless of `app.buckets`, so the file browser always has at least
 * one bucket to open (mirrors the `/api/admin/buckets` index projection).
 */
const DEFAULT_BUCKET_NAME = 'default'

/**
 * Id of the file-list `data-table` component. The upload control's
 * `onSuccess.refetch` references it by `props.id` so a successful upload
 * re-queries the grid (no full reload).
 */
const FILES_GRID_ID = 'admin-bucket-files-grid'

/** Host id of the upload `file-upload` control (stable input id stem). */
const UPLOAD_CONTROL_ID = 'admin-bucket-upload'

/**
 * The declared bucket names, or the single virtual default bucket when none are
 * declared. The first entry is the bare-page redirect target (Pass 1 item 1.5a).
 */
function bucketNames(buckets: ReadonlyArray<OperatorBucket>): ReadonlyArray<string> {
  if (buckets.length === 0) return [DEFAULT_BUCKET_NAME]
  return buckets.flatMap((bucket): ReadonlyArray<string> => {
    const { name } = bucket as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

/** The page intro: heading + orienting one-liner. */
function intro(): Component {
  return dataPageIntro(
    'Files',
    'Browse the files stored in your buckets. Choose a bucket to open its browser — search, sort, filter by type, then download a file.'
  )
}

/**
 * The storage-quota indicator — a `kpi` reading the pre-computed
 * `totals.totalBytes` scalar from the buckets-overview endpoint via
 * `dataSource.system` and formatting it as a human byte count.
 */
function quotaKpi(): Component {
  return {
    type: 'kpi',
    label: 'Storage used',
    dataSource: {
      system: {
        endpoint: '/api/admin/buckets/overview',
        valuePath: 'totals.totalBytes',
      },
    },
    kpiFormat: { type: 'bytes' },
  } as unknown as Component
}

/**
 * The "Add file" upload affordance — a `file-upload` that POSTs the
 * picked file as `multipart/form-data` to the admin upload endpoint for THIS
 * bucket, then re-queries the sibling file grid via `onSuccess.refetch` so the
 * just-uploaded file appears without a reload.
 */
function uploadControl(bucketName: string): Component {
  return {
    type: 'file-upload',
    // `label` is the ONE control field the file-upload renderer reads from
    // `props` alone (`rawProps?.['label']`), while its siblings below fall back
    // through `pickCompField` to the component level. It has to live here: the
    // component-level spelling is not declared on `file-upload`, so the config
    // decode drops it and the control ships with no visible label at all.
    props: { id: UPLOAD_CONTROL_ID, 'aria-label': 'Upload file', label: 'Add file' },
    dropZone: true,
    maxFiles: 1,
    uploadAction: `/api/admin/buckets/${encodeURIComponent(bucketName)}/files`,
    onSuccess: {
      type: 'toast',
      variant: 'success',
      message: 'File added',
      refetch: FILES_GRID_ID,
    },
  } as unknown as Component
}

/**
 * The file-list `data-table` — system-source bound to the admin file-list
 * endpoint for THIS bucket (`{ items: [...] }`, rows keyed on `key`). Columns
 * mirror the bespoke browser (File · Type · Size · Modified) with a per-row
 * download control: a CAP-3 `mode: download` `fetch` action to the PUBLIC file
 * route (an arbitrary, unrestricted target path — NOT routed through `/api/admin/*`).
 */
function filesDataTable(bucketName: string): Component {
  return {
    type: 'data-table',
    props: { id: FILES_GRID_ID },
    dataSource: {
      system: {
        endpoint: `/api/admin/buckets/${encodeURIComponent(bucketName)}/files`,
        rowsKey: 'items',
        idKey: 'key',
      },
    },
    columns: [
      { field: 'filename', label: 'File' },
      { field: 'mimeType', label: 'Type' },
      { field: 'size', label: 'Size', align: 'right', format: 'compact' },
      { field: 'createdAt', label: 'Modified', format: 'short-date' },
      {
        type: 'actions',
        label: '',
        actions: [
          {
            label: 'Download',
            icon: 'download',
            action: {
              type: 'fetch',
              mode: 'download',
              url: `/api/buckets/${encodeURIComponent(bucketName)}/files/$record.key`,
              filename: '$record.filename',
            },
          },
        ],
      },
    ],
    toolbar: { search: true, filters: true, sort: true },
    emptyMessage: 'No files',
  } as unknown as Component
}

/**
 * The selected bucket's file-browser body, composed from generic config: the
 * quota `kpi`, the upload `file-upload`, and the file `data-table` wrapped in the
 * "File browser" region (the same named landmark the spec resolves;
 * the per-row download control lives inside it).
 */
function fileBrowserBody(bucketName: string): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-4' },
    children: [
      quotaKpi(),
      uploadControl(bucketName),
      {
        type: 'container',
        element: 'section',
        props: { 'aria-label': 'File browser', className: 'flex flex-col gap-2' },
        children: [filesDataTable(bucketName)],
      },
    ],
  } as unknown as Component
}

/** Assemble the Files `Page` (id / path / meta / shell) around a body. */
function bucketsPage(
  selected: string | undefined,
  body: Component,
  options: DataShellOptions
): Page {
  return objectScopedPage(
    { key: 'buckets', label: 'Files', intro: intro() },
    selected,
    body,
    options
  )
}

/**
 * Build the Files page — or a 302 redirect to the first bucket.
 *
 * A bare `/_admin/buckets` ALWAYS returns a {@link DataObjectRedirect} to the
 * first bucket's browser (Pass 1 item 1.5a): the bucket list is `app.buckets` or
 * the single virtual `default` bucket, so there is always a first bucket. With a
 * `selected` bucket the body mounts its file browser FULL-WIDTH (no rail).
 */
export function buildDataBucketsPage(
  operatorApp: App,
  selected: string | undefined,
  options: DataShellOptions
): Page | DataObjectRedirect {
  const buckets = (operatorApp.buckets ?? []) as ReadonlyArray<OperatorBucket>
  const names = bucketNames(buckets)

  // Bare object-page path → 302-redirect to the first bucket's browser (always
  // present: declared buckets, else the virtual `default`).
  if (selected === undefined && names[0] !== undefined) {
    return firstObjectRedirect('buckets', names[0])
  }

  const body = dataObjectFullWidth(fileBrowserBody(selected ?? DEFAULT_BUCKET_NAME))

  return bucketsPage(selected, body, options)
}
