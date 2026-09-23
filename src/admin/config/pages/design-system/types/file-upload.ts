/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `file-upload` — three shapes of the same transport.
//
// All three are the real component. `dropZone` is the key that separates the
// first two, and the choice is about ROOM rather than preference: a drop zone
// earns its space where files are the page's subject and wastes it where the
// upload is one field of a form.
//
// The third adds no key. A list of what has been uploaded is a composition
// beside the control, which is why it is drawn that way.

import type { PageComponent, TypePageBody } from './body-shape'

const fileRow = (name: string, size: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border flex items-center justify-between gap-3 border-b py-1.5 last:border-b-0',
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: name,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        content: size,
      },
    ],
  }) as PageComponent

const fileUpload: TypePageBody = {
  drawings: [
    {
      label: 'dropzone',
      children: [
        {
          type: 'file-upload',
          dropZone: true,
          accept: '.pdf,.png',
          maxFiles: 5,
          props: { className: 'w-full' },
        },
      ],
    },
    {
      label: 'button',
      children: [
        { type: 'file-upload', accept: '.pdf', maxFiles: 1, props: { className: 'w-full' } },
      ],
    },
    {
      label: 'with file list',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col gap-3' },
          children: [
            {
              type: 'file-upload',
              dropZone: true,
              accept: '.pdf',
              maxFiles: 5,
              props: { className: 'w-full' },
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col' },
              children: [fileRow('devis-v2.pdf', '184 KB'), fileRow('plan-atelier.pdf', '1.2 MB')],
            },
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'control',
      title: 'Control',
      configKey: 'file-upload.dropZone',
      drawings: [
        {
          label: 'dropZone: (omitted)',
          children: [{ type: 'file-upload', props: { className: 'w-full' } } as PageComponent],
        },
        {
          label: 'dropZone: true',
          children: [
            {
              type: 'file-upload',
              dropZone: true,
              props: { className: 'w-full' },
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'accept',
      title: 'Accept',
      configKey: 'file-upload.accept | maxFiles | maxFileSize',
      drawings: [
        {
          label: "accept: 'image/png,image/jpeg'",
          children: [
            {
              type: 'file-upload',
              accept: 'image/png,image/jpeg',
              props: { className: 'w-full' },
            } as PageComponent,
          ],
        },
        {
          label: 'maxFiles: 4',
          children: [
            {
              type: 'file-upload',
              dropZone: true,
              maxFiles: 4,
              props: { className: 'w-full' },
            } as PageComponent,
          ],
        },
      ],
    },
    {
      // NOT `States`. The page already carries a section of that name — the
      // fixed strip, which draws the vocabulary's five (`default`, `hover`,
      // `focus`, `invalid`, `disabled`) on the catalogue's own specimen. These
      // two drawings are a different subject: what the control shows while a
      // file is in flight and when the server refuses it. One name, one thing.
      id: 'uploading',
      title: 'Uploading',
      configKey: 'file-upload — while a file is on its way',
      drawings: [
        {
          label: 'in progress',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'border-border flex w-80 flex-col gap-2 rounded-md border px-3 py-3',
              },
              children: [
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground text-sm' },
                  content: 'signed-proposal.pdf',
                },
                { type: 'progress', progressValue: 62 },
              ],
            } as PageComponent,
          ],
        },
        {
          label: 'error · too large',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-error-border flex w-80 flex-col gap-1 rounded-md border px-3 py-3',
              },
              children: [
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground text-sm' },
                  content: 'quarterly-report.pdf',
                },
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-error-fg text-[11px]' },
                  content: 'Too large — the limit is 10 MB and this file is 24 MB.',
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default fileUpload
