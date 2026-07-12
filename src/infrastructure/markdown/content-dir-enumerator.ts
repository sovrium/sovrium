/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { isAbsolute, resolve } from 'node:path'
import { splitFrontmatter } from '@/domain/services/markdown/markdown-renderer'
import { matchesContentDirFilter } from '@/domain/utils/content-dir/content-dir-filter'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'

export interface ContentDirEntry {
  readonly slug: string
  readonly title: string
  readonly section: string | undefined
  readonly group: string | undefined
  readonly description: string | undefined
  readonly path: string
}

interface ParsedFile {
  readonly relativePath: string
  readonly frontmatter: Readonly<Record<string, string>>
  readonly body: string
}

export interface ContentDirBody {
  readonly entry: ContentDirEntry
  readonly body: string
}

const normaliseDirectory = (directory: string): string => directory.replace(/\/+$/, '')

const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

const getContentBaseDir = (): string => {
  const override = process.env['SOVRIUM_CONTENT_DIR']
  return typeof override === 'string' && override.length > 0 ? override : process.cwd()
}

const deriveSlug = (relativePath: string, slugFrom: ContentDir['slugFrom']): string => {
  const withoutExt = stripLeadingSlash(relativePath).replace(/\.md$/i, '')
  if (slugFrom === 'filepath') return withoutExt
  const segments = withoutExt.split('/')
  return segments[segments.length - 1] ?? withoutExt
}

const buildPath = (pagePath: string, slug: string): string => {
  const prefix = pagePath.replace(/\/:[^/]+\*?$/, '').replace(/\/\*$/, '')
  const normalisedPrefix = prefix === '' ? '' : prefix.replace(/\/+$/, '')
  return `${normalisedPrefix}/${slug}`
}

const scanMarkdownFiles = async (
  directory: string,
  include: string | undefined
): Promise<readonly string[]> => {
  try {
    const absoluteDir = isAbsolute(directory) ? directory : resolve(getContentBaseDir(), directory)
    const pattern = include ?? '**/*.md'
    const glob = new Bun.Glob(pattern)
    return await Array.fromAsync(glob.scan({ cwd: absoluteDir }))
  } catch {
    return []
  }
}

const readFile = async (
  directory: string,
  relativePath: string
): Promise<ParsedFile | undefined> => {
  try {
    const absolutePath = isAbsolute(directory)
      ? `${directory}/${relativePath}`
      : resolve(getContentBaseDir(), directory, relativePath)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    const { frontmatter, body } = splitFrontmatter(await file.text())
    return { relativePath, frontmatter, body }
  } catch {
    return undefined
  }
}

const sortFiles = (
  files: readonly ParsedFile[],
  sort: ContentDir['sort'],
  slugFrom: ContentDir['slugFrom']
): readonly ParsedFile[] => {
  if (sort === undefined) {
    return files.toSorted((a, b) =>
      deriveSlug(a.relativePath, slugFrom).localeCompare(deriveSlug(b.relativePath, slugFrom))
    )
  }
  const direction = sort.direction ?? sort.order ?? 'asc'
  return files.toSorted((a, b) => {
    const av = a.frontmatter[sort.field] ?? ''
    const bv = b.frontmatter[sort.field] ?? ''
    const an = Number(av)
    const bn = Number(bv)
    const numeric = Number.isFinite(an) && Number.isFinite(bn) && av !== '' && bv !== ''
    const diff = numeric ? an - bn : av.localeCompare(bv)
    return direction === 'asc' ? diff : -diff
  })
}

const toEntry = (
  file: ParsedFile,
  contentDir: ContentDir,
  pagePath: string,
  groupByField: string | undefined
): ContentDirEntry => {
  const slug = deriveSlug(file.relativePath, contentDir.slugFrom)
  const { title } = file.frontmatter
  const section = file.frontmatter['section'] ?? file.frontmatter['category']
  const group = groupByField ? (file.frontmatter[groupByField] ?? section) : section
  return {
    slug,
    title: typeof title === 'string' && title.length > 0 ? title : slug,
    section,
    group,
    description: file.frontmatter['description'],
    path: buildPath(pagePath, slug),
  }
}

const collectSortedFiles = async (contentDir: ContentDir): Promise<readonly ParsedFile[]> => {
  const directory = normaliseDirectory(contentDir.directory)
  const relativePaths = await scanMarkdownFiles(directory, contentDir.include)
  const parsed = await Promise.all(relativePaths.map((path) => readFile(directory, path)))
  const present = parsed.filter((file): file is ParsedFile => file !== undefined)
  const filtered = present.filter((file) =>
    matchesContentDirFilter(contentDir.filter, file.frontmatter)
  )
  return sortFiles(filtered, contentDir.sort, contentDir.slugFrom)
}

export const enumerateContentDir = async (
  contentDir: ContentDir,
  pagePath: string
): Promise<readonly ContentDirEntry[]> => {
  const sorted = await collectSortedFiles(contentDir)
  const groupByField = contentDir.nav?.groupBy
  return sorted.map((file) => toEntry(file, contentDir, pagePath, groupByField))
}

export const readContentDirBodies = async (
  contentDir: ContentDir,
  pagePath: string
): Promise<readonly ContentDirBody[]> => {
  const sorted = await collectSortedFiles(contentDir)
  const groupByField = contentDir.nav?.groupBy
  return sorted.map((file) => ({
    entry: toEntry(file, contentDir, pagePath, groupByField),
    body: file.body,
  }))
}

export const readContentDirBodyForSlug = async (
  contentDir: ContentDir,
  slug: string
): Promise<string | undefined> => {
  const sorted = await collectSortedFiles(contentDir)
  const match = sorted.find((file) => deriveSlug(file.relativePath, contentDir.slugFrom) === slug)
  return match?.body
}
