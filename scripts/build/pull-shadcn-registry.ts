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
 * One limit, stated plainly: `ui.shadcn.com/r/...` serves the registry's
 * CURRENT content, not content addressed by CLI version. The `shadcn` pin names
 * the snapshot; the sha256s are what actually freeze it. A re-pull at an
 * unchanged pin can therefore return different bytes, and the gate then reports
 * a hash change rather than accepting it.
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

/** The installed stylesheet `shadcn/tailwind.css` resolves to. */
const TAILWIND_CSS_PACKAGE_PATH = 'node_modules/shadcn/dist/tailwind.css'

/**
 * Every file the snapshot holds. `url` items are fetched; the stylesheet is
 * copied from the installed package, which is what `@import "shadcn/tailwind.css"`
 * resolves to at the pinned version.
 *
 * The two gallery indexes are kept WHOLE rather than filtered to the blocks the
 * galleries read (`chart-*` in new-york-v4, `calendar-NN` in new-york): a
 * filtered file is a derivation, and its sha256 could no longer be checked
 * against the bytes the URL serves.
 */
const ITEMS: readonly (
  | { readonly file: string; readonly url: string }
  | { readonly file: string; readonly packagePath: string }
)[] = [
  { file: 'index.json', url: `${REGISTRY}/styles/base-nova/index.json` },
  { file: 'colors/neutral.json', url: `${REGISTRY}/colors/neutral.json` },
  { file: 'font-geist.json', url: `${REGISTRY}/styles/base-nova/font-geist.json` },
  { file: 'registry.json', url: `${REGISTRY}/styles/base-nova/registry.json` },
  { file: 'tailwind.css', packagePath: TAILWIND_CSS_PACKAGE_PATH },
  { file: 'new-york-v4/registry.json', url: `${REGISTRY}/styles/new-york-v4/registry.json` },
  { file: 'new-york/registry.json', url: `${REGISTRY}/styles/new-york/registry.json` },
]

/** A fetch that does not answer inside this is a failure, never a hang. */
const FETCH_TIMEOUT_MS = 30_000

interface ManifestFile {
  readonly file: string
  readonly source: string
  readonly sha256: string
  readonly bytes: number
}

interface Manifest {
  readonly shadcn: string
  readonly pulledOn: string
  readonly files: readonly ManifestFile[]
}

class PullError extends Error {
  readonly _tag = 'PullError'
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

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

const program = (dryRun: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const log = yield* LoggerService
    yield* log.opening('Pulling the shadcn registry snapshot')

    const version = yield* resolveVersion(fs)
    const pulled = yield* Effect.forEach(
      ITEMS,
      (item) =>
        Effect.gen(function* () {
          const text =
            'url' in item
              ? yield* fetchText(item.url)
              : yield* fs.readFile(join(PROJECT_ROOT, item.packagePath))
          const source = 'url' in item ? item.url : `shadcn@${version} ${item.packagePath}`
          return { file: item.file, source, text }
        }),
      { concurrency: 4 }
    )

    const manifest: Manifest = {
      shadcn: version,
      pulledOn: new Date().toISOString().slice(0, 10),
      files: pulled.map(({ file, source, text }) => ({
        file,
        source,
        sha256: sha256(text),
        bytes: Buffer.byteLength(text, 'utf8'),
      })),
    }

    for (const { file, sha256: digest, bytes } of manifest.files) {
      yield* log.info(`${file}  ${bytes} B  sha256 ${digest.slice(0, 16)}…`)
    }
    if (dryRun) {
      yield* log.success(
        `dry run: shadcn ${version}, ${pulled.length} file(s) fetched, none written`
      )
      return
    }

    const dir = join(PROJECT_ROOT, SHADCN_REGISTRY_DIR)
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
