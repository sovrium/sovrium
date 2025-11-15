/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Button } from '@/presentation/components/ui/button'
import type { Navigation as NavigationProps } from '@/domain/models/app/page/layout/navigation'
import type { ReactElement } from 'react'

/**
 * Build navigation inline styles from props
 */
function buildNavigationStyle(
  backgroundColor: string | undefined,
  textColor: string | undefined
): React.CSSProperties | undefined {
  const hasBackgroundColor = backgroundColor !== undefined
  const hasTextColor = textColor !== undefined

  if (!hasBackgroundColor && !hasTextColor) {
    return undefined
  }

  return {
    ...(hasBackgroundColor && { backgroundColor }),
    ...(hasTextColor && { color: textColor }),
  }
}

/**
 * Navigation Component
 *
 * Renders the main navigation header with logo, links, and optional CTA button.
 *
 * @param props - Navigation configuration
 * @returns Navigation header element
 */
export function Navigation({
  logo,
  links,
  cta,
  backgroundColor,
  textColor,
}: Readonly<NavigationProps>): Readonly<ReactElement> {
  const navStyle = buildNavigationStyle(backgroundColor, textColor)

  return (
    <nav
      data-testid="navigation"
      style={navStyle}
    >
      <a
        href="/"
        data-testid="nav-logo-link"
      >
        <img
          data-testid="nav-logo"
          src={logo}
          alt="Logo"
        />
      </a>
      {links?.desktop && (
        <div
          data-testid="nav-links"
          className="flex gap-4"
        >
          {links.desktop.map((link) => (
            <a
              key={link.href}
              href={link.href}
              data-testid="nav-link"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
      {cta && (
        <Button
          asChild
          variant={cta.variant}
          size={cta.size}
          color={cta.color}
          icon={cta.icon}
          iconPosition={cta.iconPosition}
          data-testid="nav-cta"
        >
          <a href={cta.href}>{cta.text}</a>
        </Button>
      )}
    </nav>
  )
}
