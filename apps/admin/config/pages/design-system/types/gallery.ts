/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `gallery` — records as cards, for records a reader recognises by sight.
//
// `layout` is the decision: a grid for cards of equal weight, a carousel when
// the set is long and the first few are the ones that matter. Masonry is the
// third value and the page does not draw it — it is for cards of genuinely
// unequal height, which a set of records rarely has.
//
// `gridColumns` is per breakpoint, which is what stops a three-up grid becoming
// three unreadable slivers on a phone.
//
// No cover image is drawn here deliberately: the specimen rows carry none, and
// pointing one at a remote URL would put a cross-origin request inside a frame
// whose whole guarantee is that it makes none.

import { SPECIMEN_ROWS_ENDPOINT, SPECIMEN_TABLE_NAME } from '../../../systemSources'
import type { PageComponent, TypePageBody } from './_shape'

const BOUND = {
  system: {
    endpoint: SPECIMEN_ROWS_ENDPOINT,
    rowsKey: 'items',
    idKey: 'id',
    totalKey: 'total',
    query: { rows: '3' },
  },
}

/** The same gallery every time, with one key changed. */
const shelf = (id: string, extra: Record<string, unknown>) =>
  ({
    type: 'gallery' as const,
    props: { id },
    dataSource: BOUND,
    layout: 'grid' as const,
    gridColumns: { mobile: 1, md: 2, lg: 3 },
    emptyMessage: 'No specimen rows',
    ...extra,
  }) as PageComponent

const gallery: TypePageBody = {
  drawings: [
    {
      label: 'three up',
      children: [
        {
          type: 'gallery',
          props: { id: 'design-system-gallery-three' },
          dataSource: BOUND,
          layout: 'grid',
          gridColumns: { mobile: 1, md: 2, lg: 3 },
          emptyMessage: 'No specimen rows',
        },
      ],
    },
    {
      label: 'two up',
      children: [
        {
          type: 'gallery',
          props: { id: 'design-system-gallery-two' },
          dataSource: BOUND,
          layout: 'grid',
          gridColumns: { mobile: 1, md: 2, lg: 2 },
          emptyMessage: 'No specimen rows',
        },
      ],
    },
    {
      label: 'carousel',
      children: [
        {
          type: 'gallery',
          props: { id: 'design-system-gallery-carousel' },
          dataSource: BOUND,
          layout: 'carousel',
          emptyMessage: 'No specimen rows',
        },
      ],
    },
  ],
  options: [
    {
      id: 'layout',
      title: 'Layout',
      configKey: 'gallery.layout',
      drawings: [
        { label: "layout: 'grid'", children: [shelf('gal-grid', { layout: 'grid' })] },
        { label: "layout: 'masonry'", children: [shelf('gal-masonry', { layout: 'masonry' })] },
        { label: "layout: 'carousel'", children: [shelf('gal-carousel', { layout: 'carousel' })] },
      ],
    },
    {
      id: 'columns',
      title: 'Columns',
      configKey: 'gallery.gridColumns',
      drawings: [
        {
          label: 'gridColumns: { mobile: 1, md: 2, lg: 4 }',
          children: [shelf('gal-col-4', { gridColumns: { mobile: 1, md: 2, lg: 4 } })],
        },
        {
          label: 'gridColumns: { mobile: 1, md: 2, lg: 2 }',
          children: [shelf('gal-col-2', { gridColumns: { mobile: 1, md: 2, lg: 2 } })],
        },
      ],
    },
    {
      id: 'card',
      title: 'Card',
      configKey: 'gallery.galleryCard',
      drawings: [
        {
          label: 'galleryCard: { children }',
          children: [
            shelf('gal-card-children', {
              galleryCard: {
                children: [
                  { type: 'text', element: 'p', content: '$record.name' },
                  {
                    type: 'text',
                    element: 'p',
                    content: '$record.role',
                    props: { className: 'text-foreground-subtle text-[11px]' },
                  },
                ],
              },
            }),
          ],
        },
        {
          label: "galleryCard: { aspectRatio: '16:9' }",
          children: [shelf('gal-card-ratio', { galleryCard: { aspectRatio: '16:9' } })],
        },
        {
          label: 'galleryCard: { coverImage, hoverOverlay, onClick }',
          children: [
            {
              type: 'code',
              props: { language: 'yaml' },
              content:
                'galleryCard:\n  coverImage: $record.photo\n  hoverOverlay: true\n  onClick: open-drawer',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'pagination',
      title: 'Pagination',
      configKey: 'gallery.dataSource.pagination',
      drawings: [
        {
          label: "pagination: { pageSize: 3, style: 'numbered' }",
          children: [
            shelf('gal-page-numbered', {
              dataSource: {
                table: SPECIMEN_TABLE_NAME,
                pagination: { pageSize: 3, style: 'numbered' },
              },
            }),
          ],
        },
        {
          label: "pagination: { pageSize: 3, style: 'loadMore' }",
          children: [
            shelf('gal-page-loadmore', {
              dataSource: {
                table: SPECIMEN_TABLE_NAME,
                pagination: { pageSize: 3, style: 'loadMore' },
              },
            }),
          ],
        },
        {
          label: "pagination: { style: 'infinite' }",
          children: [
            shelf('gal-page-infinite', {
              dataSource: {
                table: SPECIMEN_TABLE_NAME,
                pagination: { pageSize: 3, style: 'infinite' },
              },
            }),
          ],
        },
      ],
    },
    {
      id: 'empty',
      title: 'Empty',
      configKey: 'gallery.emptyMessage',
      drawings: [
        {
          label: "emptyMessage: 'No photos in this album yet'",
          children: [
            {
              type: 'gallery',
              props: { id: 'gal-empty' },
              dataSource: {
                system: {
                  endpoint: SPECIMEN_ROWS_ENDPOINT,
                  rowsKey: 'items',
                  idKey: 'id',
                  totalKey: 'total',
                  query: { rows: '0' },
                },
              },
              layout: 'grid',
              gridColumns: { mobile: 1, md: 2, lg: 3 },
              emptyMessage: 'No photos in this album yet',
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default gallery
