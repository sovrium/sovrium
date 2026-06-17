/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
import { renderMetaTags } from './meta-utils'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

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
  {
    key: 'app:url:iphone',
    getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appUrl?.iPhone,
  },
  { key: 'app:url:ipad', getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appUrl?.iPad },
  {
    key: 'app:url:googleplay',
    getter: (tc: NonNullable<Page['meta']>['twitter']) => tc?.appUrl?.googlePlay,
  },
] as const

function buildTwitterCardFields(
  twitterCard: NonNullable<Page['meta']>['twitter']
): ReadonlyArray<{ readonly key: string; readonly value?: string | number }> {
  return twitterCardFieldMapping.map(({ key, getter }) => ({
    key,
    value: getter(twitterCard),
  }))
}

export function TwitterCardMeta({
  page,
  lang,
  languages,
}: {
  readonly page: Page
  readonly lang?: string
  readonly languages?: Languages
}): Readonly<ReactElement | undefined> {
  const twitterCard = page.meta?.twitter ?? page.meta?.twitterCard
  if (!twitterCard) {
    return undefined
  }

  const resolvedCard =
    lang && languages
      ? {
          ...twitterCard,
          ...(typeof twitterCard.title === 'string' && {
            title: resolveTranslationPattern(twitterCard.title, lang, languages),
          }),
          ...(typeof twitterCard.description === 'string' && {
            description: resolveTranslationPattern(twitterCard.description, lang, languages),
          }),
        }
      : twitterCard

  const fields = buildTwitterCardFields(resolvedCard)
  return renderMetaTags({ fields, prefix: 'twitter', attributeType: 'name' })
}
