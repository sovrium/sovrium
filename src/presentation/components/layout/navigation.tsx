/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import { Button } from '@/presentation/components/ui/button'
import { buildColorStyles } from '@/presentation/utils/styles'
import type { Navigation as NavigationProps } from '@/domain/models/app/page/layout/navigation'
import type { NavLink } from '@/domain/models/app/page/layout/navigation/nav-links'
import type { ReactElement } from 'react'

/**
 * NavLinkItem Component
 *
 * Renders a single navigation link with support for icons, badges, and dropdowns.
 *
 * @param link - Navigation link configuration
 * @returns Navigation link element
 */
function NavLinkItem({ link }: Readonly<{ link: NavLink }>): Readonly<ReactElement> {
  const hasChildren = link.children && link.children.length > 0

  const linkProps = {
    href: link.href,
    'data-testid': 'nav-link',
    ...(link.target && { target: link.target }),
    ...(link.target === '_blank' && { rel: 'noopener noreferrer' }),
  }

  if (hasChildren) {
    return (
      <div className="group relative">
        <a
          {...linkProps}
          className="flex items-center gap-2"
        >
          {link.label}
          {link.badge && (
            <span
              data-testid="badge"
              className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white"
            >
              {link.badge}
            </span>
          )}
        </a>
        <div
          data-testid="nav-dropdown"
          className="absolute top-full left-0 mt-1 hidden rounded bg-white p-2 shadow-lg group-hover:block"
        >
          {link.children?.map((child: NavLink) => (
            <a
              key={child.href}
              href={child.href}
              className="block px-4 py-2 hover:bg-gray-100"
            >
              {child.label}
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <a
      {...linkProps}
      className="flex items-center gap-2"
    >
      {link.label}
      {link.badge && (
        <span
          data-testid="badge"
          className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white"
        >
          {link.badge}
        </span>
      )}
    </a>
  )
}

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
 * Builds navigation style and className
 */
function buildNavStyles(config: NavStyleConfig): {
  style: Record<string, unknown>
  className: string
} {
  const baseStyle = buildColorStyles(config.backgroundColor, config.textColor)
  const style = {
    ...baseStyle,
    ...(config.sticky && { position: 'sticky', top: 0, zIndex: 50 }),
    ...(config.transparent && !config.isScrolled && { backgroundColor: 'transparent' }),
    ...(config.transparent && config.isScrolled && { backgroundColor: 'white' }),
  }

  const className = [
    config.sticky && 'sticky top-0 z-50',
    config.transparent && !config.isScrolled && 'bg-transparent',
    config.transparent && config.isScrolled && 'bg-white shadow-md',
  ]
    .filter(Boolean)
    .join(' ')

  return { style, className }
}

/**
 * Logo Component
 */
function NavLogo({
  logo,
  logoMobile,
  logoAlt,
}: Readonly<{ logo: string; logoMobile?: string; logoAlt?: string }>): Readonly<ReactElement> {
  const altText = logoAlt ?? 'Logo'

  const logoLabel = `Go to homepage - ${altText}`

  // If logoMobile is provided, render both with responsive classes
  if (logoMobile) {
    return (
      <a
        href="/"
        data-testid="nav-logo-link"
        aria-label={logoLabel}
      >
        <img
          data-testid="nav-logo"
          src={logo}
          alt={altText}
          className="hidden md:block"
        />
        <img
          data-testid="nav-logo-mobile"
          src={logoMobile}
          alt={altText}
          className="block md:hidden"
        />
      </a>
    )
  }

  // Otherwise render only the desktop logo
  return (
    <a
      href="/"
      data-testid="nav-logo-link"
      aria-label={logoLabel}
    >
      <img
        data-testid="nav-logo"
        src={logo}
        alt={altText}
      />
    </a>
  )
}

/**
 * CTA Button Component
 */
function NavCTA({
  cta,
}: Readonly<{ cta: NavigationProps['cta'] }>): Readonly<ReactElement | undefined> {
  if (!cta) return undefined

  return (
    <Button
      asChild
      variant={cta.variant}
      size={cta.size}
      color={cta.color}
      icon={cta.icon}
      iconPosition={cta.iconPosition}
    >
      <a
        href={cta.href}
        data-testid="nav-cta"
        role="button"
      >
        {cta.text}
      </a>
    </Button>
  )
}

/**
 * Search Input Component
 */
function NavSearch({
  search,
}: Readonly<{ search: NavigationProps['search'] }>): Readonly<ReactElement | undefined> {
  if (!search?.enabled) return undefined

  return (
    <div data-testid="nav-search">
      <input
        type="search"
        placeholder={search.placeholder ?? 'Search...'}
        aria-label={search.placeholder ?? 'Search...'}
        className="search-input"
      />
    </div>
  )
}

/**
 * User Menu Component
 */
function NavUserMenu({
  user,
}: Readonly<{ user: NavigationProps['user'] }>): Readonly<ReactElement | undefined> {
  if (!user?.enabled) return undefined

  return (
    <div data-testid="user-menu">
      <a
        href={user.loginUrl}
        data-testid="login-link"
      >
        Login
      </a>
      <a
        href={user.signupUrl}
        data-testid="signup-link"
      >
        Sign Up
      </a>
    </div>
  )
}

/**
 * Mobile Menu Toggle Component
 */
function MobileMenuToggle({
  onClick,
}: Readonly<{ onClick: () => void }>): Readonly<ReactElement> {
  return (
    <button
      type="button"
      data-testid="mobile-menu-toggle"
      onClick={onClick}
      className="block md:hidden"
      aria-label="Toggle mobile menu"
    >
      ☰
    </button>
  )
}

/**
 * Mobile Menu Component
 */
function MobileMenu({
  isOpen,
  links,
}: Readonly<{ isOpen: boolean; links: readonly NavLink[] }>): Readonly<ReactElement> {
  return (
    <div
      data-testid="mobile-menu"
      className="absolute top-full left-0 z-50 w-full bg-white shadow-lg"
      style={{ display: isOpen ? 'block' : 'none' }}
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="block px-4 py-2 hover:bg-gray-100"
        >
          {link.label}
        </a>
      ))}
    </div>
  )
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
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!transparent) return
    const handleScroll = () => setIsScrolled(window.scrollY > 100)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [transparent])

  const styleConfig: NavStyleConfig = {
    backgroundColor,
    textColor,
    sticky,
    transparent,
    isScrolled,
  }
  const { style: navStyle, className: navClasses } = buildNavStyles(styleConfig)

  // Use mobile links if available, otherwise fallback to desktop links
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
