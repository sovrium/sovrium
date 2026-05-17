/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { ResolvedSidebarSection } from '@/presentation/rendering/sidebar-resolver'

type PageSidebarProps = {
  readonly sections: readonly ResolvedSidebarSection[]
}

/**
 * Renders the page sidebar (US-PAGES-ACCESS-SCOPED-SIDEBAR).
 *
 * Sections are pre-resolved at SSR time — the sidebar component is a
 * thin renderer over the already-filtered entries. Active entries
 * receive `data-active="true"` so spec selectors and downstream styling
 * can target them.
 */
export function PageSidebar({ sections }: PageSidebarProps): Readonly<ReactElement> {
  return (
    <aside data-testid="page-sidebar">
      {sections.map((section, sectionIndex) => (
        <nav key={sectionIndex}>
          {section.entries.map((entry) => (
            <a
              key={entry.recordId}
              href={entry.href}
              data-record-id={entry.recordId}
              {...(entry.active ? { 'data-active': 'true' } : {})}
            >
              {entry.label}
            </a>
          ))}
        </nav>
      ))}
    </aside>
  )
}
