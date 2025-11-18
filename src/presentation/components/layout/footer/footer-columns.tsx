/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getLinkAttributes } from '@/presentation/utils/link-attributes'
import type { FooterColumn } from '@/domain/models/app/page/layout/footer'
import type { ReactElement } from 'react'

interface FooterColumnsProps {
  readonly columns?: ReadonlyArray<FooterColumn>
}

export function FooterColumns({ columns }: FooterColumnsProps): ReactElement | undefined {
  if (!columns || columns.length === 0) {
    return undefined
  }

  return (
    <div>
      {columns.map((column, index) => (
        <div
          key={index}
          data-testid={`footer-column-${index}`}
        >
          <h3 data-testid="column-title">{column.title}</h3>
          <ul data-testid="column-links">
            {column.links.map((link, linkIndex) => (
              <li key={linkIndex}>
                <a
                  {...getLinkAttributes(
                    link.href,
                    link.target,
                    link.target === '_blank' ? 'footer-link-external' : undefined
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
