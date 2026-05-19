/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { normalizeFavicons } from '@/application/metadata/favicon-transformer'
import { renderInlineScriptTag, renderScriptTag } from '@/presentation/scripts/script-renderers'
import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
import {
  AnalyticsHead,
  CustomElementsHead,
  DnsPrefetchLinks,
  FaviconLink,
  FaviconSetLinks,
  OpenGraphMeta,
  PreloadLinks,
  StructuredDataScript,
  TwitterCardMeta,
} from '@/presentation/ui/metadata'
import type { GroupedScripts } from './PageScripts'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { CustomElement, OpenGraph } from '@/domain/models/app/pages/meta'
import type { Theme } from '@/domain/models/app/theme'

type PageHeadProps = {
  readonly page: Page
  readonly theme: Theme | undefined
  readonly directionStyles: string
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly lang: string
  readonly languages?: Languages
  readonly scripts: GroupedScripts
}

function hasCustomViewportMeta(customElements: readonly CustomElement[] | undefined): boolean {
  if (!customElements) return false
  return customElements.some(
    (element) => element.type === 'meta' && element.attrs?.name === 'viewport'
  )
}

function extractOpenGraphData(
  page: Page,
  lang: string,
  languages: Languages | undefined
): OpenGraph | undefined {
  if (!page.meta) return undefined

  const openGraph = page.meta.openGraph || {}

  const metaRecord = page.meta as Record<string, unknown>
  const ogSiteName = metaRecord['og:site_name']

  const resolvedSiteName =
    typeof ogSiteName === 'string'
      ? resolveTranslationPattern(ogSiteName, lang, languages)
      : undefined

  const merged = {
    ...openGraph,
    ...(resolvedSiteName && { siteName: resolvedSiteName }),
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

function BasicMetaTags({
  title,
  description,
  keywords,
  canonical,
  hasCustomViewport,
}: {
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly hasCustomViewport: boolean
}): ReactElement {
  return (
    <>
      <meta charSet="UTF-8" />
      {!hasCustomViewport && (
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
      )}
      <title>{title}</title>
      {description && (
        <meta
          name="description"
          content={description}
        />
      )}
      {keywords && (
        <meta
          name="keywords"
          content={keywords}
        />
      )}
      {canonical && (
        <link
          rel="canonical"
          href={canonical}
        />
      )}
    </>
  )
}

function ThemeFonts({ theme }: { readonly theme: Theme | undefined }): ReactElement | undefined {
  if (!theme?.fonts) return undefined

  return (
    <>
      {Object.values(theme.fonts).map((font, index) =>
        font.url ? (
          <link
            key={`font-${index}`}
            rel="stylesheet"
            href={font.url}
          />
        ) : undefined
      )}
    </>
  )
}

function CustomStylesheet({
  stylesheet,
}: {
  readonly stylesheet: string | undefined
}): ReactElement | undefined {
  if (!stylesheet) return undefined

  return (
    <link
      rel="stylesheet"
      href={stylesheet}
    />
  )
}

function GoogleFonts({
  googleFonts,
}: {
  readonly googleFonts: string | undefined
}): ReactElement | undefined {
  if (!googleFonts) return undefined

  return (
    <>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href={googleFonts}
      />
    </>
  )
}

function GlobalStyles({ directionStyles }: { readonly directionStyles: string }): ReactElement {
  return (
    <>
      <link
        rel="stylesheet"
        href="/assets/output.css"
      />
      {}
      <style dangerouslySetInnerHTML={{ __html: directionStyles }} />
    </>
  )
}

function HeadScripts({ scripts }: { readonly scripts: GroupedScripts }): ReactElement {
  return (
    <>
      {scripts.external.head.map((script, index) =>
        renderScriptTag({
          src: script.src,
          async: script.async,
          defer: script.defer,
          module: script.module,
          integrity: script.integrity,
          crossOrigin: script.crossorigin,
          reactKey: `head-${index}`,
        })
      )}
      {scripts.inline.head.map((script, index) =>
        renderInlineScriptTag({
          code: script.code,
          async: script.async,
          reactKey: `inline-head-${index}`,
        })
      )}
    </>
  )
}

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

export function PageHead({
  page,
  theme,
  directionStyles,
  title,
  description,
  keywords,
  canonical,
  lang,
  languages,
  scripts,
}: PageHeadProps): Readonly<ReactElement> {
  const hasCustomViewport = hasCustomViewportMeta(page.meta?.customElements)
  const openGraphData = extractOpenGraphData(page, lang, languages)
  const normalizedFavicons = normalizeFavicons(page.meta?.favicons)

  return (
    <>
      <BasicMetaTags
        title={title}
        description={description}
        keywords={keywords}
        canonical={canonical}
        hasCustomViewport={hasCustomViewport}
      />
      <OpenGraphMeta
        openGraph={openGraphData}
        lang={lang}
        languages={languages}
      />
      <TwitterCardMeta page={page} />
      <StructuredDataScript page={page} />
      <PreloadLinks preload={page.meta?.preload} />
      <DnsPrefetchLinks dnsPrefetch={page.meta?.dnsPrefetch} />
      <HreflangLinks
        page={page}
        languages={languages}
      />
      <AnalyticsHead analytics={page.meta?.analytics} />
      <CustomElementsHead customElements={page.meta?.customElements} />
      <FaviconLink favicon={page.meta?.favicon} />
      <FaviconSetLinks favicons={normalizedFavicons} />
      <CustomStylesheet stylesheet={page.meta?.stylesheet} />
      <GoogleFonts googleFonts={page.meta?.googleFonts} />
      <ThemeFonts theme={theme} />
      <GlobalStyles directionStyles={directionStyles} />
      <HeadScripts scripts={scripts} />
    </>
  )
}
