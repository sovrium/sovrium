/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The operator console shell: the sidebar, the sticky header, the command palette and the
// two hidden hosts, placed once by every console page. The page passes its breadcrumb trail
// (and any topbar fact) to the `trail` slot, its body to `$children`, and the body frame's
// class (`bodyClass`), which is the one thing the page kinds draw differently.
//
// TRANSPARENT: it draws exactly what the same tree drew written inline, attribute for
// attribute, and it is not listed on the Design System pages.
//
// Composed by part: the frame (`./console-shell-frame.ts`, the installed `console-shell`
// block copy), the ⌘K palette (`./console-shell-palette.ts`, the installed `command` block
// copy) and the two hidden hosts (`./console-shell-hosts.ts`).

import { consoleShellFrame } from './console-shell-frame'
import { consoleOfflineHost, consoleSpaNavHost } from './console-shell-hosts'
import { consoleShellPalette } from './console-shell-palette'
import type { TemplateEncoded } from '@/domain/models/app/components'

export const consoleShell: TemplateEncoded = {
  name: 'console-shell',
  type: 'container',
  render: 'transparent',
  inputs: {
    bodyClass: {
      kind: 'text',
      required: true,
    },
    trail: {
      kind: 'slot',
    },
  },
  element: 'div',
  props: {
    'data-admin-base-path': '/',
    className: 'contents',
  },
  children: [consoleShellFrame, consoleShellPalette, consoleSpaNavHost, consoleOfflineHost],
}
