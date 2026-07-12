/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

type OperatorBucket = App['buckets'] extends ReadonlyArray<infer T> | undefined ? T : never

const DEFAULT_BUCKET_NAME = 'default'

const FILES_GRID_ID = 'admin-bucket-files-grid'

const UPLOAD_CONTROL_ID = 'admin-bucket-upload'

function bucketNames(buckets: ReadonlyArray<OperatorBucket>): ReadonlyArray<string> {
  if (buckets.length === 0) return [DEFAULT_BUCKET_NAME]
  return buckets.flatMap((bucket): ReadonlyArray<string> => {
    const { name } = bucket as { readonly name?: unknown }
    return typeof name === 'string' ? [name] : []
  })
}

function intro(): Component {
  return dataPageIntro(
    'Fichiers',
    'Parcourez les fichiers stockés dans vos compartiments. Choisissez un compartiment pour ouvrir son explorateur — recherchez, triez, filtrez par type, puis téléchargez un fichier.'
  )
}

function quotaKpi(): Component {
  return {
    type: 'kpi',
    label: 'Stockage utilisé',
    dataSource: {
      system: {
        endpoint: '/api/admin/buckets/overview',
        valuePath: 'totals.totalBytes',
      },
    },
    kpiFormat: { type: 'bytes' },
  } as unknown as Component
}

function uploadControl(bucketName: string): Component {
  return {
    type: 'file-upload',
    props: { id: UPLOAD_CONTROL_ID, 'aria-label': 'Téléverser un fichier' },
    label: 'Ajouter un fichier',
    dropZone: true,
    maxFiles: 1,
    uploadAction: `/api/admin/buckets/${encodeURIComponent(bucketName)}/files`,
    onSuccess: {
      type: 'toast',
      variant: 'success',
      message: 'Fichier ajouté',
      refetch: FILES_GRID_ID,
    },
  } as unknown as Component
}

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
      { field: 'filename', label: 'Fichier' },
      { field: 'mimeType', label: 'Type' },
      { field: 'size', label: 'Taille', align: 'right', format: 'compact' },
      { field: 'createdAt', label: 'Modifié', format: 'short-date' },
      {
        type: 'actions',
        label: '',
        actions: [
          {
            label: 'Télécharger',
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
    emptyMessage: 'Aucun fichier',
  } as unknown as Component
}

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
        props: { 'aria-label': 'Explorateur de fichiers', className: 'flex flex-col gap-2' },
        children: [filesDataTable(bucketName)],
      },
    ],
  } as unknown as Component
}

function bucketsPage(
  selected: string | undefined,
  body: Component,
  options: DataShellOptions
): Page {
  return objectScopedPage(
    { key: 'buckets', label: 'Fichiers', intro: intro() },
    selected,
    body,
    options
  )
}

export function buildDataBucketsPage(
  operatorApp: App,
  selected: string | undefined,
  options: DataShellOptions
): Page | DataObjectRedirect {
  const buckets = (operatorApp.buckets ?? []) as ReadonlyArray<OperatorBucket>
  const names = bucketNames(buckets)

  if (selected === undefined && names[0] !== undefined) {
    return firstObjectRedirect('buckets', names[0])
  }

  const body = dataObjectFullWidth(fileBrowserBody(selected ?? DEFAULT_BUCKET_NAME))

  return bucketsPage(selected, body, options)
}
