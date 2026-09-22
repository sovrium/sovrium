/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Publish each `templates/<slug>/` directory to its standalone GitHub template
 * repository `github.com/sovrium/<slug>-template` — the auto-published mirrors
 * behind the website /apps gallery ("Use this template" + "Deploy on Scalingo").
 * The `-template` suffix is applied ONLY to the GitHub repo name; the local
 * `templates/<slug>` dir, the catalog key, and the `sovrium.com/apps/<slug>`
 * website route all stay on the bare slug.
 *
 * Model: MIRROR, not move. The monorepo stays the source of truth (validated
 * every commit, embedded in the binary for offline `sovrium init`); this
 * script runs from `.github/workflows/release.yml` AFTER `publish-release`,
 * so a mirror only ever reflects a *published* release whose configs CI
 * validated against that exact binary. The stamped `.sovrium-version` pins
 * the Scalingo buildpack to the same release — a mirror can never be newer
 * than the binary it deploys.
 *
 * Per slug (driven by `templates/catalog.json`):
 *   1. ensure the repo exists (creation requires --create) and reconcile
 *      metadata: is_template, description, homepage, topics (idempotent).
 *   2. build the publish tree: `templates/<slug>/.` verbatim (including the
 * template's own `CLAUDE.md` and `[internal ref]`) plus a
 *      stamped `.sovrium-version`.
 *   3. push as ONE incremental commit on main (`sovrium <version>`) + tag
 *      `v<version>` — diffable release-to-release, idempotent no-op when the
 *      tree is unchanged, never force-pushed.
 *
 * Flags: --version <x.y.z> (required) · --dry-run · --only <slug> · --create
 * Env:   GH_TOKEN (fine-grained PAT; Contents write + Metadata, plus
 *        Administration only for --create bootstrap runs)
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Cause from 'effect/Cause'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { CommandServiceLive, spawn } from '../lib/effect/command-service'
import type { CommandService } from '../lib/effect/command-service'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TEMPLATES_ROOT = join(PROJECT_ROOT, 'templates')
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
 * Local slug → standalone GitHub repo name. The `-template` suffix lives ONLY
 * here (and its callers below); the bare slug is retained for the local dir,
 * the catalog key, and the `sovrium.com/apps/<slug>` homepage.
 */
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
    // Every published mirror must carry the full Claude Code bundle. Checked
    // here rather than at copy time so an incomplete template fails the run
    // before any repo is touched.
    for (const required of ['app.yaml', 'CLAUDE.md', '.claude/agents/app-editor.md']) {
      if (!existsSync(join(root, slug, required))) {
        throw new Error(`catalog.json lists "${slug}" but templates/${slug}/${required} is missing`)
      }
    }
    if (!entry.description) throw new Error(`catalog.json entry "${slug}" has no description`)
  }
  return raw
}

/** Files never published to mirrors (runtime/dev residue). */
const STRIP = new Set(['.DS_Store', '.env', '.sovrium'])

/**
 * Build the publish tree for one slug into `destDir`: the template directory
 * verbatim, minus runtime residue, plus the release pin.
 *
 * The recursive copy carries the template's checked-in `CLAUDE.md` and
 * `[internal ref]` along with everything else — `STRIP` filters
 * on basename and never matches `.claude`, so the bundle reaches the mirror
 * without a special case.
 */
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
            message: `command timed out after ${timeoutMs}ms: ${cmd.join(' ')}`,
          })
        ),
      CommandSpawnError: (error) =>
        Effect.fail(
          new TemplatePublishError({
            message: `failed to spawn: ${cmd.join(' ')}${error.cause ? ` — ${String(error.cause)}` : ''}`,
          })
        ),
      // Unreachable under `throwOnError: false` — kept so the Effect's error
      // channel is exhaustively `TemplatePublishError`.
      CommandFailedError: (error) =>
        Effect.fail(
          new TemplatePublishError({
            message: `command failed (${error.exitCode}): ${cmd.join(' ')}\n${error.stderr}`,
          })
        ),
    }),
    Effect.flatMap((result) =>
      result.exitCode !== 0
        ? Effect.fail(
            new TemplatePublishError({
              message: `command failed (${result.exitCode}): ${cmd.join(' ')}\n${result.stderr}`,
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

  const workRoot = join(PROJECT_ROOT, '.template-publish')
  rmSync(workRoot, { recursive: true, force: true })
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
      buildPublishTree(slug, opts.version, treeDir)
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
  rmSync(workRoot, { recursive: true, force: true })
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
