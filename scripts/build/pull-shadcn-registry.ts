/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pull the shadcn registry snapshot ([internal ref] D1).
 *
 * The default design is not authored here: it is read from a pinned copy of
 * shadcn's registry under `[internal ref]`. This command
 * writes that copy and its `manifest.json` (the `shadcn` version, the date, and
 * for each file its source, sha256 and size). It is the `--update-manifest` of
 * `Shadcn Registry Drift`: the gate holds the bytes, this re-pulls them.
 *
 *   bun run pull:shadcn-registry             write the snapshot and manifest
 *   bun run pull:shadcn-registry --dry-run   fetch and report, write nothing
 *
 * Re-pull ONLY in the commit that bumps the `shadcn` devDependency. The
 * version comes from the installed package, and the command refuses to run when
 * it differs from the pin `package.json` declares, so a snapshot can never be
 * recorded against a version nobody installed.
 *
 * The pull never DROPS a row. Every row the current manifest holds must name a
 * file `ITEMS` knows, or the pull refuses before fetching anything: a file
 * pinned by hand (Typeset was) would otherwise vanish from the snapshot on the
 * next re-pull, with nothing failing. And a row whose bytes did not move keeps
 * its recorded `source` when that source extends the URL it was fetched from,
 * so provenance written beside a URL (an upstream commit, say) survives a
 * re-pull that changed nothing.
 *
 * WHERE EACH FILE COMES FROM decides whether a re-pull is reproducible, so every
 * item names its source kind:
 *
 *   tag      shadcn-ui/ui at the release tag `shadcn@<pin>`. Reproducible: the
 *            pin alone determines the bytes.
 *   commit   shadcn-ui/ui at a fixed commit (Typeset, which follows no release
 *            tag). Reproducible.
 *   package  the installed `shadcn` package. Reproducible through the pin.
 *   live     `ui.shadcn.com/r/...`, which serves the registry's CURRENT content.
 *            NOT reproducible: a re-pull at an unchanged pin can return
 *            different bytes, and the gate then reports a hash change rather than
 *            accepting it.
 *
 * Why anything is still `live`: base-nova and new-york-v4 are BUILD OUTPUTS of
 * the site. `apps/v4/.gitignore` ignores `public/r/styles/*` except `default/`,
 * `new-york/` and `index.json`, so those files exist at no tag and no commit.
 * Only the site serves them.
 *
 * `--dry-run` also prints a FRESHNESS report: for each file it compares the
 * bytes the site serves today against the manifest, and lists what moved
 * upstream since the pin. It only reports. It never fails and never writes.
 */

import { createHash } from 'node:crypto'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { printJournalError } from '@/infrastructure/logging/cli-output'
import { FileSystemService, FileSystemServiceLive } from '../lib/effect/file-system-service'
import {
  LoggerService,
  LoggerServicePretty,
  defaultLoggerConfig,
} from '../lib/effect/logger-service'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

/** Where the snapshot lives, relative to the repository root. */
export const SHADCN_REGISTRY_DIR = 'scripts/baselines/shadcn-registry'

const REGISTRY = 'https://ui.shadcn.com/r'

/** shadcn-ui/ui's raw files, addressed by a git ref (a tag or a commit). */
const UPSTREAM_RAW = 'https://raw.githubusercontent.com/shadcn-ui/ui'

/** The registry's committed output inside the upstream repository. */
const UPSTREAM_REGISTRY_PATH = 'apps/v4/public/r'

/**
 * Typeset, shadcn/ui's prose stylesheet. It is no registry item, ships in no
 * package and follows no release tag, so it is pinned to the upstream commit it
 * was taken from. A refresh moves this commit, in its own change.
 */
const TYPESET_COMMIT = '4233ed1caded8c38f4bc14b14afe1f93ebcaf966'

/** The installed stylesheet `shadcn/tailwind.css` resolves to. */
const TAILWIND_CSS_PACKAGE_PATH = 'node_modules/shadcn/dist/tailwind.css'

/**
 * One snapshot file and where it comes from (see the header for the four
 * kinds). `liveUrl` is what the site serves today, the comparison point of the
 * freshness report; a `live` item's `url` is that already.
 */
export type Item =
  | { readonly file: string; readonly kind: 'live'; readonly url: string }
  | {
      readonly file: string
      readonly kind: 'tag'
      readonly repoPath: string
      readonly liveUrl: string
    }
  | {
      readonly file: string
      readonly kind: 'commit'
      readonly commit: string
      readonly repoPath: string
      readonly liveUrl: string
    }
  | { readonly file: string; readonly kind: 'package'; readonly packagePath: string }

/**
 * Every file the snapshot holds.
 *
 * The two gallery indexes are kept WHOLE rather than filtered to the blocks the
 * galleries read (`chart-*` in new-york-v4, `calendar-NN` in new-york): a
 * filtered file is a derivation, and its sha256 could no longer be checked
 * against the bytes the source serves.
 */
export const ITEMS: readonly Item[] = [
  { file: 'index.json', kind: 'live', url: `${REGISTRY}/styles/base-nova/index.json` },
  {
    file: 'colors/neutral.json',
    kind: 'tag',
    repoPath: `${UPSTREAM_REGISTRY_PATH}/colors/neutral.json`,
    liveUrl: `${REGISTRY}/colors/neutral.json`,
  },
  { file: 'font-geist.json', kind: 'live', url: `${REGISTRY}/styles/base-nova/font-geist.json` },
  { file: 'registry.json', kind: 'live', url: `${REGISTRY}/styles/base-nova/registry.json` },
  { file: 'tailwind.css', kind: 'package', packagePath: TAILWIND_CSS_PACKAGE_PATH },
  {
    file: 'new-york-v4/registry.json',
    kind: 'live',
    url: `${REGISTRY}/styles/new-york-v4/registry.json`,
  },
  {
    file: 'new-york/registry.json',
    kind: 'tag',
    repoPath: `${UPSTREAM_REGISTRY_PATH}/styles/new-york/registry.json`,
    liveUrl: `${REGISTRY}/styles/new-york/registry.json`,
  },
  {
    file: 'typeset.css',
    kind: 'commit',
    commit: TYPESET_COMMIT,
    repoPath: 'apps/v4/app/(app)/(typeset)/typeset.css',
    liveUrl: 'https://ui.shadcn.com/typeset.css',
  },
]

/** The release tag shadcn-ui/ui cuts for a CLI version (`shadcn@4.21.5`). */
export const releaseTag = (version: string): string => `shadcn@${version}`

/** The URL a fetched item is pulled from, at the pinned version. */
export const pinnedUrl = (
  item: Exclude<Item, { readonly kind: 'package' }>,
  version: string
): string => {
  switch (item.kind) {
    case 'live':
      return item.url
    case 'tag':
      return `${UPSTREAM_RAW}/${releaseTag(version)}/${item.repoPath}`
    case 'commit':
      return `${UPSTREAM_RAW}/${item.commit}/${item.repoPath}`
  }
}

/** What the site serves for an item today, or `undefined` for the package file. */
export const liveUrlOf = (item: Item): string | undefined => {
  switch (item.kind) {
    case 'live':
      return item.url
    case 'tag':
    case 'commit':
      return item.liveUrl
    case 'package':
      return undefined
  }
}

/** One line of the freshness report. */
export interface FreshnessRow {
  readonly file: string
  readonly status: 'current' | 'moved' | 'unpinned' | 'unreachable' | 'not-served'
}

/**
 * Compare what upstream serves today against the pinned manifest. `observed`
 * holds a sha256 per file, `null` when the fetch failed and `undefined` when
 * the file has no live source (the package stylesheet). Report-only by design:
 * the caller prints it and exits 0, whatever it says.
 */
export interface Observation {
  readonly file: string
  readonly sha256: string | null | undefined
}

export const freshnessReport = (
  manifest: Manifest | undefined,
  observed: readonly Observation[]
): readonly FreshnessRow[] => {
  const pinned = new Map((manifest?.files ?? []).map((row) => [row.file, row.sha256]))
  return observed.map(({ file, sha256: seen }): FreshnessRow => {
    if (seen === undefined) return { file, status: 'not-served' }
    if (seen === null) return { file, status: 'unreachable' }
    const recorded = pinned.get(file)
    if (recorded === undefined) return { file, status: 'unpinned' }
    return { file, status: recorded === seen ? 'current' : 'moved' }
  })
}

/** A fetch that does not answer inside this is a failure, never a hang. */
const FETCH_TIMEOUT_MS = 30_000

export interface ManifestFile {
  readonly file: string
  readonly source: string
  readonly sha256: string
  readonly bytes: number
}

export interface Manifest {
  readonly shadcn: string
  readonly pulledOn: string
  readonly files: readonly ManifestFile[]
}

class PullError extends Error {
  readonly _tag = 'PullError'
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

/**
 * The rows of the current manifest that name no file in `items`, in manifest
 * order. A non-empty answer means the pull would DROP them, so it refuses.
 */
export const unlistedRows = (
  previous: Manifest | undefined,
  items: readonly { readonly file: string }[] = ITEMS
): readonly string[] => {
  const known = new Set(items.map((item) => item.file))
  return (previous?.files ?? []).map((row) => row.file).filter((file) => !known.has(file))
}

/**
 * The manifest for a pull. A row keeps its previously recorded `source` only
 * when its bytes are unchanged AND that source starts with the one just
 * fetched from — an annotation beside the same URL, never a different origin.
 */
export const buildManifest = (input: {
  readonly version: string
  readonly pulledOn: string
  readonly pulled: readonly {
    readonly file: string
    readonly source: string
    readonly text: string
  }[]
  readonly previous?: Manifest
}): Manifest => {
  const before = new Map((input.previous?.files ?? []).map((row) => [row.file, row]))
  return {
    shadcn: input.version,
    pulledOn: input.pulledOn,
    files: input.pulled.map(({ file, source, text }) => {
      const digest = sha256(text)
      const prior = before.get(file)
      const kept =
        prior !== undefined && prior.sha256 === digest && prior.source.startsWith(source)
          ? prior.source
          : source
      return { file, source: kept, sha256: digest, bytes: Buffer.byteLength(text, 'utf8') }
    }),
  }
}

/** The manifest on disk, or `undefined` before the first pull. */
const readPreviousManifest = (fs: FileSystemService, path: string) =>
  Effect.gen(function* () {
    if (!(yield* fs.exists(path))) return undefined
    return JSON.parse(yield* fs.readFile(path)) as Manifest
  })

/** The installed `shadcn` version, refused unless it equals the declared pin. */
const resolveVersion = (fs: FileSystemService) =>
  Effect.gen(function* () {
    const declared = JSON.parse(yield* fs.readFile(join(PROJECT_ROOT, 'package.json'))) as {
      readonly devDependencies?: Readonly<Record<string, string>>
    }
    const installed = JSON.parse(
      yield* fs.readFile(join(PROJECT_ROOT, 'node_modules/shadcn/package.json'))
    ) as { readonly version: string }
    const pin = declared.devDependencies?.['shadcn']
    if (pin !== installed.version) {
      return yield* Effect.fail(
        new PullError(
          `package.json pins shadcn ${pin ?? '(absent)'} but ${installed.version} is installed. ` +
            'Run `bun install` (or pin the version exactly) before pulling.'
        )
      )
    }
    return installed.version
  })

const fetchText = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`${url} answered ${response.status}`)
      return response.text()
    },
    catch: (cause) =>
      new PullError(`could not fetch ${url}: ${cause instanceof Error ? cause.message : cause}`),
  })

const FRESHNESS_LABEL: Readonly<Record<FreshnessRow['status'], string>> = {
  current: 'unchanged upstream',
  moved: 'MOVED upstream since the pin',
  unpinned: 'served upstream, not in manifest.json',
  unreachable: 'could not be fetched; freshness unknown',
  'not-served': 'package file, follows the pin',
}

/**
 * The `--dry-run` freshness report: what the site serves today against the
 * manifest. A failed fetch is a line in the report, never a failure of the run.
 */
const reportFreshness = (manifest: Manifest | undefined) =>
  Effect.gen(function* () {
    const log = yield* LoggerService
    const observed = yield* Effect.forEach(
      ITEMS,
      (item): Effect.Effect<Observation> => {
        const url = liveUrlOf(item)
        if (url === undefined) return Effect.succeed({ file: item.file, sha256: undefined })
        return fetchText(url).pipe(
          Effect.map((text): string | null => sha256(text)),
          // Report-only: an unreachable site becomes an `unreachable` row.
          Effect.tapCause((cause) => log.warn(`freshness: ${url} not fetched (${String(cause)})`)),
          Effect.orElseSucceed((): string | null => null),
          Effect.map((digest) => ({ file: item.file, sha256: digest }))
        )
      },
      { concurrency: 4 }
    )
    const rows = freshnessReport(manifest, observed)
    yield* log.info('freshness (report-only): upstream today vs manifest.json')
    for (const { file, status } of rows) {
      yield* log.info(`  ${file}  ${FRESHNESS_LABEL[status]}`)
    }
    const moved = rows.filter((row) => row.status === 'moved').length
    yield* log.info(
      moved === 0
        ? 'freshness: nothing moved upstream since the pin'
        : `freshness: ${moved} file(s) moved upstream; they land only with a shadcn version bump`
    )
  })

const program = (dryRun: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const log = yield* LoggerService
    yield* log.opening('Pulling the shadcn registry snapshot')

    const version = yield* resolveVersion(fs)
    const dir = join(PROJECT_ROOT, SHADCN_REGISTRY_DIR)
    const previous = yield* readPreviousManifest(fs, join(dir, 'manifest.json'))
    const unlisted = unlistedRows(previous)
    if (unlisted.length > 0) {
      return yield* Effect.fail(
        new PullError(
          `manifest.json pins ${unlisted.join(', ')}, which this script does not pull, so a ` +
            're-pull would drop it. Add it to ITEMS in scripts/build/pull-shadcn-registry.ts.'
        )
      )
    }
    const pulled = yield* Effect.forEach(
      ITEMS,
      (item) =>
        Effect.gen(function* () {
          if (item.kind === 'package') {
            const text = yield* fs.readFile(join(PROJECT_ROOT, item.packagePath))
            return { file: item.file, source: `shadcn@${version} ${item.packagePath}`, text }
          }
          const source = pinnedUrl(item, version)
          return { file: item.file, source, text: yield* fetchText(source) }
        }),
      { concurrency: 4 }
    )

    const manifest = buildManifest({
      version,
      pulledOn: new Date().toISOString().slice(0, 10),
      pulled,
      previous,
    })

    for (const { file, sha256: digest, bytes } of manifest.files) {
      yield* log.info(`${file}  ${bytes} B  sha256 ${digest.slice(0, 16)}…`)
    }
    if (dryRun) {
      yield* reportFreshness(previous)
      yield* log.success(
        `dry run: shadcn ${version}, ${pulled.length} file(s) fetched, none written`
      )
      return
    }

    yield* Effect.forEach(pulled, ({ file, text }) => fs.writeFile(join(dir, file), text), {
      discard: true,
    })
    yield* fs.writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, undefined, 2)}\n`)
    yield* log.success(
      `snapshot written at shadcn ${version}: ${pulled.length} file(s) + manifest.json in ${SHADCN_REGISTRY_DIR}/`
    )
  })

if (import.meta.main) {
  const MainLayer = Layer.mergeAll(
    FileSystemServiceLive,
    LoggerServicePretty({ ...defaultLoggerConfig, tag: 'shadcn-registry' })
  )
  Effect.runPromise(program(Bun.argv.includes('--dry-run')).pipe(Effect.provide(MainLayer)))
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      printJournalError(
        'shadcn-registry',
        `The snapshot was not pulled (files are written only after every fetch succeeds; check git status under ${SHADCN_REGISTRY_DIR}/ if a write failed).\n${
          error instanceof Error ? error.message : String(error)
        }`
      )
      process.exit(1)
    })
}
