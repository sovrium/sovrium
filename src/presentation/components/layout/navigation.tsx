/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
import type { Navigation as NavigationProps } from '@/domain/models/app/page/layout/navigation'
import type { NavLink } from '@/domain/models/app/page/layout/navigation/nav-links'
import type { ReactElement } from 'react'

/**
 * Configuration for navigation styling
 */
type NavStyleConfig = Readonly<{
  backgroundColor?: string
  textColor?: string
  sticky?: boolean
  transparent?: boolean
}>

/**
 * Builds navigation inline styles
 */
function buildNavStyleObject(config: NavStyleConfig): Record<string, unknown> {
  const baseStyle = buildColorStyles(config.backgroundColor, config.textColor)

  // Only include baseStyle backgroundColor if NOT using transparent mode
  // In transparent mode, background is controlled by CSS class based on scroll
  const styleWithoutBg =
    config.transparent && baseStyle
      ? Object.fromEntries(Object.entries(baseStyle).filter(([key]) => key !== 'backgroundColor'))
      : baseStyle

  return {
    ...styleWithoutBg,
    ...(config.sticky && { position: 'sticky', top: 0, zIndex: 50 }),
  }
}

/**
 * Builds navigation className string
 */
function buildNavClassName(config: NavStyleConfig): string {
  return [config.sticky && 'sticky top-0 z-50'].filter(Boolean).join(' ')
}

/**
 * Generates inline script for scroll detection (runs immediately in browser)
 * This approach works without React hydration since the app uses SSR without client-side hydration
 *
 * @returns Minified JavaScript code for scroll detection
 */
function getScrollDetectionScript(): string {
  return `(function(){const nav=document.querySelector('[data-testid="navigation"]');if(!nav)return;const transparent=nav.getAttribute('data-transparent')==='true';if(!transparent)return;const threshold=100;function updateNavBackground(){const isScrolled=window.scrollY>threshold;if(isScrolled){nav.style.backgroundColor='white';nav.classList.add('shadow-md');}else{nav.style.backgroundColor='transparent';nav.classList.remove('shadow-md');}}updateNavBackground();window.addEventListener('scroll',updateNavBackground);})();`
}

/**
 * Generates inline script for mobile menu toggling (runs immediately in browser)
 * This approach works without React hydration since the app uses SSR without client-side hydration
 *
 * @returns Minified JavaScript code for mobile menu toggle
 */
function getMobileMenuScript(): string {
  return `(function(){const toggle=document.querySelector('[data-testid="mobile-menu-toggle"]');const menu=document.querySelector('[data-testid="mobile-menu"]');if(!toggle||!menu)return;toggle.addEventListener('click',function(){const isOpen=menu.style.display!=='none';menu.style.display=isOpen?'none':'block';});})();`
}

/**
 * Builds initial inline styles for navigation element
 */
function buildInitialStyle(
  navStyle: Record<string, unknown>,
  transparent?: boolean
): Record<string, unknown> {
  return {
    ...navStyle,
    ...(transparent && { backgroundColor: 'transparent' }),
  }
}

/**
 * Renders desktop navigation links
 */
function DesktopLinks({
  links,
}: Readonly<{
  links: readonly NavLink[] | undefined
}>): ReactElement | undefined {
  if (!links) return undefined

  return (
    <div
      data-testid="nav-links"
      className="hidden gap-4 md:flex"
    >
      {links.map((link) => (
        <NavLinkItem
          key={link.href}
          link={link}
        />
      ))}
    </div>
  )
}

/**
 * Renders language switcher
 */
function LanguageSwitcher({
  languageSwitcher,
}: Readonly<{
  languageSwitcher: NavigationProps['languageSwitcher']
}>): ReactElement | undefined {
  if (!languageSwitcher) return undefined

  return (
    <div
      data-testid="language-switcher"
      className="flex items-center gap-2"
    >
      <span>{languageSwitcher.label}</span>
      {languageSwitcher.items.map((item) => (
        <a
          key={item.lang}
          href={item.href}
          data-testid={`language-link-${item.lang}`}
        >
          {item.label}
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
 * search input, user authentication menu, language switcher, and mobile menu with separate mobile links.
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
  languageSwitcher,
  backgroundColor,
  textColor,
}: Readonly<NavigationProps>): Readonly<ReactElement> {
  const styleConfig: NavStyleConfig = { backgroundColor, textColor, sticky, transparent }
  const navStyle = buildNavStyleObject(styleConfig)
  const navClasses = buildNavClassName(styleConfig)
  const mobileLinks = links?.mobile ?? []
  const initialStyle = buildInitialStyle(navStyle, transparent)
  const hasMobileMenu = mobileLinks.length > 0

  return (
    <>
      <nav
        data-testid="navigation"
        aria-label="Main navigation"
        style={initialStyle}
        className={`${navClasses} relative`}
        data-transparent={transparent}
      >
        <NavLogo
          logo={logo}
          logoMobile={logoMobile}
          logoAlt={logoAlt}
        />
        <DesktopLinks links={links?.desktop} />
        {hasMobileMenu && <MobileMenuToggle />}
        {hasMobileMenu && <MobileMenu links={mobileLinks} />}
        <LanguageSwitcher languageSwitcher={languageSwitcher} />
        <NavCTA cta={cta} />
        <NavSearch search={search} />
        <NavUserMenu user={user} />
      </nav>
      {transparent && (
        <script
          dangerouslySetInnerHTML={{ __html: getScrollDetectionScript() }}
          suppressHydrationWarning
        />
      )}
      {hasMobileMenu && (
        <script
          dangerouslySetInnerHTML={{ __html: getMobileMenuScript() }}
          suppressHydrationWarning
        />
      )}
    </>
  )
}
