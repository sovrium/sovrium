/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveGoverningZone } from '@/domain/models/app/design/density-service'
import { yamlString } from './design-md-export'
import type { SurfaceMode } from '@/domain/models/api/admin/design-system/adapter-design-md-surface-brief'

/**
 * The surface briefs written beside a DESIGN.md, one per zone of the app, at
 * `.impeccable/surfaces/<slug>.md` (contract: `adapter-design-md-surface-brief.ts`).
 *
 * ─── A ZONE IS ITS NAME ────────────────────────────────────────────────────
 *
 * Several `design.zones[]` entries naming one zone are one surface and get one
 * brief. Its pages are the ones `resolveGoverningZone` gives it, so a brief
 * names exactly the pages that render in that zone.
 *
 * ─── THE FILES, NOT THE ROUTES ─────────────────────────────────────────────
 *
 * A brief targets the files the surface is made of: the file holding its
 * first page in config order, then its other files. A zone whose page file
 * also holds another zone's page gets no brief, because a brief would claim a
 * file it shares; nor does a zone no page renders in. The caller reports both.
 *
 * ─── THE MODE ──────────────────────────────────────────────────────────────
 *
 * Read from the zone's name first, then from its patterns, and said to be not
 * inferred rather than guessed when neither tells.
 */

/** One page, with the file holding it relative to the DESIGN.md folder (`/`-separated). */
export interface SurfacePage {
  readonly name: string
  readonly path: string
  readonly file: string
}

/** What the briefs are drawn from. */
export interface SurfaceBriefsInput {
  readonly zones: readonly { readonly pattern: string; readonly zone: string }[] | undefined
  /** Every page, in config order. */
  readonly pages: readonly SurfacePage[]
  /** The app's language codes, stripped from a lang-prefixed page path before matching. */
  readonly languageCodes?: readonly string[]
}

/** One brief, at its path relative to the DESIGN.md folder. */
export interface SurfaceBrief {
  readonly path: string
  readonly content: string
}

/** A zone that got no brief, and why. */
export interface SkippedSurface {
  readonly zone: string
  readonly reason: 'shared-file' | 'no-page'
}

/** What one zone comes to: a brief, or a reason it has none. */
type Outcome = { readonly brief: SurfaceBrief } | { readonly skipped: SkippedSurface }

/** The words a zone name is read by, per Mode, in the order they are tried. */
const MODE_WORDS: readonly (readonly [SurfaceMode, readonly string[]])[] = [
  [
    'Operate',
    [
      'product',
      'app',
      'admin',
      'console',
      'dashboard',
      'portal',
      'account',
      'settings',
      'internal',
      'backoffice',
      'workspace',
    ],
  ],
  [
    'Read',
    [
      'documentation',
      'docs',
      'doc',
      'help',
      'guide',
      'guides',
      'knowledge',
      'kb',
      'wiki',
      'blog',
      'articles',
      'news',
      'legal',
    ],
  ],
  ['Experience', ['gallery', 'portfolio', 'showcase', 'exhibition', 'lookbook', 'story']],
  [
    'Persuade',
    [
      'marketing',
      'landing',
      'home',
      'public',
      'website',
      'site',
      'sales',
      'pricing',
      'campaign',
      'launch',
    ],
  ],
]

/** The route families a pattern is read by, when the zone's name tells nothing. */
const MODE_PATTERNS: readonly (readonly [SurfaceMode, RegExp])[] = [
  ['Operate', /^\/(?:admin|app)(?:\/|$)|^\/(?:dashboard|settings|account)/],
  ['Read', /^\/(?:docs|help|blog|kb)(?:\/|$)/],
]

/**
 * The Mode of a zone, from its name's words, else from any of its patterns;
 * `undefined` when neither tells.
 */
export const inferSurfaceMode = (
  zone: string,
  patterns: readonly string[]
): SurfaceMode | undefined => {
  const words = zone
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
  const byName = MODE_WORDS.find(([, list]) => words.some((word) => list.includes(word)))
  if (byName !== undefined) return byName[0]
  const trimmed = patterns.map((pattern) => pattern.trim().toLowerCase())
  return MODE_PATTERNS.find(([, family]) => trimmed.some((pattern) => family.test(pattern)))?.[0]
}

/** The slug of a target: lowercased, every run of other characters one `-`, trimmed. */
export const surfaceSlugOf = (target: string): string =>
  target
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** The phrase `everything else` that makes an entry the catch-all. */
const CATCH_ALL = /^everything\s+else$/i

/** Where a zone's pages are, in words. */
const scopeOf = (zone: string, patterns: readonly string[], pages: readonly SurfacePage[]) => {
  const routed = patterns.filter((pattern) => !CATCH_ALL.test(pattern.trim()))
  const where = [
    ...(routed.length === 0 ? [] : [`the pages under ${routed.map((p) => `\`${p}\``).join(', ')}`]),
    ...(routed.length < patterns.length ? ['the pages no other zone claims'] : []),
  ].join(', and ')
  const listed = pages.map((page) => `${page.name} (\`${page.path}\`)`).join(', ')
  return `The \`${zone}\` zone, ${where}: ${listed}.`
}

/** One brief's text. */
const briefContent = (
  zone: string,
  patterns: readonly string[],
  pages: readonly SurfacePage[],
  files: readonly string[]
): string => {
  const [target = '', ...related] = files
  const mode = inferSurfaceMode(zone, patterns)
  return [
    '---',
    'version: 1',
    `slug: ${yamlString(surfaceSlugOf(target))}`,
    `primary_target: ${yamlString(target)}`,
    `related_targets: [${related.map(yamlString).join(', ')}]`,
    '---',
    '',
    '## Scope and mode',
    '',
    mode === undefined
      ? 'Mode: not inferred. Choose Operate, Read, Persuade or Experience.'
      : `Mode: ${mode}`,
    '',
    scopeOf(zone, patterns, pages),
    '',
  ].join('\n')
}

/**
 * One brief per zone that owns its page files, and the zones that got none.
 * Briefs are listed in the order the zones are declared.
 */
export const renderSurfaceBriefs = (
  input: SurfaceBriefsInput
): { readonly briefs: readonly SurfaceBrief[]; readonly skipped: readonly SkippedSurface[] } => {
  const zones = input.zones ?? []
  const zoneOf = (page: SurfacePage): string | undefined =>
    resolveGoverningZone(zones, page.path, input.languageCodes ?? [])
  const placed = input.pages.map((page) => ({ page, zone: zoneOf(page) }))
  const zonesOfFile = (file: string): ReadonlySet<string> =>
    new Set(
      placed.flatMap(({ page, zone }) => (page.file === file && zone !== undefined ? [zone] : []))
    )
  const outcomes = [...new Set(zones.map((entry) => entry.zone))].map((zone): Outcome => {
    const pages = placed.filter((entry) => entry.zone === zone).map(({ page }) => page)
    const files = [...new Set(pages.map((page) => page.file))]
    if (pages.length === 0) return { skipped: { zone, reason: 'no-page' } }
    if (files.some((file) => zonesOfFile(file).size > 1)) {
      return { skipped: { zone, reason: 'shared-file' } }
    }
    const patterns = zones.filter((entry) => entry.zone === zone).map((entry) => entry.pattern)
    const content = briefContent(zone, patterns, pages, files)
    return { brief: { path: `.impeccable/surfaces/${surfaceSlugOf(files[0] ?? '')}.md`, content } }
  })
  return {
    briefs: outcomes.flatMap((outcome) => ('brief' in outcome ? [outcome.brief] : [])),
    skipped: outcomes.flatMap((outcome) => ('skipped' in outcome ? [outcome.skipped] : [])),
  }
}
