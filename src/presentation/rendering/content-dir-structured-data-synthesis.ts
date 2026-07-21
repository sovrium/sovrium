/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  buildContentDirSeoMeta,
  resolvePagePath,
  type ContentDirSeoMeta,
} from '@/domain/utils/content-dir/content-dir-seo-meta'
import {
  buildContentDirStructuredData,
  parseStructuredDataConfig,
} from '@/domain/utils/content-dir/content-dir-structured-data'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { DocsRootCrumb } from '@/presentation/ui/pages/markdown/DocsRootCrumb'

function buildContentDirSynthesisedJsonLd(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  baseUrl: string | undefined,
  docsRootCrumb: DocsRootCrumb | undefined
): readonly Record<string, unknown>[] {
  if (page.meta?.schema !== undefined) return []
  const config = parseStructuredDataConfig(page.meta?.structuredData)
  if (config === undefined) return []
  const resolvedPath = resolvePagePath(page.path, routeParams)
  const toAbsolute = (path: string): string =>
    baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path
  const rootCrumb =
    docsRootCrumb !== undefined
      ? { name: docsRootCrumb.name, url: toAbsolute(docsRootCrumb.href) }
      : undefined
  return buildContentDirStructuredData({
    config,
    frontmatter,
    url: toAbsolute(resolvedPath),
    groupBy: page.contentDir?.nav?.groupBy,
    ...(rootCrumb !== undefined && { rootCrumb }),
  })
}

export function buildContentDirSeo(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  frontmatter: Readonly<Record<string, string>>,
  app: App | undefined,
  indexBasePathPattern?: string,
  docsRootCrumb?: DocsRootCrumb
): ContentDirSeoMeta | undefined {
  if (page.contentDir === undefined) return undefined
  const baseUrl = typeof Bun.env.BASE_URL === 'string' ? Bun.env.BASE_URL : undefined
  return buildContentDirSeoMeta({
    pattern: indexBasePathPattern ?? page.path,
    routeParams,
    frontmatter,
    languages: app?.languages,
    baseUrl,
    structuredData: buildContentDirSynthesisedJsonLd(
      page,
      routeParams,
      frontmatter,
      baseUrl,
      docsRootCrumb
    ),
  })
}
