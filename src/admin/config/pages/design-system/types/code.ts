/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `code` — a block of code or a command, framed by what it IS.
//
// All five are the real component. `codeFrame` is the key that carries the
// meaning: a file frame names a path, a terminal frame names a shell, and the
// difference matters because a reader copying a line needs to know whether to
// paste it into an editor or a prompt.
//
// The inline form is the one exception. There is no key for it — an inline
// fragment is a `text` set in mono — so that drawing is a sentence with one in
// it, and it is here because an author choosing between the two is choosing
// between two different types.

import type { PageComponent, TypePageBody } from './body-shape'

const SAMPLE = `export default {
  name: 'invoices',
  tables: [{ name: 'invoice', fields: [{ name: 'total', type: 'number' }] }],
}`

const SNIPPET =
  "export const onDealWon = async (record) => {\n  await notify('#sales', record.name)\n}"

const code: TypePageBody = {
  drawings: [
    {
      label: 'block with line numbers',
      children: [
        // `language` rides in `props`, not as a field — the placement every
        // shipped usage of this type in the repo uses.
        { type: 'code', content: SAMPLE, props: { language: 'typescript', className: 'w-full' } },
      ],
    },
    {
      label: 'file frame',
      children: [
        {
          type: 'code',
          codeFrame: 'file',
          filename: 'app.ts',
          content: SAMPLE,
          copy: true,
          props: { language: 'typescript', className: 'w-full' },
        },
      ],
    },
    {
      label: 'terminal frame',
      children: [
        {
          type: 'code',
          codeFrame: 'terminal',
          terminalLabel: 'bash',
          content: 'sovrium start app.ts',
          copy: true,
          output: 'Server ready in 232ms\n→ http://localhost:3000',
          props: { language: 'bash', className: 'w-full' },
        },
      ],
    },
    {
      label: 'inline',
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground max-w-2xl text-md leading-relaxed' },
          children: [
            { type: 'text', element: 'span', content: 'Every page declares its own ' },
            {
              type: 'text',
              element: 'code',
              props: { className: 'font-mono text-sm' },
              content: 'path',
            },
            {
              type: 'text',
              element: 'span',
              content: ', and the router refuses two that collide.',
            },
          ],
        },
      ],
    },
    {
      label: 'diff',
      children: [
        {
          type: 'code',
          content: "- { name: 'total', type: 'text' }\n+ { name: 'total', type: 'number' }",
          props: { language: 'diff', className: 'w-full' },
        },
      ],
    },
  ],
  options: [
    {
      id: 'frame',
      title: 'Frame',
      configKey: 'code.codeFrame',
      drawings: [
        {
          label: "codeFrame: 'none'",
          children: [
            {
              type: 'code',
              codeFrame: 'none',
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
        {
          label: "codeFrame: 'file'",
          children: [
            {
              type: 'code',
              codeFrame: 'file',
              filename: 'app.ts',
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
        {
          label: "codeFrame: 'terminal'",
          children: [
            {
              type: 'code',
              codeFrame: 'terminal',
              props: { language: 'bash' },
              content: 'sovrium validate app.ts',
            } as PageComponent,
          ],
        },
        {
          label: 'filename set, codeFrame omitted',
          children: [
            {
              type: 'code',
              filename: 'app.ts',
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
        {
          label: 'output set, codeFrame omitted',
          children: [
            {
              type: 'code',
              props: { language: 'bash' },
              content: 'sovrium validate app.ts',
              output: 'app.ts is valid.',
            } as PageComponent,
          ],
        },
        {
          label: 'nothing declared',
          children: [
            { type: 'code', props: { language: 'typescript' }, content: SNIPPET } as PageComponent,
          ],
        },
        {
          label: "codeFrame: 'none' with a filename",
          children: [
            {
              type: 'code',
              codeFrame: 'none',
              filename: 'app.ts',
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'filename',
      title: 'File name',
      configKey: 'code.filename',
      drawings: [
        {
          label: "filename: 'app.ts'",
          children: [
            {
              type: 'code',
              filename: 'app.ts',
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
        {
          label: 'a long path',
          children: [
            {
              type: 'code',
              filename: 'src/admin/config/pages/design-system/types/code.ts',
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'terminal',
      title: 'Terminal',
      configKey: 'code.terminalLabel | output',
      drawings: [
        {
          label: 'codeFrame: terminal',
          children: [
            {
              type: 'code',
              codeFrame: 'terminal',
              props: { language: 'bash' },
              content: 'sovrium validate app.ts',
            } as PageComponent,
          ],
        },
        {
          label: "terminalLabel: 'your shell'",
          children: [
            {
              type: 'code',
              codeFrame: 'terminal',
              terminalLabel: 'your shell',
              props: { language: 'bash' },
              content: 'sovrium validate app.ts',
            } as PageComponent,
          ],
        },
        {
          label: 'output: …',
          children: [
            {
              type: 'code',
              props: { language: 'bash' },
              content: 'sovrium validate app.ts',
              output: 'app.ts is valid.\n88 component types catalogued.',
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'copy',
      title: 'Copy',
      configKey: 'code.copy | copyLabel | copiedLabel',
      drawings: [
        {
          label: 'copy: (omitted)',
          children: [
            { type: 'code', props: { language: 'typescript' }, content: SNIPPET } as PageComponent,
          ],
        },
        {
          label: 'copy: false',
          children: [
            {
              type: 'code',
              copy: false,
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
        {
          label: "copyLabel: 'Copy config' · copiedLabel: 'Copied'",
          children: [
            {
              type: 'code',
              copyLabel: 'Copy config',
              copiedLabel: 'Copied',
              props: { language: 'typescript' },
              content: SNIPPET,
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default code
