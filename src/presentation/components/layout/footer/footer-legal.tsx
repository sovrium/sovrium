/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getLinkAttributes } from '@/presentation/utils/link-attributes'
import type { FooterLink } from '@/domain/models/app/page/layout/footer'
import type { ReactElement } from 'react'

interface FooterLegalProps {
  readonly legal?: ReadonlyArray<FooterLink>
}

export function FooterLegal({ legal }: FooterLegalProps): ReactElement | undefined {
  if (!legal || legal.length === 0) {
    return undefined
  }

  return (
    <div data-testid="footer-legal">
      {legal.map((link, index) => (
        <a
          key={index}
          {...getLinkAttributes(link.href, link.target)}
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}
