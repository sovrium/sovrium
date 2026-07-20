/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
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

const META_FILES: ReadonlyArray<readonly [string, string]> = [
  ['README.md', 'README.md'],
  ['gitignore', '.gitignore'],
  ['package.json.tmpl', 'package.json'],
  ['tsconfig.json.tmpl', 'tsconfig.json'],
]

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
] as const

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

export const FORBIDDEN_CONTENT = [
  'git.sovrium.com',
  'forgejo',
  'scaleway',
  'sovrium-runner',
  'sovrium-git',
  'TDD_BOT',
  'SPEC-PROGRESS',
  'apps/website/',
  'CLAUDE.md',
  'runs-on:',
  'ghp_',
  'github_pat_',
  'xoxb-',
  '51.15.214.190',
  '163.172.134.3',
  '163.172.175.246',
] as const

export const LICENSE_SUBSTITUTIONS: ReadonlyArray<readonly [string, string]> = [
  ['https://git.sovrium.com/sovrium/sovrium', 'https://github.com/sovrium/sovrium'],
  ['See `TRADEMARK.md` for Sovrium trademark usage', 'See https://sovrium.com/docs/trademark'],
]

const TEXT_EXT = /\.(ts|tsx|md|json|txt|svg|webmanifest|ya?ml|html|css|js)$/i

const MIN_DOC_FILES = 200
const MIN_TOTAL_FILES = 250
const MAX_DELETE_RATIO = 0.1

export function listFiles(dir: string): string[] {
  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((e) => {
      const full = join(current, e.name)
      return e.isDirectory() ? walk(full) : [relative(dir, full)]
    })
  return walk(dir).sort()
}

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

export function assertNotMassDeletion(
  published: readonly string[],
  next: readonly string[]
): void {
  if (published.length === 0) return
  const incoming = new Set(next)
  const deleted = published.filter((f) => !incoming.has(f) && !f.startsWith('.git/'))
  const ratio = deleted.length / published.length
  if (ratio > MAX_DELETE_RATIO) {
    throw new Error(
      `refusing to delete ${deleted.length}/${published.length} published files ` +
        `(${Math.round(ratio * 100)}% > ${MAX_DELETE_RATIO * 100}%) — likely a botched build`
    )
  }
}

export function buildMirrorTree(
  version: string,
  destDir: string,
  roots: { readonly website: string; readonly meta: string; readonly project: string } = {
    website: WEBSITE_ROOT,
    meta: META_ROOT,
    project: PROJECT_ROOT,
  }
): void {
  copyWebsitePayload(roots.website, destDir, { stripPublicAssets: true })

  for (const [from, to] of META_FILES) {
    const source = join(roots.meta, from)
    if (!existsSync(source)) throw new Error(`missing repo-meta file: ${from}`)
    Bun.write(join(destDir, to), readFileSync(source, 'utf-8').replaceAll('{{VERSION}}', version))
  }

  const license = LICENSE_SUBSTITUTIONS.reduce(
    (text, [from, to]) => text.replaceAll(from, to),
    readFileSync(join(roots.project, 'LICENSE.md'), 'utf-8')
  )
  const appendix = readFileSync(join(roots.meta, 'LICENSE-APPENDIX.md'), 'utf-8')
  Bun.write(join(destDir, 'LICENSE.md'), `${license.trimEnd()}\n${appendix}`)
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

const pushTree = (treeDir: string, version: string): 'pushed' | 'unchanged' => {
  const token = process.env['GH_TOKEN'] ?? ''
  const remote = `https://x-access-token:${token}@github.com/${ORG}/${REPO}.git`
  const cloneDir = join(treeDir, '..', `${REPO}-clone`)
  const cloned = tryRun(['git', 'clone', '--depth', '1', remote, cloneDir]).ok
  if (!cloned) {
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
