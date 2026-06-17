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

const buildBreadcrumbList = (
  frontmatter: Readonly<Record<string, string>>,
  url: string,
  groupBy: string | undefined
): Record<string, unknown> => {
  const sectionField = groupBy ?? 'category'
  const section = frontmatter[sectionField] ?? frontmatter['section'] ?? frontmatter['category']
  const pageName = frontmatter['title'] ?? url
  const sectionItems = section ? [{ '@type': 'ListItem', position: 2, name: section }] : []
  const pagePosition = section ? 3 : 2
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home' },
      ...sectionItems,
      { '@type': 'ListItem', position: pagePosition, name: pageName, item: url },
    ],
  }
}

export const buildContentDirStructuredData = (input: {
  readonly config: ContentDirStructuredDataConfig | undefined
  readonly frontmatter: Readonly<Record<string, string>>
  readonly url: string
  readonly groupBy: string | undefined
}): readonly Record<string, unknown>[] => {
  const { config, frontmatter, url, groupBy } = input
  if (!config?.enabled) return []
  const article = buildArticle(config, frontmatter, url)
  if (config.breadcrumbs === false) return [article]
  return [article, buildBreadcrumbList(frontmatter, url, groupBy)]
}
