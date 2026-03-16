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
 * Twitter Card field mapping configuration
 */
const twitterCardFieldMapping = [
  { key: 'card', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.card },
  { key: 'title', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.title },
  { key: 'description', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.description },
  { key: 'image', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.image },
  { key: 'image:alt', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.imageAlt },
  { key: 'site', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.site },
  { key: 'creator', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.creator },
  { key: 'player', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.player },
  { key: 'player:width', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.playerWidth },
  { key: 'player:height', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.playerHeight },
  {
    key: 'app:name:iphone',
    getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appName?.iPhone,
  },
  { key: 'app:name:ipad', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appName?.iPad },
  {
    key: 'app:name:googleplay',
    getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appName?.googlePlay,
  },
  { key: 'app:id:iphone', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appId?.iPhone },
  { key: 'app:id:ipad', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appId?.iPad },
  {
    key: 'app:id:googleplay',
    getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appId?.googlePlay,
  },
] as const

/**
 * Build Twitter Card field array from twitter card configuration
 * Extracts all fields including app metadata for Twitter/X sharing
 *
 * @param twitterCard - Twitter card configuration
 * @returns Array of field key-value pairs
 */
function buildTwitterCardFields(
  twitterCard: NonNullable<Page['meta']>['twitter']
): ReadonlyArray<{ readonly key: string; readonly value?: string | number }> {
  return twitterCardFieldMapping.map(({ key, getter }) => ({
    key,
    value: getter(twitterCard),
  }))
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
