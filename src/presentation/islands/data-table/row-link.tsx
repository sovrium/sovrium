/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { RowLink } from './row-action'
import type { ReactElement, ReactNode } from 'react'

/**
 * The link a navigating row holds around its first column's value, named by
 * that value. A click on it is the link's own (`clickLandsOnInnerControl`), so
 * the row does not navigate a second time.
 */
export function RowLinkAnchor({
  link,
  children,
}: {
  readonly link: RowLink
  readonly children: ReactNode
}): ReactElement {
  return (
    <a
      href={link.href}
      data-row-link=""
      {...(link.newTab && { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {children}
    </a>
  )
}
