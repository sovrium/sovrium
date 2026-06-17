/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Languages } from '@/domain/models/app/languages'
import type { OpenGraph } from '@/domain/models/app/pages/meta'

export interface ContentDirOpenGraph {
  readonly title?: string
  readonly description?: string
  readonly image?: string
}

export interface ContentDirAlternate {
  readonly hreflang: string
  readonly href: string
}

export interface ContentDirSeoMeta {
  readonly canonical: string
  readonly alternates: readonly ContentDirAlternate[]
  readonly openGraph: ContentDirOpenGraph | undefined
  readonly structuredData: readonly Record<string, unknown>[]
}

const LANG_SEGMENT = /(^|\/):lang(\/|$)/

const leadingLanguageCode = (
  pattern: string,
  languages: Languages | undefined
): string | undefined => {
  if (!languages) return undefined
  const firstSegment = pattern.split('/').filter((segment) => segment.length > 0)[0]
  if (firstSegment === undefined) return undefined
  return languages.supported.some((lang) => lang.code === firstSegment) ? firstSegment : undefined
}

const resolveHardcodedLangPath = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>,
  lang: string
): string => resolvePagePath(pattern.replace(/^\/[^/]+/, `/${lang}`), routeParams)

export const resolvePagePath = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>
): string =>
  pattern
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment
      const name = segment.slice(1)
      const value = routeParams[name]
      return typeof value === 'string' && value.length > 0 ? value : segment
    })
    .join('/')

const resolvePathForLang = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>,
  lang: string
): string => resolvePagePath(pattern, { ...routeParams, lang })

const toAbsolute = (path: string, baseUrl: string | undefined): string =>
  baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path

const buildAlternates = (
  pattern: string,
  routeParams: Readonly<Record<string, string>>,
  baseUrl: string | undefined,
  languages: Languages | undefined
): readonly ContentDirAlternate[] => {
  if (!languages || languages.supported.length <= 1) return []

  if (LANG_SEGMENT.test(pattern)) {
    const perLocale = languages.supported.map((lang) => ({
      hreflang: lang.code,
      href: toAbsolute(resolvePathForLang(pattern, routeParams, lang.code), baseUrl),
    }))
    const xDefault: ContentDirAlternate = {
      hreflang: 'x-default',
      href: toAbsolute(resolvePathForLang(pattern, routeParams, languages.default), baseUrl),
    }
    return [...perLocale, xDefault]
  }

  if (leadingLanguageCode(pattern, languages) !== undefined) {
    const perLocale = languages.supported.map((lang) => ({
      hreflang: lang.code,
      href: toAbsolute(resolveHardcodedLangPath(pattern, routeParams, lang.code), baseUrl),
    }))
    const xDefault: ContentDirAlternate = {
      hreflang: 'x-default',
      href: toAbsolute(resolveHardcodedLangPath(pattern, routeParams, languages.default), baseUrl),
    }
    return [...perLocale, xDefault]
  }

  return []
}

const buildOpenGraph = (
  frontmatter: Readonly<Record<string, string>>
): ContentDirOpenGraph | undefined => {
  const { title, description } = frontmatter
  const image = frontmatter['image'] ?? frontmatter['ogImage'] ?? frontmatter['og:image']
  const og: ContentDirOpenGraph = {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
  }
  return Object.keys(og).length > 0 ? og : undefined
}

export const buildContentDirSeoMeta = (input: {
  readonly pattern: string
  readonly routeParams: Readonly<Record<string, string>>
  readonly frontmatter: Readonly<Record<string, string>>
  readonly languages: Languages | undefined
  readonly baseUrl: string | undefined
  readonly structuredData?: readonly Record<string, unknown>[]
}): ContentDirSeoMeta => {
  const { pattern, routeParams, frontmatter, languages, baseUrl, structuredData } = input
  const resolvedPath = resolvePagePath(pattern, routeParams)
  return {
    canonical: toAbsolute(resolvedPath, baseUrl),
    alternates: buildAlternates(pattern, routeParams, baseUrl, languages),
    openGraph: buildOpenGraph(frontmatter),
    structuredData: structuredData ?? [],
  }
}

export const mergeContentDirOpenGraph = (
  openGraphData: OpenGraph | undefined,
  contentDirSeo: ContentDirSeoMeta | undefined
): OpenGraph | undefined => {
  const synthesised = contentDirSeo?.openGraph
  if (!synthesised) return openGraphData
  return { ...synthesised, ...(openGraphData ?? {}) }
}
