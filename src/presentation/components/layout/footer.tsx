/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { FooterColumns } from '@/presentation/components/layout/footer/footer-columns'
import { FooterCopyright } from '@/presentation/components/layout/footer/footer-copyright'
import { FooterDescription } from '@/presentation/components/layout/footer/footer-description'
import { FooterEmail } from '@/presentation/components/layout/footer/footer-email'
import { FooterLegal } from '@/presentation/components/layout/footer/footer-legal'
import { FooterLogo } from '@/presentation/components/layout/footer/footer-logo'
import { FooterNewsletter } from '@/presentation/components/layout/footer/footer-newsletter'
import { FooterSocial } from '@/presentation/components/layout/footer/footer-social'
import { buildColorStyles } from '@/presentation/utils/styles'
import type { Footer as FooterProps } from '@/domain/models/app/page/layout/footer'
import type { ReactElement } from 'react'

/**
 * Footer Component
 *
 * Renders the page footer with logo, copyright, optional legal links, and contact email.
 *
 * @param props - Footer configuration
 * @returns Footer element or undefined if disabled
 */
export function Footer({
  enabled = true,
  logo,
  description,
  backgroundColor,
  textColor,
  columns,
  social,
  newsletter,
  copyright,
  legal,
  email,
}: Readonly<FooterProps>): Readonly<ReactElement | undefined> {
  if (!enabled) {
    return undefined
  }

  const colorStyles = buildColorStyles(backgroundColor, textColor)
  const footerStyle: React.CSSProperties = {
    display: 'block',
    minHeight: '1px',
    ...colorStyles,
  }

  return (
    <footer
      data-testid="footer"
      style={footerStyle}
    >
      <FooterLogo logo={logo} />
      <FooterDescription description={description} />
      <FooterColumns columns={columns} />
      <FooterSocial social={social} />
      <FooterNewsletter newsletter={newsletter} />
      <FooterCopyright copyright={copyright} />
      <FooterLegal legal={legal} />
      <FooterEmail email={email} />
    </footer>
  )
}
