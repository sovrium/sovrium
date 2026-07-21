/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { DocsChromeLabels } from '@/presentation/ui/pages/markdown/DocsChromeLabels'

interface DocsContributionFooterProps {
  readonly editUrl: string | undefined
  readonly issueUrl: string | undefined
  readonly contributionNote: string | undefined
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
    'text-foreground-subtle hover:text-foreground text-xs no-underline transition-colors duration-150'
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
        <p className="text-foreground-subtle mt-2 text-xs">{contributionNote}</p>
      )}
    </div>
  )
}
