/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Publish `apps/website/` to the public GitHub repo `github.com/sovrium/website`
 * — a READ-ONLY, source-available reference showing a real production Sovrium
 * configuration end to end. Not a template: no `is_template`, no "Use this
 * template" button, no one-click deploy.
 *
 * Model: MIRROR, not move. The monorepo stays the source of truth. Because the
 * repo accepts no pull requests, the publish is a destructive overlay (clone →
 * wipe → copy → commit) exactly like publish-template-repos.ts — safe precisely
 * because nothing is ever authored on the GitHub side. If that policy is ever
 * reversed, this script MUST be rewritten to pull before it pushes; a merged PR
 * would otherwise be silently erased by the next sync.
 *
 * History: the mirror starts from a fresh `Initial import` commit and never
 * carries monorepo history — commit messages there reference internal specs,
 * decision records, and workstreams that are not public.
 *
 * Flags: --version <x.y.z> (required) · --dry-run · --create
 * Env:   GH_TOKEN (fine-grained PAT scoped to sovrium/website: Contents write +
 *        Metadata read; Administration only for a --create bootstrap run)
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { CONFIG_TYPES_DECLARATION } from '../../src/infrastructure/assets/embedded-config-types.generated'
import { syncInstallScript } from './sync-install-script'
import { copyWebsitePayload } from './website-payload'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const WEBSITE_ROOT = join(PROJECT_ROOT, 'apps', 'website')
const META_ROOT = join(import.meta.dir, 'website-repo-meta')
const ORG = 'sovrium'
const REPO = 'website'

export interface CliOptions {
  readonly version: string
  readonly dryRun: boolean
  readonly create: boolean
}

export function parseCliOptions(argv: readonly string[]): CliOptions {
  const versionIdx = argv.indexOf('--version')
  const version = versionIdx >= 0 ? (argv[versionIdx + 1] ?? '') : ''
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    throw new Error(`--version is required and must be semver (got: ${JSON.stringify(version)})`)
  }
  return { version, dryRun: argv.includes('--dry-run'), create: argv.includes('--create') }
}

/** Meta files overlaid onto the payload. Source name → published name. */
const META_FILES: ReadonlyArray<readonly [string, string]> = [
  ['README.md', 'README.md'],
  ['gitignore', '.gitignore'],
  ['package.json.tmpl', 'package.json'],
  ['tsconfig.json.tmpl', 'tsconfig.json'],
]

/** Must exist in every published tree, or the mirror is broken. */
export const REQUIRED_FILES = [
  'app.ts',
  'config/languages.ts',
  'content/docs/en/installation.md',
  'content/docs/fr/installation.md',
  'README.md',
  'LICENSE.md',
  'package.json',
  'tsconfig.json',
  '.gitignore',
  // The ambient `declare module 'sovrium'` the payload's ~30 type-only imports
  // resolve against. Generated here rather than tracked, so it always matches
  // the schema of the release being published. Required because without it the
  // published repo's `bun run typecheck` fails on every config file with
  // TS2307 — the exact breakage that made `@sovrium/types` a dependency in the
  // first place.
  'sovrium.d.ts',
  // Generated from install.sh, not tracked. Required here because it is the
  // target of `curl -fsSL https://sovrium.com/install | sh` — publishing a
  // website without it silently breaks the primary distribution path, and this
  // walk reads the FILESYSTEM, so an unsynced tree would simply omit it.
  'public/install',
] as const

/**
 * Paths that must NEVER reach the mirror. Fail-closed canaries: if a future
 * change to the payload builder lets one through, the publish aborts loudly
 * instead of leaking.
 */
export const FORBIDDEN_PATHS = [
  /(^|\/)\.env($|\.)/,
  /(^|\/)\.sovrium/,
  /(^|\/)CLAUDE\.md$/,
  /(^|\/)\.claude($|\/)/,
  /^(docs|specs|src|scripts)\//,
  /(^|\/)\.forgejo($|\/)/,
  /(^|\/)SPEC-PROGRESS\.md$/,
  /(^|\/)\.buildpacks$/,
  /(^|\/)Procfile$/,
  /^public\/thomas-jeanneau\.jpg$/,
  /^public\/schema\/app\.json$/,
] as const

/**
 * Strings that must not appear in any published text file.
 *
 * Each term catches a genuine infra or secret leak. Some infra-adjacent words are
 * deliberately ABSENT, because each is legitimate public content that would
 * deadlock the pipeline as a false positive:
 *   - `scalingo`  — the docs ship a public "Deploy on Scalingo" button
 * - `[internal ref]` — listed as a supported deployment target
 *   - `tailscale` — cited in a comment as a visual design reference
 * - `[internal ref]` — "[internal ref] Object Storage" is a documented S3-compatible
 *                   storage provider in the user docs; the infra host stays
 *                   covered by the specific terms below and never reaches the payload
 * - `[internal ref]` — documents each template's checked-in Claude Code bundle
 * - `[internal ref]` — prose explaining the binary reads embedded assets
 *   - `CLAUDE.md` — `sovrium init` WRITES a per-template CLAUDE.md into the
 *                   user's project, so the CLI and template docs must name the
 *                   file to describe the product truthfully. A bare filename
 *                   match cannot tell that artifact from this monorepo's own
 *                   CLAUDE.md, and blocked the v0.20.0 release on four accurate
 *                   doc lines. The FILE still can never ship — FORBIDDEN_PATHS
 *                   covers it — and the two fingerprints below keep prose
 *                   coverage aimed at what only the internal file can be.
 * Note `[internal ref]` was dropped for this same reason, which had
 * left the guard permitting `[internal ref]`
 *                   while forbidding the sibling CLAUDE.md the same scaffold writes.
 * - `[internal ref]` + `[internal ref]` — dropped by founder decision (2026-08-11):
 *                   the "How Sovrium is built" docs article deliberately names
 *                   both as public transparency about the development model,
 *                   and it ships in this payload (it is equally public on
 *                   sovrium.com either way). The leak surface stays covered by
 *                   the SPECIFIC terms below: the bare product name is fine to
 *                   say; the hostnames, VM names, and bot identity are not.
 */
export const FORBIDDEN_CONTENT = [
  'git.sovrium.com',
  'sovrium-runner',
  'sovrium-git',
  'TDD_BOT',
  'apps/website/',
  // Fingerprints of THIS repo's CLAUDE.md: its H1, and the `@docs/` on-demand
  // import convention it uses 52 times. Neither occurs in legitimate public prose.
  'CLAUDE.md - Sovrium',
  '@docs/',
  'runs-on:',
  'ghp_',
  'github_pat_',
  'xoxb-',
  '51.15.214.190',
  '163.172.134.3',
  '163.172.175.246',
] as const

/**
 * Rewrites applied to the licence's "Additional Resources" block — metadata,
 * NOT licence terms, which are copied verbatim. Both targets are unresolvable
 * for a public reader: the canonical repository is self-hosted, and TRADEMARK.md
 * is not part of this mirror.
 */
export const LICENSE_SUBSTITUTIONS: ReadonlyArray<readonly [string, string]> = [
  ['https://git.sovrium.com/sovrium/sovrium', 'https://github.com/sovrium/sovrium'],
  ['See `TRADEMARK.md` for Sovrium trademark usage', 'See https://sovrium.com/docs/trademark'],
]

/** Extensions worth scanning for leaked strings (text formats only). */
const TEXT_EXT = /\.(ts|tsx|md|json|txt|svg|webmanifest|ya?ml|html|css|js)$/i

const MIN_DOC_FILES = 200
const MIN_TOTAL_FILES = 250

/**
 * Ceilings on how much of ONE published area a single overlay may delete.
 *
 * Keyed on the top-level payload entry, because that is the unit a botched build
 * actually loses: `copyWebsitePayload` iterates WEBSITE_PAYLOAD_ENTRIES, so a
 * dropped entry or a `shouldIncludePath` regression takes out an area, not a
 * uniform slice of the tree.
 *
 * A single tree-wide ratio cannot express that. Measured against the real
 * v0.18.1 → v0.21.0 mirror diff — 38 deletions, every one of them an intentional
 * removal — the areas churn at wildly different rates:
 *
 *     content/    2/266    0.8%   the substance of the mirror, ~70% of the tree
 *     config/    14/43    32.6%   small and volatile: retired pages, forms, tables
 *     public/    22/63    34.9%   small and volatile: retired OG images, screenshots
 *
 * so one number is simultaneously too tight and too loose. Too tight: that
 * ordinary churn totals 10.02%, which tripped the old flat 10% ceiling by four
 * hundredths of a percent and blocked the v0.21.0 publish. Too loose: losing ALL
 * of `config/` is only 11% of the tree, and that share keeps shrinking as the
 * docs grow — a tree-wide ratio gets blinder the bigger the mirror gets, which
 * is backwards.
 *
 * The denominator is the last SUCCESSFULLY PUBLISHED tree, and this workflow
 * publishes on a `deploy:` marker rather than on a release, so these ratios must
 * absorb several releases' worth of churn, not one. Headroom is deliberate:
 * roughly 2x the worst observed rate for the volatile areas, ~30x for content,
 * whose near-zero churn is what makes a tight ceiling there both safe and worth
 * having.
 */
const MAX_DELETE_RATIO: Readonly<Record<string, number>> = { content: 0.25 }

/** Ceiling for any area without an explicit entry above. */
const DEFAULT_MAX_DELETE_RATIO = 0.6

/** List every file in `dir`, as paths relative to it. */
export function listFiles(dir: string): string[] {
  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((e) => {
      const full = join(current, e.name)
      return e.isDirectory() ? walk(full) : [relative(dir, full)]
    })
  return walk(dir).sort()
}

/**
 * The four fail-closed guards, adapted from scripts/filtered-mirror.sh. Pure over
 * an injected file list + reader so the whole guard surface is unit-testable.
 */
export function assertMirrorSafety(
  files: readonly string[],
  readText: (relPath: string) => string
): void {
  const present = new Set(files)
  for (const required of REQUIRED_FILES) {
    if (!present.has(required)) throw new Error(`mirror is missing a required file: ${required}`)
  }

  for (const file of files) {
    const forbidden = FORBIDDEN_PATHS.find((pattern) => pattern.test(file))
    if (forbidden !== undefined) {
      throw new Error(`forbidden path leaked into the mirror: ${file} (matched ${forbidden})`)
    }
  }

  for (const file of files.filter((f) => TEXT_EXT.test(f))) {
    const haystack = readText(file).toLowerCase()
    for (const term of FORBIDDEN_CONTENT) {
      if (haystack.includes(term.toLowerCase())) {
        throw new Error(`forbidden content "${term}" found in the mirror at ${file}`)
      }
    }
  }

  const docs = files.filter((f) => f.startsWith('content/docs/') && f.endsWith('.md'))
  if (docs.length < MIN_DOC_FILES) {
    throw new Error(`mirror has only ${docs.length} doc files (expected >= ${MIN_DOC_FILES})`)
  }
  if (files.length < MIN_TOTAL_FILES) {
    throw new Error(`mirror has only ${files.length} files (expected >= ${MIN_TOTAL_FILES})`)
  }
}

/**
 * Refuse an overlay that would gut an area of what is already published — the
 * signature of a botched payload build, which the count guards alone would miss
 * whenever the surviving areas and the meta files pad the total back over the
 * floor.
 *
 * Measured per area rather than tree-wide; see MAX_DELETE_RATIO for why. Real
 * removals are scattered and bounded within an area, so they stay under the
 * ceilings; a lost payload entry takes its whole area to 100% and trips
 * regardless of how small that area is relative to the tree.
 */
const areaOf = (file: string): string => (file.includes('/') ? file.split('/')[0]! : '<root>')

export function assertNotMassDeletion(
  published: readonly string[],
  next: readonly string[]
): void {
  if (published.length === 0) return
  const incoming = new Set(next)

  const tally = new Map<string, { published: number; deleted: number }>()
  for (const file of published) {
    if (file.startsWith('.git/')) continue
    const area = areaOf(file)
    const seen = tally.get(area) ?? { published: 0, deleted: 0 }
    tally.set(area, {
      published: seen.published + 1,
      deleted: seen.deleted + (incoming.has(file) ? 0 : 1),
    })
  }

  for (const [area, { published: total, deleted }] of tally) {
    const ceiling = MAX_DELETE_RATIO[area] ?? DEFAULT_MAX_DELETE_RATIO
    const ratio = deleted / total
    if (ratio > ceiling) {
      throw new Error(
        `refusing to delete ${deleted}/${total} published files in ${area} ` +
          `(${Math.round(ratio * 100)}% > ${Math.round(ceiling * 100)}%) — likely a botched build`
      )
    }
  }
}

/** Build the full publish tree: stripped payload + meta overlay + licence. */
export function buildMirrorTree(
  version: string,
  destDir: string,
  roots: { readonly website: string; readonly meta: string; readonly project: string } = {
    website: WEBSITE_ROOT,
    meta: META_ROOT,
    project: PROJECT_ROOT,
  }
): void {
  // The served installer is generated, not tracked. Produce it before the walk:
  // this copier reads the filesystem, and REQUIRED_FILES makes its absence fail
  // the publish closed rather than shipping a site without an install one-liner.
  syncInstallScript()
  copyWebsitePayload(roots.website, destDir, { stripPublicAssets: true })

  for (const [from, to] of META_FILES) {
    const source = join(roots.meta, from)
    if (!existsSync(source)) throw new Error(`missing repo-meta file: ${from}`)
    Bun.write(join(destDir, to), readFileSync(source, 'utf-8').replaceAll('{{VERSION}}', version))
  }

  // The mirror's licence is the monorepo's BSL text verbatim plus a
  // reserved-rights clause for trademarks and brand assets. Composed rather than
  // duplicated so the BSL terms can never drift between the two copies.
  const license = LICENSE_SUBSTITUTIONS.reduce(
    (text, [from, to]) => text.replaceAll(from, to),
    readFileSync(join(roots.project, 'LICENSE.md'), 'utf-8')
  )
  const appendix = readFileSync(join(roots.meta, 'LICENSE-APPENDIX.md'), 'utf-8')
  Bun.write(join(destDir, 'LICENSE.md'), `${license.trimEnd()}\n${appendix}`)

  // The config types, written out exactly as `sovrium types` would write them
  // into any user's project. This is what lets the published repo type-check
  // with no npm dependency at all: every `import type … from 'sovrium'` in the
  // payload resolves against this ambient declaration, and `import type` is
  // erased before the binary ever loads the config.
  Bun.write(join(destDir, 'sovrium.d.ts'), CONFIG_TYPES_DECLARATION)
}

const run = (cmd: readonly string[], cwd?: string): string => {
  const proc = Bun.spawnSync([...cmd], { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (proc.exitCode !== 0) {
    throw new Error(`command failed (${proc.exitCode}): ${cmd.join(' ')}\n${proc.stderr.toString()}`)
  }
  return proc.stdout.toString().trim()
}

const tryRun = (cmd: readonly string[], cwd?: string): { ok: boolean; out: string } => {
  const proc = Bun.spawnSync([...cmd], { cwd, stdout: 'pipe', stderr: 'pipe' })
  return { ok: proc.exitCode === 0, out: proc.stdout.toString().trim() }
}

/**
 * Ensure the repo exists. Unlike the template mirrors, CI never creates it: the
 * one-time bootstrap is a supervised manual run, so the CI token needs no
 * Administration scope.
 *
 * The existence probe is curl, not `gh`, deliberately — the CI path must depend
 * only on git and curl, both already present on the default-deny runner.
 * Installing the GitHub CLI there just to read one status code would be a second
 * thing to keep working. `gh` is used only on the --create bootstrap path, which
 * runs from a maintainer's machine.
 */
const ensureRepo = (opts: CliOptions): void => {
  const token = process.env['GH_TOKEN'] ?? ''
  const probe = tryRun([
    'curl',
    '-s',
    '-o',
    '/dev/null',
    '-w',
    '%{http_code}',
    '-H',
    `Authorization: Bearer ${token}`,
    '-H',
    'Accept: application/vnd.github+json',
    `https://api.github.com/repos/${ORG}/${REPO}`,
  ])
  if (probe.ok && probe.out === '200') return
  if (!opts.create) {
    throw new Error(
      `repo ${ORG}/${REPO} not reachable (HTTP ${probe.out || 'error'}) — ` +
        `run the one-time bootstrap with --create, or check GH_TOKEN scope`
    )
  }
  console.log(`  creating ${ORG}/${REPO}`)
  run([
    'gh',
    'repo',
    'create',
    `${ORG}/${REPO}`,
    '--public',
    '--description',
    'The Sovrium configuration that runs sovrium.com — a source-available reference, not a template.',
    '--homepage',
    'https://sovrium.com',
  ])
}

/** Clone main, replace the tree, commit + tag + push (never forced, idempotent). */
const pushTree = (treeDir: string, version: string): 'pushed' | 'unchanged' => {
  const token = process.env['GH_TOKEN'] ?? ''
  const remote = `https://x-access-token:${token}@github.com/${ORG}/${REPO}.git`
  const cloneDir = join(treeDir, '..', `${REPO}-clone`)
  const cloned = tryRun(['git', 'clone', '--depth', '1', remote, cloneDir]).ok
  if (!cloned) {
    // Empty repo (first publish): init a fresh clone directory instead.
    mkdirSync(cloneDir, { recursive: true })
    run(['git', 'init', '-b', 'main'], cloneDir)
    run(['git', 'remote', 'add', 'origin', remote], cloneDir)
  } else {
    assertNotMassDeletion(
      listFiles(cloneDir).filter((f) => !f.startsWith('.git/')),
      listFiles(treeDir)
    )
  }
  run(['git', 'rm', '-rqf', '--ignore-unmatch', '.'], cloneDir)
  cpSync(treeDir, cloneDir, { recursive: true })
  run(['git', 'add', '-A'], cloneDir)
  if (run(['git', 'status', '--porcelain'], cloneDir) === '') {
    console.log(`  unchanged (already at ${version})`)
    return 'unchanged'
  }
  run(
    [
      'git',
      '-c',
      'user.name=sovrium-release-bot',
      '-c',
      'user.email=release@sovrium.com',
      'commit',
      '-m',
      cloned ? `sovrium ${version}` : 'Initial import',
    ],
    cloneDir
  )
  const tagExists = tryRun(['git', 'ls-remote', '--tags', 'origin', `v${version}`], cloneDir)
  if (tagExists.ok && tagExists.out === '') {
    run(['git', 'tag', `v${version}`], cloneDir)
    run(['git', 'push', 'origin', 'main', `v${version}`], cloneDir)
  } else {
    run(['git', 'push', 'origin', 'main'], cloneDir)
  }
  console.log(`  published ${version}`)
  return 'pushed'
}

const main = (): void => {
  const opts = parseCliOptions(process.argv.slice(2))
  const workRoot = join(PROJECT_ROOT, '.website-publish')
  rmSync(workRoot, { recursive: true, force: true })
  const treeDir = join(workRoot, REPO)

  console.log(`Publishing ${ORG}/${REPO} at v${opts.version}${opts.dryRun ? ' [dry-run]' : ''}`)
  buildMirrorTree(opts.version, treeDir)

  const files = listFiles(treeDir)
  assertMirrorSafety(files, (rel) => readFileSync(join(treeDir, rel), 'utf-8'))
  const bytes = files.reduce((sum, f) => sum + statSync(join(treeDir, f)).size, 0)
  console.log(`  guards passed — ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB`)

  if (opts.dryRun) {
    const docs = files.filter((f) => f.startsWith('content/docs/')).length
    console.log(`  would publish ${files.length} files (${docs} docs) as ${ORG}/${REPO}`)
    rmSync(workRoot, { recursive: true, force: true })
    return
  }

  ensureRepo(opts)
  pushTree(treeDir, opts.version)
  rmSync(workRoot, { recursive: true, force: true })
  console.log(`✓ ${ORG}/${REPO} publish complete`)
}

if (import.meta.main) {
  main()
}
