/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { DocsChromeLabels } from '@/presentation/render/markdown/docs-chrome-labels'

/**
 * Platform-rendered contribution footer for a `docs`-layout article (A2).
 *
 * Rendered at the FOOT of the article (after `DocsPrevNext`) whenever ANY of the
 * three contribution affordances is configured on the collection's `contentDir`:
 *   - an "Edit this page" link (when `editUrl` resolved), and/or
 *   - a "Report an issue" link (when `issueUrl` resolved), and/or
 *   - a raw per-locale contribution note (when `contributionNote` set).
 *
 * Returns `undefined` when none of the three is set, so the
 * `[data-component="docs-contribution-footer"]` block never renders for a
 * collection that opted out. Both links carry `rel="noopener noreferrer"` (they
 * open external editors/trackers). Muted, small, Bun-docs-style chrome — visually
 * consistent with `DocsPrevNext` and the last-updated stamp.
 */
interface DocsContributionFooterProps {
  /** Interpolated "Edit this page" href (from `contentDir.editUrl`), if set. */
  readonly editUrl: string | undefined
  /** Interpolated "Report an issue" href (from `contentDir.issueUrl`), if set. */
  readonly issueUrl: string | undefined
  /** Raw per-locale contribution note (from `contentDir.contributionNote`), if set. */
  readonly contributionNote: string | undefined
  /** Localized docs-chrome labels for the link text. */
  readonly labels: DocsChromeLabels
}

export function DocsContributionFooter({
  editUrl,
  issueUrl,
  contributionNote,
  labels,
}: DocsContributionFooterProps): Readonly<ReactElement> | undefined {
  if (editUrl === undefined && issueUrl === undefined && contributionNote === undefined) {
    return undefined
  }
  const linkClass =
    'text-foreground-subtle hover:text-foreground text-sm no-underline transition-colors duration-150'
  return (
    <div
      data-component="docs-contribution-footer"
      className="border-border mt-10 border-t pt-6"
    >
      {(editUrl !== undefined || issueUrl !== undefined) && (
        <div className="flex flex-wrap items-center gap-4">
          {editUrl !== undefined && (
            <a
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {labels.editThisPage}
            </a>
          )}
          {issueUrl !== undefined && (
            <a
              href={issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {labels.reportAnIssue}
            </a>
          )}
        </div>
      )}
      {contributionNote !== undefined && (
        <p className="text-foreground-subtle mt-2 text-sm">{contributionNote}</p>
      )}
    </div>
  )
}
