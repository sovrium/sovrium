/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface LinkProps {
  readonly href: string
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly 'data-testid'?: string
  readonly rel?: string
}

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
