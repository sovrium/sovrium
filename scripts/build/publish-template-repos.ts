/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Publish each `src/templates/<slug>/` directory to its standalone GitHub template
 * repository `github.com/sovrium/<slug>-template` — the auto-published mirrors
 * behind the website /apps gallery ("Use this template"). The `-template`
 * suffix is applied ONLY to the GitHub repo name; the local `src/templates/<slug>`
 * dir, the catalog key, and the `sovrium.com/apps/<slug>` website route all
 * stay on the bare slug.
 *
 * Model: MIRROR, not move. The monorepo stays the source of truth (validated
 * every commit, embedded in the binary for offline `sovrium init`); this
 * script runs from `.github/workflows/release.yml` AFTER `publish-release`,
 * so a mirror only ever reflects a *published* release whose configs CI
 * validated against that exact binary. The stamped `.sovrium-version` names
 * that release — a mirror can never be newer than the binary it was checked
 * against.
 *
 * Per slug (driven by `src/templates/catalog.json`):
 *   1. ensure the repo exists (creation requires --create) and reconcile
 *      metadata: is_template, description, homepage, topics (idempotent).
 *   2. build the publish tree: the template's config, `seed/` and `public/`,
 *      then the wrapper files rendered from its `template.yaml` by the same
 *      renderers `sovrium init` uses — `CLAUDE.md`, `.env.example`,
 *      `README.md`, the MIT `LICENSE`, and `public/README.md` for a web-facing
 *      template — then a stamped `.sovrium-version`. The manifest itself is
 *      not published, and neither is any hosting provider's deploy manifest:
 *      the README points at `sovrium deploy`. No agent file rides along: the
 *      Agent Skills are embedded in the binary and written into a project by
 *      `sovrium init` / `sovrium skills`, never checked into a template.
 *   3. push as ONE incremental commit on main (`sovrium <version>`) + tag
 *      `v<version>` — diffable release-to-release, idempotent no-op when the
 *      tree is unchanged, never force-pushed.
 *
 * Flags: --version <x.y.z> (required) · --dry-run · --only <slug> · --create
 *        · --out <dir> (build the trees there and keep them, for a diff)
 * Env:   GH_TOKEN (fine-grained PAT; Contents write + Metadata, plus
 *        Administration only for --create bootstrap runs)
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import * as Cause from 'effect/Cause'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { PUBLIC_README_BODY } from '@/cli/commands/init-scaffold-content'
import { renderTemplateClaudeMd } from '@/cli/commands/init-template-claude-md'
import { renderTemplateEnvExample } from '@/cli/commands/init-template-env'
import { collectTemplateFacts, isTemplateConfigText } from '@/cli/commands/init-template-facts'
import {
  decodeTemplateManifest,
  TEMPLATE_MANIFEST_FILE,
} from '@/cli/commands/init-template-manifest'
import { renderTemplateReadme, TEMPLATE_LICENSE_MIT } from '@/cli/commands/init-template-mirror'
import { isHeadlessEntry } from '@/cli/commands/templates-catalog'
import { templateRepositoryUrl } from '@/cli/commands/templates-render'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { CommandServiceLive, spawn } from '../lib/effect/command-service'
import { TEMPLATES_ROOT as TEMPLATES_ROOT_REL, templatesRootAbsolute } from '../lib/template-root'
import type { CommandService } from '../lib/effect/command-service'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TEMPLATES_ROOT = templatesRootAbsolute()
const ORG = 'sovrium'

/**
 * The one typed failure `run`/`ensureRepo`/`pushTree` raise on a genuine
 * command failure (as opposed to `tryRun`'s probes, which report failure as
 * DATA rather than raising — see its own comment).
 */
class TemplatePublishError extends Data.TaggedError('TemplatePublishError')<{
  readonly message: string
}> {}

/**
 * Local git plumbing — status checks, adds, commits, tags — touches only the
 * throwaway clone directory this script itself created; no network round trip.
 */
const LOCAL_OP_TIMEOUT_MS = 15_000

/**
 * Anything that leaves the machine: every `gh api`/`gh repo create` call,
 * `git clone`, `git ls-remote`, `git push`. A GitHub API round trip or a
 * small template repo's clone/push is ordinarily sub-second; sixty seconds is
 * headroom for a slow network, not a measured typical duration.
 */
const NETWORK_TIMEOUT_MS = 60_000

/**
 * Local slug → standalone GitHub repo name: the last segment of
 * `templateRepositoryUrl`, the one place the naming rule is written (and the
 * address `sovrium templates` prints). The bare slug is retained for the local
 * dir, the catalog key, and the `sovrium.com/apps/<slug>` homepage.
 */
export const repoName = (slug: string): string =>
  templateRepositoryUrl(slug).split('/').at(-1) ?? slug

interface CatalogEntry {
  readonly name: string
  readonly description: string
  readonly category: string
  readonly topics: readonly string[]
  /** A template with no web pages (an API or an MCP server): no `public/README.md`. */
  readonly headless?: boolean
}

interface CliOptions {
  readonly version: string
  readonly dryRun: boolean
  readonly only: string | null
  readonly create: boolean
  readonly out: string | null
}

export function parseCliOptions(argv: readonly string[]): CliOptions {
  const versionIdx = argv.indexOf('--version')
  const version = versionIdx >= 0 ? (argv[versionIdx + 1] ?? '') : ''
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    throw new Error(`--version is required and must be semver (got: ${JSON.stringify(version)})`)
  }
  const onlyIdx = argv.indexOf('--only')
  const outIdx = argv.indexOf('--out')
  const out = outIdx >= 0 ? (argv[outIdx + 1] ?? '') : null
  // `--out` names a directory this script empties slug by slug; a missing
  // value, or the next flag read as one, would point that at the wrong place.
  if (out !== null && (out === '' || out.startsWith('-'))) {
    throw new Error(`--out needs a directory (got: ${JSON.stringify(out)})`)
  }
  return {
    version,
    dryRun: argv.includes('--dry-run'),
    only: onlyIdx >= 0 ? (argv[onlyIdx + 1] ?? null) : null,
    create: argv.includes('--create'),
    out,
  }
}

/**
 * A catalogue key is joined onto the templates root, the work directory and
 * a GitHub repository name, so it must be a plain kebab-case slug: no
 * separator, no `..`, nothing a path or a URL would read as structure.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function readCatalog(root: string = TEMPLATES_ROOT): Readonly<Record<string, CatalogEntry>> {
  const raw = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf-8')) as Record<
    string,
    CatalogEntry
  >
  for (const [slug, entry] of Object.entries(raw)) {
    if (!SLUG.test(slug)) {
      throw new Error(`catalog.json key ${JSON.stringify(slug)} is not a kebab-case slug`)
    }
    // Every published mirror must carry a config and its manifest. Checked
    // here rather than at copy time so an incomplete template fails the run
    // before any repo is touched. The config is `app.yaml`: a template is pure
    // config data and carries no `.ts` ([internal ref] A4).
    if (!existsSync(join(root, slug, 'app.yaml'))) {
      throw new Error(
        `catalog.json lists "${slug}" but ${TEMPLATES_ROOT_REL}/${slug}/ has no app.yaml`
      )
    }
    // Every published mirror renders its wrapper files from `template.yaml`.
    if (!existsSync(join(root, slug, TEMPLATE_MANIFEST_FILE))) {
      throw new Error(
        `catalog.json lists "${slug}" but ${TEMPLATES_ROOT_REL}/${slug}/${TEMPLATE_MANIFEST_FILE} is missing`
      )
    }
    if (!entry.description) throw new Error(`catalog.json entry "${slug}" has no description`)
  }
  return raw
}

/** Files never published to mirrors (runtime/dev residue). */
const STRIP = new Set(['.DS_Store', '.env', '.sovrium'])

/**
 * Template-root files never published: the manifest the wrappers are rendered
 * from, and a hosting provider's deploy manifest an older tree may still carry.
 */
const ROOT_STRIP = new Set([TEMPLATE_MANIFEST_FILE, 'scalingo.json', '.buildpacks', 'Procfile'])

/** Every file of a directory, keyed by its path relative to `root`. */
const readTree = (root: string, dir: string = root): ReadonlyArray<readonly [string, string]> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return readTree(root, path)
    return [
      [relative(root, path), isTemplateConfigText(entry.name) ? readFileSync(path, 'utf-8') : ''],
    ]
  })

/** Write a file unless the tree already has one, creating its directory. */
const writeIfAbsent = (path: string, content: string): void => {
  if (existsSync(path)) return
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

/**
 * Render the wrapper files of one template from its `template.yaml`, the facts
 * of its config and the engine's constants. A tree with no manifest keeps the
 * files it checks in.
 */
const writeRenderedWrappers = (
  slug: string,
  sourceDir: string,
  destDir: string,
  entry: CatalogEntry | undefined
): void => {
  const manifestPath = join(sourceDir, TEMPLATE_MANIFEST_FILE)
  if (!existsSync(manifestPath)) return
  const decoded = decodeTemplateManifest(readFileSync(manifestPath, 'utf-8'))
  if (decoded._tag === 'Failure') {
    throw new Error(
      `${TEMPLATES_ROOT_REL}/${slug}/${TEMPLATE_MANIFEST_FILE}: ${decoded.failure.message}`
    )
  }
  const manifest = decoded.success
  const facts = collectTemplateFacts(slug, Object.fromEntries(readTree(sourceDir)), entry)
  writeIfAbsent(join(destDir, 'CLAUDE.md'), renderTemplateClaudeMd(manifest, facts))
  writeIfAbsent(join(destDir, '.env.example'), renderTemplateEnvExample(manifest, facts))
  writeIfAbsent(join(destDir, 'README.md'), renderTemplateReadme(manifest, facts, slug))
  writeIfAbsent(join(destDir, 'LICENSE'), TEMPLATE_LICENSE_MIT)
  // The same headless rule `init` applies when it decides on a `public/`.
  if (facts.hasPublic && (entry === undefined || !isHeadlessEntry(entry))) {
    writeIfAbsent(join(destDir, 'public', 'README.md'), PUBLIC_README_BODY)
  }
}

/**
 * Build the publish tree for one slug into `destDir`: the template directory
 * minus runtime residue, the manifest and any host deploy manifest; then the
 * wrapper files rendered from the manifest (each only where the tree has none);
 * then the release pin.
 *
 * The recursive copy carries any dot-directory (a `[internal ref]` settings folder,
 * say) along with everything else — `STRIP` filters on basename and never
 * matches a directory name it does not list, so nothing needs a special case.
 */
export function buildPublishTree(
  slug: string,
  version: string,
  destDir: string,
  templatesRoot: string = TEMPLATES_ROOT,
  entry?: CatalogEntry
): void {
  const sourceDir = join(templatesRoot, slug)
  cpSync(sourceDir, destDir, {
    recursive: true,
    filter: (src) => {
      const base = src.split('/').at(-1) ?? ''
      const atRoot = relative(sourceDir, src) === base
      return !STRIP.has(base) && !base.startsWith('.sovrium') && !(atRoot && ROOT_STRIP.has(base))
    },
  })
  writeRenderedWrappers(slug, sourceDir, destDir, entry)
  writeFileSync(join(destDir, '.sovrium-version'), `${version}\n`)
}

/**
 * The push remote carries `GH_TOKEN` in its URL; every message built from a
 * command line or its stderr goes through this before it can reach a log.
 */
const redactToken = (text: string): string => {
  const token = process.env['GH_TOKEN'] ?? ''
  return token === '' ? text : text.split(token).join('***')
}

/** Run a command, failing with the exit code and stderr when it does not succeed. */
const run = (
  cmd: readonly string[],
  timeoutMs: number,
  cwd?: string
): Effect.Effect<string, TemplatePublishError, CommandService> =>
  spawn(cmd, { cwd, timeout: timeoutMs, throwOnError: false }).pipe(
    Effect.catchTags({
      CommandTimeoutError: () =>
        Effect.fail(
          new TemplatePublishError({
            message: redactToken(`command timed out after ${timeoutMs}ms: ${cmd.join(' ')}`),
          })
        ),
      CommandSpawnError: (error) =>
        Effect.fail(
          new TemplatePublishError({
            message: redactToken(
              `failed to spawn: ${cmd.join(' ')}${error.cause ? ` — ${String(error.cause)}` : ''}`
            ),
          })
        ),
      // Unreachable under `throwOnError: false` — kept so the Effect's error
      // channel is exhaustively `TemplatePublishError`.
      CommandFailedError: (error) =>
        Effect.fail(
          new TemplatePublishError({
            message: redactToken(
              `command failed (${error.exitCode}): ${cmd.join(' ')}\n${error.stderr}`
            ),
          })
        ),
    }),
    Effect.flatMap((result) =>
      result.exitCode !== 0
        ? Effect.fail(
            new TemplatePublishError({
              message: redactToken(
                `command failed (${result.exitCode}): ${cmd.join(' ')}\n${result.stderr}`
              ),
            })
          )
        : Effect.succeed(result.stdout.trim())
    )
  )

/**
 * Probe a command's outcome as DATA, never as a failure — every caller treats
 * a non-zero exit as an expected, tolerated answer (a repo that does not
 * exist yet, a metadata PATCH a narrower token cannot make, a tag that is not
 * already pushed), so this never raises the way `run` does.
 */
const tryRun = (
  cmd: readonly string[],
  timeoutMs: number,
  cwd?: string
): Effect.Effect<{ readonly ok: boolean; readonly out: string }, never, CommandService> =>
  spawn(cmd, { cwd, timeout: timeoutMs, throwOnError: false }).pipe(
    Effect.map((result) => ({ ok: result.exitCode === 0, out: result.stdout.trim() })),
    Effect.catchTags({
      CommandTimeoutError: () => Effect.succeed({ ok: false, out: '' }),
      CommandSpawnError: () => Effect.succeed({ ok: false, out: '' }),
      // Unreachable under `throwOnError: false` — kept for the same
      // exhaustiveness reason as `run`'s.
      CommandFailedError: () => Effect.succeed({ ok: false, out: '' }),
    })
  )

/** Ensure the repo exists and its metadata matches the catalog (idempotent). */
const ensureRepo = (
  slug: string,
  entry: CatalogEntry,
  opts: CliOptions
): Effect.Effect<void, TemplatePublishError, CommandService> =>
  Effect.gen(function* () {
    const exists = (yield* tryRun(
      ['gh', 'api', `repos/${ORG}/${repoName(slug)}`, '--jq', '.name'],
      NETWORK_TIMEOUT_MS
    )).ok
    if (!exists) {
      if (!opts.create) {
        return yield* new TemplatePublishError({
          message: `repo ${ORG}/${repoName(slug)} does not exist — re-run with --create to bootstrap it`,
        })
      }
      console.log(`  creating ${ORG}/${repoName(slug)}`)
      yield* run(
        [
          'gh',
          'repo',
          'create',
          `${ORG}/${repoName(slug)}`,
          '--public',
          '--description',
          entry.description,
          '--homepage',
          `https://sovrium.com/apps/${slug}`,
        ],
        NETWORK_TIMEOUT_MS
      )
    }
    // Metadata reconcile is BEST-EFFORT: fine-grained PATs need Administration
    // write for repo PATCH/topics, and the token may be narrowed to
    // Contents-only after the bootstrap. Publishing content must never be
    // blocked by a metadata 403 — warn and continue instead.
    const patched = yield* tryRun(
      [
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
      ],
      NETWORK_TIMEOUT_MS
    )
    const topicArgs = entry.topics.flatMap((t) => ['-f', `names[]=${t}`])
    const topicsSet = yield* tryRun(
      ['gh', 'api', '-X', 'PUT', `repos/${ORG}/${repoName(slug)}/topics`, ...topicArgs],
      NETWORK_TIMEOUT_MS
    )
    if (!patched.ok || !topicsSet.ok) {
      console.log(
        `  ${slug}: warning — metadata reconcile skipped (token lacks Administration write?)`
      )
    }
  })

/** Clone main, replace the tree, commit + tag + push (no force, idempotent). */
const pushTree = (
  slug: string,
  treeDir: string,
  version: string
): Effect.Effect<'pushed' | 'unchanged', TemplatePublishError, CommandService> =>
  Effect.gen(function* () {
    const token = process.env['GH_TOKEN'] ?? ''
    const remote = `https://x-access-token:${token}@github.com/${ORG}/${repoName(slug)}.git`
    const cloneDir = join(treeDir, '..', `${slug}-clone`)
    const cloned = (yield* tryRun(
      ['git', 'clone', '--depth', '1', remote, cloneDir],
      NETWORK_TIMEOUT_MS
    )).ok
    if (!cloned) {
      // Empty repo (first publish): init a fresh clone directory instead.
      mkdirSync(cloneDir, { recursive: true })
      yield* run(['git', 'init', '-b', 'main'], LOCAL_OP_TIMEOUT_MS, cloneDir)
      yield* run(['git', 'remote', 'add', 'origin', remote], LOCAL_OP_TIMEOUT_MS, cloneDir)
    }
    yield* run(['git', 'rm', '-rqf', '--ignore-unmatch', '.'], LOCAL_OP_TIMEOUT_MS, cloneDir)
    cpSync(treeDir, cloneDir, { recursive: true })
    yield* run(['git', 'add', '-A'], LOCAL_OP_TIMEOUT_MS, cloneDir)
    const status = yield* run(['git', 'status', '--porcelain'], LOCAL_OP_TIMEOUT_MS, cloneDir)
    if (status === '') {
      console.log(`  ${slug}: unchanged (already at ${version})`)
      return 'unchanged' as const
    }
    yield* run(
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
      LOCAL_OP_TIMEOUT_MS,
      cloneDir
    )
    const tagExists = yield* tryRun(
      ['git', 'ls-remote', '--tags', 'origin', `v${version}`],
      NETWORK_TIMEOUT_MS,
      cloneDir
    )
    if (tagExists.ok && tagExists.out === '') {
      yield* run(['git', 'tag', `v${version}`], LOCAL_OP_TIMEOUT_MS, cloneDir)
      yield* run(['git', 'push', 'origin', 'main', `v${version}`], NETWORK_TIMEOUT_MS, cloneDir)
    } else {
      yield* run(['git', 'push', 'origin', 'main'], NETWORK_TIMEOUT_MS, cloneDir)
    }
    console.log(`  ${slug}: published ${version}`)
    return 'pushed' as const
  })

/**
 * Resolves to the process's exit code — 0 or 1 — rather than failing the
 * Effect, because the per-slug resilience below is data (a tally), not a
 * channel failure: one failing mirror must never abort the rest (fail-fast
 * would leave later mirrors stale and, under CI's continue-on-error, invisibly
 * green). A genuine validation error before the loop (bad `--version`, an
 * incomplete catalog entry, `--only` matching nothing) is a different kind of
 * failure and is deliberately left to escape as a defect — see the
 * entry-point guard below, which is the only place that turns either outcome
 * into a `process.exit`.
 */
const main: Effect.Effect<number, never, CommandService> = Effect.gen(function* () {
  const opts = parseCliOptions(process.argv.slice(2))
  const catalog = readCatalog()
  const slugs = Object.keys(catalog)
    .filter((slug) => opts.only === null || slug === opts.only)
    .toSorted()
  if (slugs.length === 0) throw new Error(`no templates matched --only ${opts.only}`)
  console.log(
    `Publishing ${slugs.length} template repo(s) at v${opts.version}${opts.dryRun ? ' [dry-run]' : ''}`
  )

  const workRoot = opts.out ?? join(PROJECT_ROOT, '.template-publish')
  // The default work dir is this script's own scratch and is emptied whole.
  // A `--out` directory is the caller's: only the per-slug trees this run
  // rebuilds are removed from it, never the directory itself.
  if (opts.out === null) rmSync(workRoot, { recursive: true, force: true })
  slugs.forEach((slug) => {
    rmSync(join(workRoot, slug), { recursive: true, force: true })
    rmSync(join(workRoot, `${slug}-clone`), { recursive: true, force: true })
  })
  // Resilient loop: one failing repo must NOT skip the rest (fail-fast would
  // leave later mirrors stale and — under continue-on-error — invisibly green).
  // Each slug is isolated; failures are collected and re-raised as a non-zero
  // exit AFTER every slug has been attempted, so the run turns red loudly.
  //
  // `Effect.catchCause` (not `Effect.catch`/`catchTags`) is deliberate: it is
  // the only combinator that also catches a DEFECT — a plain thrown exception
  // from `buildPublishTree`'s synchronous fs calls, say — matching the
  // original bare `try { … } catch (error) { … }`, which caught anything.
  const results: string[] = []
  const failures: string[] = []
  for (const slug of slugs) {
    const entry = catalog[slug]!
    const treeDir = join(workRoot, slug)
    const outcome = yield* Effect.gen(function* () {
      buildPublishTree(slug, opts.version, treeDir, TEMPLATES_ROOT, entry)
      if (opts.dryRun) {
        const files = (yield* run(['find', '.', '-type', 'f'], LOCAL_OP_TIMEOUT_MS, treeDir)).split(
          '\n'
        ).length
        return `  ${slug}: would publish ${files} files as ${ORG}/${repoName(slug)} @ v${opts.version}`
      }
      yield* ensureRepo(slug, entry, opts)
      const status = yield* pushTree(slug, treeDir, opts.version)
      return `  ${slug}: ${status}`
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          const squashed = Cause.squash(cause)
          const message = squashed instanceof Error ? squashed.message : String(squashed)
          failures.push(slug)
          return `  ${slug}: FAILED — ${message.split('\n')[0]}`
        })
      )
    )
    results.push(outcome)
  }
  // `--out` keeps the built trees for a diff; the default work dir is scratch.
  if (opts.out === null) rmSync(workRoot, { recursive: true, force: true })
  console.log(results.join('\n'))
  const ok = slugs.length - failures.length
  if (failures.length > 0) {
    printStderr(
      `${ok}/${slugs.length} published; ${failures.length} failed: ${failures.join(', ')}`
    )
    return 1
  }
  console.log(`✓ template repos publish complete (${ok}/${slugs.length})`)
  return 0
})

// SC4 — the only `process.exit` in the file. `main` resolving to a number is
// the ordinary "some mirrors failed" outcome; a rejection is a pre-loop
// validation defect (see `main`'s own comment) and is reported the same way
// `add-license-headers.ts` reports an unexpected failure.
if (import.meta.main) {
  const MainLayer = Layer.mergeAll(CommandServiceLive)
  Effect.runPromise(main.pipe(Effect.provide(MainLayer)))
    .then((exitCode) => process.exit(exitCode))
    .catch((error: unknown) => {
      printStderr(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
