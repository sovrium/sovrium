/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { renderMetaTags } from './meta-utils'
import type { Page } from '@/domain/models/app/pages'

/**
 * Build Twitter Card field array from twitter card configuration
 * Extracts all fields including app metadata for Twitter/X sharing
 *
 * @param twitterCard - Twitter card configuration
 * @returns Array of field key-value pairs
 */
// eslint-disable-next-line complexity
function buildTwitterCardFields(
  twitterCard: NonNullable<Page['meta']>['twitter']
): ReadonlyArray<{ readonly key: string; readonly value?: string | number }> {
  return [
    { key: 'card', value: twitterCard?.card },
    { key: 'title', value: twitterCard?.title },
    { key: 'description', value: twitterCard?.description },
    { key: 'image', value: twitterCard?.image },
    { key: 'image:alt', value: twitterCard?.imageAlt },
    { key: 'site', value: twitterCard?.site },
    { key: 'creator', value: twitterCard?.creator },
    { key: 'player', value: twitterCard?.player },
    { key: 'player:width', value: twitterCard?.playerWidth },
    { key: 'player:height', value: twitterCard?.playerHeight },
    { key: 'app:name:iphone', value: twitterCard?.appName?.iPhone },
    { key: 'app:name:ipad', value: twitterCard?.appName?.iPad },
    { key: 'app:name:googleplay', value: twitterCard?.appName?.googlePlay },
    { key: 'app:id:iphone', value: twitterCard?.appId?.iPhone },
    { key: 'app:id:ipad', value: twitterCard?.appId?.iPad },
    { key: 'app:id:googleplay', value: twitterCard?.appId?.googlePlay },
  ]
}

/**
 * Render Twitter Card metadata tags
 * Generates <meta name="twitter:*"> tags for Twitter/X sharing
 * Supports both 'twitter' and 'twitterCard' field names for compatibility
 *
 * @param page - Page configuration
 * @returns React fragment with Twitter meta tags
 */
export function TwitterCardMeta({
  page,
}: {
  readonly page: Page
}): Readonly<ReactElement | undefined> {
  // Support both 'twitter' (canonical) and 'twitterCard' (test alias)
  const twitterCard = page.meta?.twitter ?? page.meta?.twitterCard
  if (!twitterCard) {
    return undefined
  }

  const fields = buildTwitterCardFields(twitterCard)
  return renderMetaTags({ fields, prefix: 'twitter', attributeType: 'name' })
}
