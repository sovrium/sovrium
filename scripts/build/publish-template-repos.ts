/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TEMPLATES_ROOT = join(PROJECT_ROOT, 'templates')
const ORG = 'sovrium'

export const repoName = (slug: string): string => `${slug}-template`

interface CatalogEntry {
  readonly name: string
  readonly description: string
  readonly category: string
  readonly topics: readonly string[]
}

interface CliOptions {
  readonly version: string
  readonly dryRun: boolean
  readonly only: string | null
  readonly create: boolean
}

export function parseCliOptions(argv: readonly string[]): CliOptions {
  const versionIdx = argv.indexOf('--version')
  const version = versionIdx >= 0 ? (argv[versionIdx + 1] ?? '') : ''
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    throw new Error(`--version is required and must be semver (got: ${JSON.stringify(version)})`)
  }
  const onlyIdx = argv.indexOf('--only')
  return {
    version,
    dryRun: argv.includes('--dry-run'),
    only: onlyIdx >= 0 ? (argv[onlyIdx + 1] ?? null) : null,
    create: argv.includes('--create'),
  }
}

export function readCatalog(root: string = TEMPLATES_ROOT): Readonly<Record<string, CatalogEntry>> {
  const raw = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf-8')) as Record<
    string,
    CatalogEntry
  >
  for (const [slug, entry] of Object.entries(raw)) {
    for (const required of ['app.yaml', 'CLAUDE.md', '.claude/agents/app-editor.md']) {
      if (!existsSync(join(root, slug, required))) {
        throw new Error(`catalog.json lists "${slug}" but templates/${slug}/${required} is missing`)
      }
    }
    if (!entry.description) throw new Error(`catalog.json entry "${slug}" has no description`)
  }
  return raw
}

const STRIP = new Set(['.DS_Store', '.env', '.sovrium'])

export function buildPublishTree(
  slug: string,
  version: string,
  destDir: string,
  templatesRoot: string = TEMPLATES_ROOT
): void {
  cpSync(join(templatesRoot, slug), destDir, {
    recursive: true,
    filter: (src) => {
      const base = src.split('/').at(-1) ?? ''
      return !STRIP.has(base) && !base.startsWith('.sovrium')
    },
  })
  writeFileSync(join(destDir, '.sovrium-version'), `${version}\n`)
}

const run = (cmd: readonly string[], cwd?: string): string => {
  const proc = Bun.spawnSync([...cmd], { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (proc.exitCode !== 0) {
    throw new Error(
      `command failed (${proc.exitCode}): ${cmd.join(' ')}\n${proc.stderr.toString()}`
    )
  }
  return proc.stdout.toString().trim()
}

const tryRun = (cmd: readonly string[], cwd?: string): { ok: boolean; out: string } => {
  const proc = Bun.spawnSync([...cmd], { cwd, stdout: 'pipe', stderr: 'pipe' })
  return { ok: proc.exitCode === 0, out: proc.stdout.toString().trim() }
}

const ensureRepo = (slug: string, entry: CatalogEntry, opts: CliOptions): void => {
  const exists = tryRun(['gh', 'api', `repos/${ORG}/${repoName(slug)}`, '--jq', '.name']).ok
  if (!exists) {
    if (!opts.create) {
      throw new Error(
        `repo ${ORG}/${repoName(slug)} does not exist — re-run with --create to bootstrap it`
      )
    }
    console.log(`  creating ${ORG}/${repoName(slug)}`)
    run([
      'gh',
      'repo',
      'create',
      `${ORG}/${repoName(slug)}`,
      '--public',
      '--description',
      entry.description,
      '--homepage',
      `https://sovrium.com/apps/${slug}`,
    ])
  }
  const patched = tryRun([
    'gh',
    'api',
    '-X',
    'PATCH',
    `repos/${ORG}/${repoName(slug)}`,
    '-F',
    'is_template=true',
    '-f',
    `description=${entry.description}`,
    '-f',
    `homepage=https://sovrium.com/apps/${slug}`,
  ])
  const topicArgs = entry.topics.flatMap((t) => ['-f', `names[]=${t}`])
  const topicsSet = tryRun([
    'gh',
    'api',
    '-X',
    'PUT',
    `repos/${ORG}/${repoName(slug)}/topics`,
    ...topicArgs,
  ])
  if (!patched.ok || !topicsSet.ok) {
    console.log(
      `  ${slug}: warning — metadata reconcile skipped (token lacks Administration write?)`
    )
  }
}

const pushTree = (slug: string, treeDir: string, version: string): 'pushed' | 'unchanged' => {
  const token = process.env['GH_TOKEN'] ?? ''
  const remote = `https://x-access-token:${token}@github.com/${ORG}/${repoName(slug)}.git`
  const cloneDir = join(treeDir, '..', `${slug}-clone`)
  const cloned = tryRun(['git', 'clone', '--depth', '1', remote, cloneDir]).ok
  if (!cloned) {
    mkdirSync(cloneDir, { recursive: true })
    run(['git', 'init', '-b', 'main'], cloneDir)
    run(['git', 'remote', 'add', 'origin', remote], cloneDir)
  }
  run(['git', 'rm', '-rqf', '--ignore-unmatch', '.'], cloneDir)
  cpSync(treeDir, cloneDir, { recursive: true })
  run(['git', 'add', '-A'], cloneDir)
  const status = run(['git', 'status', '--porcelain'], cloneDir)
  if (status === '') {
    console.log(`  ${slug}: unchanged (already at ${version})`)
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
      `sovrium ${version}`,
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
  console.log(`  ${slug}: published ${version}`)
  return 'pushed'
}

const main = (): void => {
  const opts = parseCliOptions(process.argv.slice(2))
  const catalog = readCatalog()
  const slugs = Object.keys(catalog)
    .filter((slug) => opts.only === null || slug === opts.only)
    .toSorted()
  if (slugs.length === 0) throw new Error(`no templates matched --only ${opts.only}`)
  console.log(
    `Publishing ${slugs.length} template repo(s) at v${opts.version}${opts.dryRun ? ' [dry-run]' : ''}`
  )

  const workRoot = join(PROJECT_ROOT, '.template-publish')
  rmSync(workRoot, { recursive: true, force: true })
  const results: string[] = []
  const failures: string[] = []
  for (const slug of slugs) {
    try {
      const entry = catalog[slug]!
      const treeDir = join(workRoot, slug)
      buildPublishTree(slug, opts.version, treeDir)
      if (opts.dryRun) {
        const files = run(['find', '.', '-type', 'f'], treeDir).split('\n').length
        results.push(
          `  ${slug}: would publish ${files} files as ${ORG}/${repoName(slug)} @ v${opts.version}`
        )
        continue
      }
      ensureRepo(slug, entry, opts)
      results.push(`  ${slug}: ${pushTree(slug, treeDir, opts.version)}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(slug)
      results.push(`  ${slug}: FAILED — ${message.split('\n')[0]}`)
    }
  }
  rmSync(workRoot, { recursive: true, force: true })
  console.log(results.join('\n'))
  const ok = slugs.length - failures.length
  if (failures.length > 0) {
    console.error(`✗ ${ok}/${slugs.length} published; ${failures.length} FAILED: ${failures.join(', ')}`)
    process.exit(1)
  }
  console.log(`✓ template repos publish complete (${ok}/${slugs.length})`)
}

if (import.meta.main) {
  main()
}
