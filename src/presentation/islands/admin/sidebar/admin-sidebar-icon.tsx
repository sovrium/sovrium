/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import type { FamilyIcon } from './admin-sidebar-families'

const ICON_PATHS: Readonly<Record<FamilyIcon, string>> = {
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  page: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
  automation: 'M13 2 3 14h9l-1 8 10-12h-9z',
  form: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
  bucket: 'M4 5h16l-1.5 14a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8zM4 5l1-2h14l1 2',
  agent:
    'M12 2a3 3 0 0 1 3 3v1h2a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8a2 2 0 0 1 2-2h2V5a3 3 0 0 1 3-3zM9 19v2M15 19v2',
  auth: 'M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z',
  theme:
    'M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-2 2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 9 9 0 0 0-9-8zM7.5 12a1 1 0 1 0 0-.01M11 7a1 1 0 1 0 0-.01M16 9a1 1 0 1 0 0-.01',
  language:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z',
  component: 'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z',
  action: 'M13 2 3 14h9l-1 8 10-12h-9z',
  connection: 'M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6h-1M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6h1',
  notification: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  script: 'M16 18l4-4-4-4M8 6l-4 4 4 4M14 4l-4 16',
  env: 'M14.5 2a3.5 3.5 0 0 0-3.3 4.6L3 14.8V21h6.2l8.2-8.2A3.5 3.5 0 1 0 14.5 2zM16 7.5a1 1 0 1 0 0-.01',
  version:
    'M6 3v12M18 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v0a6 6 0 0 0 6 6h3',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  admin:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ai: 'M8 10h.01M12 10h.01M16 10h.01M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
}

export function FamilyGlyph({ icon }: { readonly icon: FamilyIcon }): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-subtle h-4 w-4 shrink-0"
    >
      <path d={ICON_PATHS[icon]} />
    </svg>
  )
}
