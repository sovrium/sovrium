/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { isAbsolute, resolve } from 'node:path'
import { splitFrontmatter } from '@/domain/services/markdown/markdown-renderer'
import { matchesContentDirFilter } from '@/domain/utils/content-dir/content-dir-filter'
import { getContentBaseDir } from '@/presentation/rendering/content-base-dir'
import { humanizeFieldName } from '@/presentation/utils/string-utils'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'

export interface CollectionNavEntry {
  readonly slug: string
  readonly href: string
  readonly label: string
  readonly group: string | undefined
  readonly groupLabel: string | undefined
  readonly order: number | undefined
  readonly isCurrent: boolean
}

export interface CollectionPrevNext {
  readonly href: string
  readonly label: string
}

export interface CollectionNavData {
  readonly sidebar: readonly CollectionNavEntry[]
  readonly previous: CollectionPrevNext | undefined
  readonly next: CollectionPrevNext | undefined
  readonly collapsed: boolean
}

interface ContentDirFile {
  readonly slug: string
  readonly frontmatter: Readonly<Record<string, string>>
}

const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

const normaliseDirectory = (directory: string): string => directory.replace(/\/+$/, '')

const filePathToSlug = (relativePath: string): string =>
  stripLeadingSlash(relativePath).replace(/\.md$/i, '')

const readContentDirFile = async (
  directory: string,
  relativePath: string
): Promise<ContentDirFile | undefined> => {
  try {
    const absolutePath = isAbsolute(directory)
      ? `${directory}/${relativePath}`
      : resolve(getContentBaseDir(), directory, relativePath)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    const text = await file.text()
    const { frontmatter } = splitFrontmatter(text)
    return { slug: filePathToSlug(relativePath), frontmatter }
  } catch {
    return undefined
  }
}

const scanMarkdownFiles = async (directory: string): Promise<readonly string[]> => {
  try {
    const absoluteDir = isAbsolute(directory) ? directory : resolve(getContentBaseDir(), directory)
    const glob = new Bun.Glob('**/*.md')
    return await Array.fromAsync(glob.scan({ cwd: absoluteDir }))
  } catch {
    return []
  }
}

const compareByField = (
  field: string,
  direction: 'asc' | 'desc',
  a: ContentDirFile,
  b: ContentDirFile
): number => {
  const av = a.frontmatter[field] ?? ''
  const bv = b.frontmatter[field] ?? ''
  const an = Number(av)
  const bn = Number(bv)
  const numeric = Number.isFinite(an) && Number.isFinite(bn) && av !== '' && bv !== ''
  const diff = numeric ? an - bn : av.localeCompare(bv)
  return direction === 'asc' ? diff : -diff
}

const sortFiles = (
  files: readonly ContentDirFile[],
  sort: ContentDir['sort']
): readonly ContentDirFile[] => {
  if (sort === undefined) return files.toSorted((a, b) => a.slug.localeCompare(b.slug))
  const direction = sort.direction ?? sort.order ?? 'asc'
  return files.toSorted((a, b) => compareByField(sort.field, direction, a, b))
}

const deriveLabel = (file: ContentDirFile, labelFrom: string | undefined): string => {
  if (typeof labelFrom === 'string') {
    const value = file.frontmatter[labelFrom]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return file.slug
}

const buildHref = (pagePath: string, slug: string): string => {
  const prefix = pagePath.replace(/\/:[^/]+\*?$/, '')
  const normalisedPrefix = prefix === '' ? '' : prefix.replace(/\/+$/, '')
  return `${normalisedPrefix}/${slug}`
}

const resolveGroupLabel = (
  group: string | undefined,
  groupLabels: Readonly<Record<string, string>> | undefined
): string | undefined => {
  if (group === undefined) return undefined
  return groupLabels?.[group] ?? humanizeFieldName(group)
}

const buildSidebarEntries = (
  files: readonly ContentDirFile[],
  contentDir: ContentDir,
  pagePath: string,
  currentSlug: string | undefined
): readonly CollectionNavEntry[] => {
  const labelFrom = contentDir.nav?.labelFrom
  const groupBy = contentDir.nav?.groupBy
  const groupLabels = contentDir.nav?.groupLabels
  return files.map((file) => {
    const orderRaw = file.frontmatter['order']
    const orderNum = orderRaw === undefined ? undefined : Number(orderRaw)
    const group = typeof groupBy === 'string' ? file.frontmatter[groupBy] : undefined
    return {
      slug: file.slug,
      href: buildHref(pagePath, file.slug),
      label: deriveLabel(file, labelFrom),
      group,
      groupLabel: resolveGroupLabel(group, groupLabels),
      order: Number.isFinite(orderNum) ? orderNum : undefined,
      isCurrent: currentSlug !== undefined && file.slug === currentSlug,
    }
  })
}

const loadFilteredFiles = async (contentDir: ContentDir): Promise<readonly ContentDirFile[]> => {
  const directory = normaliseDirectory(contentDir.directory)
  const relativePaths = await scanMarkdownFiles(directory)
  const fileRecords = await Promise.all(
    relativePaths.map((path) => readContentDirFile(directory, path))
  )
  const presentFiles = fileRecords.filter((file): file is ContentDirFile => file !== undefined)
  const filteredFiles = presentFiles.filter((file) =>
    matchesContentDirFilter(contentDir.filter, file.frontmatter)
  )
  return sortFiles(filteredFiles, contentDir.sort)
}

const buildPrevNext = (
  entries: readonly CollectionNavEntry[],
  currentSlug: string | undefined
): { previous: CollectionPrevNext | undefined; next: CollectionPrevNext | undefined } => {
  if (currentSlug === undefined) return { previous: undefined, next: undefined }
  const idx = entries.findIndex((entry) => entry.slug === currentSlug)
  if (idx < 0) return { previous: undefined, next: undefined }
  const prevEntry = idx > 0 ? entries[idx - 1] : undefined
  const nextEntry = idx < entries.length - 1 ? entries[idx + 1] : undefined
  return {
    previous: prevEntry ? { href: prevEntry.href, label: prevEntry.label } : undefined,
    next: nextEntry ? { href: nextEntry.href, label: nextEntry.label } : undefined,
  }
}

export const listContentDir = async (
  contentDir: ContentDir,
  pagePath: string,
  currentSlug: string | undefined
): Promise<CollectionNavData> => {
  const files = await loadFilteredFiles(contentDir)
  const sidebar = buildSidebarEntries(files, contentDir, pagePath, currentSlug)
  const { previous, next } = buildPrevNext(sidebar, currentSlug)
  return { sidebar, previous, next, collapsed: contentDir.nav?.collapsed === true }
}
