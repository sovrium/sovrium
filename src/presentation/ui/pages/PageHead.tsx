/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { normalizeFavicons } from '@/application/metadata/favicon-transformer'
import {
  mergeContentDirOpenGraph,
  type ContentDirSeoMeta,
} from '@/domain/utils/content-dir/content-dir-seo-meta'
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
import { HreflangSection } from './PageHeadSeo'
import { ThemeColorSchemeScript } from './ThemeColorSchemeScript'
import type { GroupedScripts } from './PageScripts'
import type { Components } from '@/domain/models/app/components'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { CustomElement, OpenGraph } from '@/domain/models/app/pages/meta'
import type { Theme } from '@/domain/models/app/theme'

type PageHeadProps = {
  readonly page: Page
  readonly components?: Components
  readonly theme: Theme | undefined
  readonly directionStyles: string
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly lang: string
  readonly languages?: Languages
  readonly scripts: GroupedScripts
  readonly contentDirSeo?: ContentDirSeoMeta
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

function resolveRobotsDirective(page: Page): string | undefined {
  const robots = page.meta?.robots
  if (typeof robots === 'string' && robots.length > 0) return robots
  return page.meta?.noindex === true ? 'noindex' : undefined
}

function BasicMetaTags({
  title,
  description,
  keywords,
  canonical,
  robots,
  hasCustomViewport,
}: {
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly robots?: string
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
      {robots && (
        <meta
          name="robots"
          content={robots}
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

function computeHeadMeta(props: PageHeadProps): {
  readonly openGraphData: OpenGraph | undefined
  readonly effectiveCanonical: string | undefined
  readonly synthesizedJsonLd: readonly Record<string, unknown>[]
} {
  const { page, lang, languages, canonical, contentDirSeo } = props
  return {
    openGraphData: mergeContentDirOpenGraph(
      extractOpenGraphData(page, lang, languages),
      contentDirSeo
    ),
    effectiveCanonical: contentDirSeo?.canonical ?? canonical,
    synthesizedJsonLd: contentDirSeo?.structuredData ?? [],
  }
}

export function PageHead(props: PageHeadProps): Readonly<ReactElement> {
  const { page, theme, directionStyles, title, description, keywords, lang, languages, scripts } =
    props
  const { components, contentDirSeo } = props
  const hasCustomViewport = hasCustomViewportMeta(page.meta?.customElements)
  const normalizedFavicons = normalizeFavicons(page.meta?.favicons)
  const robots = resolveRobotsDirective(page)
  const { openGraphData, effectiveCanonical, synthesizedJsonLd } = computeHeadMeta(props)

  return (
    <>
      <BasicMetaTags
        title={title}
        description={description}
        keywords={keywords}
        canonical={effectiveCanonical}
        robots={robots}
        hasCustomViewport={hasCustomViewport}
      />
      {}
      <ThemeColorSchemeScript
        page={page}
        components={components}
        theme={theme}
      />
      <OpenGraphMeta
        openGraph={openGraphData}
        lang={lang}
        languages={languages}
      />
      <TwitterCardMeta
        page={page}
        lang={lang}
        languages={languages}
      />
      <StructuredDataScript
        page={page}
        synthesized={synthesizedJsonLd}
      />
      <PreloadLinks preload={page.meta?.preload} />
      <DnsPrefetchLinks dnsPrefetch={page.meta?.dnsPrefetch} />
      <HreflangSection
        page={page}
        languages={languages}
        contentDirSeo={contentDirSeo}
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
