/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDirSeoMeta } from '@/domain/utils/content-dir/content-dir-seo-meta'


function HreflangLinks({
  page,
  languages,
}: {
  readonly page: Page
  readonly languages: Languages | undefined
}): ReactElement | undefined {
  if (!languages || languages.supported.length <= 1) {
    return undefined
  }

  const basePath = page.path === '/' ? '' : page.path

  return (
    <>
      {languages.supported.map((lang) => {
        const hreflang = lang.locale || lang.code
        return (
          <link
            key={lang.code}
            rel="alternate"
            hrefLang={hreflang}
            href={`/${lang.code}${basePath}/`}
          />
        )
      })}
      <link
        key="x-default"
        rel="alternate"
        hrefLang="x-default"
        href={`/${languages.default}${basePath}/`}
      />
    </>
  )
}

function ContentDirHreflangLinks({
  alternates,
}: {
  readonly alternates: ContentDirSeoMeta['alternates']
}): ReactElement | undefined {
  if (alternates.length === 0) return undefined
  return (
    <>
      {alternates.map((alt) => (
        <link
          key={alt.hreflang}
          rel="alternate"
          hrefLang={alt.hreflang}
          href={alt.href}
        />
      ))}
    </>
  )
}

export function HreflangSection({
  page,
  languages,
  contentDirSeo,
}: {
  readonly page: Page
  readonly languages: Languages | undefined
  readonly contentDirSeo: ContentDirSeoMeta | undefined
}): ReactElement | undefined {
  if (contentDirSeo?.alternates?.length) {
    return <ContentDirHreflangLinks alternates={contentDirSeo.alternates} />
  }
  return (
    <HreflangLinks
      page={page}
      languages={languages}
    />
  )
}
