/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Link Attributes Utility
 *
 * Provides consistent, secure link attribute generation across all components.
 * Automatically adds security attributes (rel="noopener noreferrer") when target="_blank".
 */

export interface LinkProps {
  readonly href: string
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly 'data-testid'?: string
  readonly rel?: string
}

/**
 * Generates secure link attributes with proper rel attribute for external links
 *
 * @param href - The link URL
 * @param target - The target attribute value (optional)
 * @param testId - The data-testid value (optional)
 * @returns Link props object with security attributes
 *
 * @example
 * ```tsx
 * // Internal link
 * <a {...getLinkAttributes('/about', '_self', 'nav-link')}>About</a>
 *
 * // External link (automatically adds rel="noopener noreferrer")
 * <a {...getLinkAttributes('https://example.com', '_blank', 'nav-link')}>External</a>
 * ```
 */
export function getLinkAttributes(
  href: string,
  target?: '_self' | '_blank' | '_parent' | '_top',
  testId?: string
): Readonly<LinkProps> {
  return {
    href,
    ...(target && { target }),
    ...(target === '_blank' && { rel: 'noopener noreferrer' }),
    ...(testId && { 'data-testid': testId }),
  }
}
