/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { buildColorStyles } from '@/presentation/utils/styles'
import {
  NavLinkItem,
  NavLogo,
  NavCTA,
  NavSearch,
  NavUserMenu,
  MobileMenuToggle,
  MobileMenu,
} from './navigation-components'
import { useScrollDetection } from './use-scroll-detection'
import type { Navigation as NavigationProps } from '@/domain/models/app/page/layout/navigation'
import type { ReactElement } from 'react'

/**
 * Configuration for navigation styling
 */
type NavStyleConfig = Readonly<{
  backgroundColor?: string
  textColor?: string
  sticky?: boolean
  transparent?: boolean
  isScrolled: boolean
}>

/**
 * Builds navigation inline styles
 */
function buildNavStyleObject(config: NavStyleConfig): Record<string, unknown> {
  const baseStyle = buildColorStyles(config.backgroundColor, config.textColor)
  return {
    ...baseStyle,
    ...(config.sticky && { position: 'sticky', top: 0, zIndex: 50 }),
    ...(config.transparent && !config.isScrolled && { backgroundColor: 'transparent' }),
    ...(config.transparent && config.isScrolled && { backgroundColor: 'white' }),
  }
}

/**
 * Builds navigation className string
 */
function buildNavClassName(config: NavStyleConfig): string {
  return [
    config.sticky && 'sticky top-0 z-50',
    config.transparent && !config.isScrolled && 'bg-transparent',
    config.transparent && config.isScrolled && 'bg-white shadow-md',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Navigation Component
 *
 * Renders the main navigation header with logo, links, and optional CTA button.
 * Supports sticky positioning, transparent background with scroll detection,
 * search input, user authentication menu, and mobile menu with separate mobile links.
 *
 * @param props - Navigation configuration
 * @returns Navigation header element
 */
export function Navigation({
  logo,
  logoMobile,
  logoAlt,
  sticky,
  transparent,
  links,
  cta,
  search,
  user,
  backgroundColor,
  textColor,
}: Readonly<NavigationProps>): Readonly<ReactElement> {
  const isScrolled = useScrollDetection(transparent ?? false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const styleConfig: NavStyleConfig = { backgroundColor, textColor, sticky, transparent, isScrolled }
  const navStyle = buildNavStyleObject(styleConfig)
  const navClasses = buildNavClassName(styleConfig)
  const mobileLinks = links?.mobile ?? links?.desktop ?? []

  return (
    <nav
      data-testid="navigation"
      aria-label="Main navigation"
      style={navStyle}
      className={`${navClasses} relative`}
    >
      <NavLogo
        logo={logo}
        logoMobile={logoMobile}
        logoAlt={logoAlt}
      />
      {links?.desktop && (
        <div
          data-testid="nav-links"
          className="hidden gap-4 md:flex"
        >
          {links.desktop.map((link) => (
            <NavLinkItem
              key={link.href}
              link={link}
            />
          ))}
        </div>
      )}
      {mobileLinks.length > 0 && (
        <MobileMenuToggle onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      )}
      {mobileLinks.length > 0 && (
        <MobileMenu
          isOpen={isMobileMenuOpen}
          links={mobileLinks}
        />
      )}
      <NavCTA cta={cta} />
      <NavSearch search={search} />
      <NavUserMenu user={user} />
    </nav>
  )
}
