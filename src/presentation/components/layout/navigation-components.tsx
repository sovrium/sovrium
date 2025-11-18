/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Button } from '@/presentation/components/ui/button'
import { Icon } from '@/presentation/components/ui/icon'
import { getLinkAttributes } from '@/presentation/utils/link-attributes'
import type { Navigation as NavigationProps } from '@/domain/models/app/page/layout/navigation'
import type { NavLink } from '@/domain/models/app/page/layout/navigation/nav-links'
import type { ReactElement } from 'react'

/**
 * Renders a badge for navigation links
 */
function NavBadge({ badge }: Readonly<{ badge: string }>): Readonly<ReactElement> {
  return (
    <span
      data-testid="badge"
      className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white"
    >
      {badge}
    </span>
  )
}

/**
 * Renders link content (icon, label, badge) - DRY helper
 */
function NavLinkContent({ link }: Readonly<{ link: NavLink }>): Readonly<ReactElement> {
  return (
    <>
      {link.icon && <Icon name={link.icon} />}
      {link.label}
      {link.badge && <NavBadge badge={link.badge} />}
    </>
  )
}

/**
 * NavLinkItem Component
 *
 * Renders a single navigation link with support for icons, badges, and dropdowns.
 * Handles smooth scrolling for anchor links (href starting with #).
 * Supports unlimited nesting depth via recursive rendering.
 */
export function NavLinkItem({
  link,
  depth = 0,
}: Readonly<{ link: NavLink; depth?: number }>): Readonly<ReactElement> {
  const hasChildren = link.children && link.children.length > 0
  const isTopLevel = depth === 0
  const isNested = depth > 0
  const testId = isTopLevel ? 'nav-link' : 'nav-link-nested'
  const linkProps = getLinkAttributes(link.href, link.target, testId)
  const isAnchorLink = link.href.startsWith('#')

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isAnchorLink) {
      e.preventDefault()
      const targetId = link.href.slice(1)
      const targetElement = document.getElementById(targetId)
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  if (hasChildren) {
    // Top-level: dropdown appears below, Nested: dropdown appears to the right
    const dropdownPosition = isTopLevel
      ? 'top-full left-0 mt-1'
      : 'top-0 left-full ml-1'
    const linkClassName = isNested
      ? 'block px-4 py-2 hover:bg-gray-100'
      : 'flex items-center gap-2'

    return (
      <div className="group/item relative">
        <a
          {...linkProps}
          className={linkClassName}
          onClick={handleAnchorClick}
        >
          <NavLinkContent link={link} />
        </a>
        <div
          data-testid="nav-dropdown"
          className={`absolute ${dropdownPosition} hidden rounded bg-white p-2 shadow-lg group-hover/item:block`}
        >
          {link.children?.map((child: NavLink) => (
            <NavLinkItem
              key={child.href}
              link={child}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <a
      {...linkProps}
      className={isNested ? 'block px-4 py-2 hover:bg-gray-100' : 'flex items-center gap-2'}
      onClick={handleAnchorClick}
    >
      <NavLinkContent link={link} />
    </a>
  )
}

/**
 * Logo Component
 */
export function NavLogo({
  logo,
  logoMobile,
  logoAlt,
}: Readonly<{ logo: string; logoMobile?: string; logoAlt?: string }>): Readonly<ReactElement> {
  const altText = logoAlt ?? 'Logo'
  const logoLabel = `Go to homepage - ${altText}`

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
export function NavCTA({
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
export function NavSearch({
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
export function NavUserMenu({
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
export function MobileMenuToggle({
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
export function MobileMenu({
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
