/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface ContentDirStructuredDataConfig {
  readonly enabled?: boolean
  readonly type?: 'TechArticle' | 'Article'
  readonly breadcrumbs?: boolean
  readonly organization?: string
}

const SCHEMA_CONTEXT = 'https://schema.org' as const
const DEFAULT_ARTICLE_TYPE = 'TechArticle' as const

export const parseStructuredDataConfig = (
  raw: unknown
): ContentDirStructuredDataConfig | undefined => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const candidate = raw as Record<string, unknown>
  if (candidate.enabled !== true) return undefined
  return {
    enabled: true,
    type: candidate.type === 'Article' ? 'Article' : DEFAULT_ARTICLE_TYPE,
    breadcrumbs: candidate.breadcrumbs !== false,
    ...(typeof candidate.organization === 'string' ? { organization: candidate.organization } : {}),
  }
}

const parseDatePublished = (frontmatter: Readonly<Record<string, string>>): string | undefined => {
  const raw = frontmatter['date'] ?? frontmatter['datePublished'] ?? frontmatter['published']
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

const buildArticle = (
  config: ContentDirStructuredDataConfig,
  frontmatter: Readonly<Record<string, string>>,
  url: string
): Record<string, unknown> => {
  const { title: headline, description } = frontmatter
  const datePublished = parseDatePublished(frontmatter)
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': config.type ?? DEFAULT_ARTICLE_TYPE,
    ...(headline ? { headline } : {}),
    ...(description ? { description } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(config.organization
      ? { publisher: { '@type': 'Organization', name: config.organization } }
      : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
}

export interface BreadcrumbRootCrumb {
  readonly name: string
  readonly url: string
}

const buildRootCrumbItems = (
  rootCrumb: BreadcrumbRootCrumb | undefined,
  url: string
): readonly { readonly name: string; readonly item?: string }[] => {
  if (rootCrumb === undefined) return [{ name: 'Home' }]
  if (rootCrumb.url === url) return []
  return [{ name: rootCrumb.name, item: rootCrumb.url }]
}

const buildBreadcrumbList = (
  frontmatter: Readonly<Record<string, string>>,
  url: string,
  groupBy: string | undefined,
  rootCrumb: BreadcrumbRootCrumb | undefined
): Record<string, unknown> => {
  const sectionField = groupBy ?? 'category'
  const rawSection = frontmatter[sectionField] ?? frontmatter['section'] ?? frontmatter['category']
  const pageName = frontmatter['title'] ?? url

  const sectionRedundant =
    rootCrumb !== undefined && rawSection !== undefined && rawSection === rootCrumb.name
  const section = sectionRedundant ? undefined : rawSection

  const rootItems = buildRootCrumbItems(rootCrumb, url)
  const sectionItems: readonly { readonly name: string }[] =
    section !== undefined ? [{ name: section }] : []
  const pageItem = { name: pageName, item: url }

  const itemListElement = [...rootItems, ...sectionItems, pageItem].map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    ...item,
  }))

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}

export const buildContentDirStructuredData = (input: {
  readonly config: ContentDirStructuredDataConfig | undefined
  readonly frontmatter: Readonly<Record<string, string>>
  readonly url: string
  readonly groupBy: string | undefined
  readonly rootCrumb?: BreadcrumbRootCrumb
}): readonly Record<string, unknown>[] => {
  const { config, frontmatter, url, groupBy, rootCrumb } = input
  if (!config?.enabled) return []
  const article = buildArticle(config, frontmatter, url)
  if (config.breadcrumbs === false) return [article]
  return [article, buildBreadcrumbList(frontmatter, url, groupBy, rootCrumb)]
}
