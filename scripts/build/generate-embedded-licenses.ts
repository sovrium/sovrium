/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: ship the third-party license texts inside the compiled binary.
 *
 * Reads every file under `licenses/`, pairs it with its row in
 * {@link THIRD_PARTY_NOTICES}, resolves each npm package's INSTALLED version,
 * and writes `src/infrastructure/assets/embedded-licenses.generated.json`,
 * which `src/infrastructure/assets/embedded-licenses.ts` loads for
 * `sovrium licenses`.
 *
 * ## Why this exists
 *
 * MPL-2.0 (§3.2), OFL-1.1 (condition 2) and PSF-2.0 (§2) each require the
 * license text to accompany the distributed code. The standalone binary is the
 * primary distribution and has no directory beside it, so the texts ride inside
 * it. The same `licenses/` directory is copied verbatim into the public mirror
 *.
 *
 * ## The table is the contract, and the gate holds it
 *
 * {@link THIRD_PARTY_NOTICES} names which component each file covers. The
 * generator refuses a file without a row and a row without a file, so the two
 * cannot drift apart here. `Third-Party License Drift`
 * holds the other direction:
 * every production dependency whose license requires attribution must be
 * covered by a row.
 *
 * ## Deterministic
 *
 * No timestamp, sorted by name, 2-space JSON, one trailing newline — so
 * `--check` is a byte comparison. A dependency bump that moves a covered
 * package's version makes the payload stale, which is the point: the binary
 * must name the version it actually carries.
 *
 *   bun run build:licenses             (writes the payload)
 *   bun run build:licenses --check     (exit 1 when the committed payload is stale)
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EMBEDDED_LICENSES_FORMAT,
  type EmbeddedLicenseNotice,
  type EmbeddedLicensesPayload,
} from '@/infrastructure/assets/embedded-licenses-payload'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { REPO_ROOT } from '../lib/drift/walk'
import {
  groupNotices,
  resolveNotice,
  walkProductionClosure,
  type AttributedComponent,
  type ClosurePackage,
} from '../lib/third-party-licenses'

/** An npm package in the production dependency closure. */
export interface PackageNotice {
  readonly kind: 'package'
  /** The file under `licenses/`. */
  readonly file: string
  /** The npm package whose version is resolved from `node_modules/`. */
  readonly package: string
  readonly license: string
  /** One line for the payload's `source` field. */
  readonly source: string
  /**
   * Further package names this row covers — the per-platform native packages
   * of one project, which differ by the machine that installed the tree.
   */
  readonly covers?: RegExp
}

/** An asset copied into `src/` (a font), with no npm package of its own. */
export interface AssetNotice {
  readonly kind: 'asset'
  readonly file: string
  /** Human name, printed in place of a package name. */
  readonly name: string
  readonly license: string
  readonly source: string
  /** The `src/` module that embeds the asset; it must name `licenses/<file>`. */
  readonly embeddedIn: string
}

/** The runtime the binary is compiled with, versioned by `packageManager`. */
export interface RuntimeNotice {
  readonly kind: 'runtime'
  readonly file: string
  readonly name: string
  readonly license: string
  readonly source: string
}

export type ThirdPartyNotice = PackageNotice | AssetNotice | RuntimeNotice

/**
 * Every third-party license text Sovrium redistributes. One row per file in
 * `licenses/`. Adding a dependency whose license requires attribution means
 * adding its text to `licenses/` AND a row here, then `bun run build:licenses`.
 */
export const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[] = [
  {
    kind: 'package',
    file: 'MPL-2.0-resvg-wasm.txt',
    package: '@resvg/resvg-wasm',
    license: 'MPL-2.0',
    source: 'npm @resvg/resvg-wasm — https://github.com/yisibl/resvg-js',
  },
  {
    kind: 'package',
    file: 'MPL-2.0-lightningcss.txt',
    package: 'lightningcss',
    license: 'MPL-2.0',
    source: 'npm lightningcss — https://github.com/parcel-bundler/lightningcss',
    covers: /^lightningcss-[a-z0-9-]+$/,
  },
  {
    kind: 'package',
    file: 'PSF-2.0-argparse.txt',
    package: 'argparse',
    license: 'PSF-2.0',
    source: 'npm argparse — https://github.com/nodeca/argparse',
  },
  {
    kind: 'runtime',
    file: 'MIT-bun-runtime.txt',
    name: 'bun',
    license: 'MIT',
    source: 'the Bun runtime the binary is compiled with — https://github.com/oven-sh/bun',
  },
  {
    kind: 'asset',
    file: 'OFL-1.1-ibm-plex.txt',
    name: 'IBM Plex Sans (font)',
    license: 'OFL-1.1',
    source: '@fontsource-variable/ibm-plex-sans, latin subset, inlined as woff2',
    embeddedIn: 'src/infrastructure/css/theme/fonts/plex-sans.ts',
  },
  {
    kind: 'asset',
    file: 'OFL-1.1-jetbrains-mono.txt',
    name: 'JetBrains Mono (font)',
    license: 'OFL-1.1',
    source: '@fontsource-variable/jetbrains-mono, latin subset, inlined as woff2',
    embeddedIn: 'src/infrastructure/css/theme/fonts/jetbrains-mono.ts',
  },
]

/** Directory, payload and node_modules, root-parameterized for tests. */
export const licensesPaths = (
  root: string
): {
  readonly dir: string
  readonly supplements: string
  readonly payload: string
  readonly nodeModules: string
} => ({
  dir: join(root, 'licenses'),
  supplements: join(root, 'licenses', 'supplements'),
  payload: join(root, 'src', 'infrastructure', 'assets', 'embedded-licenses.generated.json'),
  nodeModules: join(root, 'node_modules'),
})

/** Thrown for a `licenses/` tree the binary must not be built from. */
export class LicensesPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LicensesPayloadError'
  }
}

/** The `.txt` files under `licenses/`, sorted. */
export const listLicenseFiles = (dir: string): readonly string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.txt'))
        .sort()
    : []

/**
 * The files without a row and the rows without a file. Both must be empty;
 * the generator and the gate share this so they cannot disagree.
 */
export const reconcileNoticeFiles = (
  files: readonly string[],
  notices: readonly ThirdPartyNotice[] = THIRD_PARTY_NOTICES
): { readonly orphanFiles: readonly string[]; readonly missingFiles: readonly string[] } => {
  const declared = new Set(notices.map((notice) => notice.file))
  const present = new Set(files)
  return {
    orphanFiles: files.filter((file) => !declared.has(file)),
    missingFiles: [...declared].filter((file) => !present.has(file)).sort(),
  }
}

const installedVersion = (nodeModules: string, name: string): string => {
  const manifest = join(nodeModules, name, 'package.json')
  if (!existsSync(manifest)) {
    throw new LicensesPayloadError(
      `${name} is not installed under ${nodeModules}, so its version cannot be named. ` +
        'Run `bun install`, or remove its row from THIRD_PARTY_NOTICES if it left the tree.'
    )
  }
  const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { readonly version?: unknown }
  if (typeof version !== 'string' || version.length === 0) {
    throw new LicensesPayloadError(`${manifest} carries no version.`)
  }
  return version
}

/** Whether a hand-written row covers this package (it then needs no extracted notice). */
export const coveredByRow = (
  name: string,
  notices: readonly ThirdPartyNotice[] = THIRD_PARTY_NOTICES
): boolean =>
  notices.some(
    (notice) =>
      notice.kind === 'package' && (notice.package === name || (notice.covers?.test(name) ?? false))
  )

/**
 * Every production package that is attributed from its own license file:
 * the closure minus per-platform native packages (their family package
 * carries the notice, and which ones are installed depends on the machine)
 * and minus the packages a hand-written row covers. `missing` lists the ones
 * with no extractable notice and no supplement — never an empty notice.
 */
export const attributedComponents = (
  root: string,
  notices: readonly ThirdPartyNotice[] = THIRD_PARTY_NOTICES,
  closure: readonly ClosurePackage[] = walkProductionClosure(root)
): {
  readonly components: readonly AttributedComponent[]
  readonly missing: readonly ClosurePackage[]
} => {
  const { supplements } = licensesPaths(root)
  const candidates = closure.filter(
    (pkg) => !pkg.platformSpecific && !coveredByRow(pkg.name, notices)
  )
  const resolved = candidates.map((pkg) => ({
    pkg,
    found: resolveNotice('npm', pkg.name, pkg.dir, supplements),
  }))
  return {
    components: resolved.flatMap(({ pkg, found }) =>
      found === undefined
        ? []
        : [
            {
              name: pkg.name,
              version: pkg.version,
              declared: pkg.license ?? 'UNKNOWN',
              notice: found.notice,
            },
          ]
    ),
    missing: resolved.filter(({ found }) => found === undefined).map(({ pkg }) => pkg),
  }
}

const runtimeVersion = (root: string): string => {
  const { packageManager } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    readonly packageManager?: unknown
  }
  const match = typeof packageManager === 'string' ? /^bun@(.+)$/.exec(packageManager) : null
  if (match?.[1] === undefined) {
    throw new LicensesPayloadError(
      'package.json has no `packageManager: "bun@<version>"` to name the runtime.'
    )
  }
  return match[1]
}

/** The payload for one tree, as the exact bytes to commit. */
export const renderLicensesPayload = (
  root: string,
  notices: readonly ThirdPartyNotice[] = THIRD_PARTY_NOTICES
): string => {
  const { dir, nodeModules } = licensesPaths(root)
  const files = listLicenseFiles(dir)
  const { orphanFiles, missingFiles } = reconcileNoticeFiles(files, notices)
  if (files.length === 0 || orphanFiles.length > 0 || missingFiles.length > 0) {
    throw new LicensesPayloadError(
      [
        `licenses/ and THIRD_PARTY_NOTICES disagree (${files.length} file(s) under ${dir}).`,
        ...orphanFiles.map((file) => `  [no row]  licenses/${file}`),
        ...missingFiles.map((file) => `  [no file] licenses/${file}`),
        'Every license text needs exactly one row in scripts/build/generate-embedded-licenses.ts.',
      ].join('\n')
    )
  }
  const entries: readonly EmbeddedLicenseNotice[] = notices
    .map((notice) => ({
      name: notice.kind === 'package' ? notice.package : notice.name,
      version:
        notice.kind === 'package'
          ? installedVersion(nodeModules, notice.package)
          : notice.kind === 'runtime'
            ? runtimeVersion(root)
            : null,
      license: notice.license,
      source: notice.source,
      file: `licenses/${notice.file}`,
      text: readFileSync(join(dir, notice.file), 'utf8'),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name, 'en'))
  const { components, missing } = attributedComponents(root, notices)
  if (missing.length > 0) {
    throw new LicensesPayloadError(
      [
        `${missing.length} production package(s) ship no license file and have no supplement:`,
        ...missing.map(
          (pkg) => `  ${pkg.name}@${pkg.version} (${pkg.license ?? 'no license field'})`
        ),
        'Add the upstream text under licenses/supplements/ and its row to',
        'scripts/lib/third-party-license-supplements.ts.',
      ].join('\n')
    )
  }
  const grouped = groupNotices(components)
  const payload: EmbeddedLicensesPayload = {
    format: EMBEDDED_LICENSES_FORMAT,
    schemaVersion: 2,
    notices: entries,
    texts: grouped.texts,
    components: grouped.components,
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

const main = (argv: readonly string[]): number => {
  const check = argv.includes('--check')
  const { payload } = licensesPaths(REPO_ROOT)
  const rendered = renderLicensesPayload(REPO_ROOT)
  const decoded = JSON.parse(rendered) as EmbeddedLicensesPayload
  const count = `${decoded.notices.length} notice(s), ${decoded.components.length} component(s), ${decoded.texts.length} distinct text(s)`
  const name = 'embedded-licenses.generated.json'
  if (check) {
    const committed = existsSync(payload) ? readFileSync(payload, 'utf8') : ''
    if (committed !== rendered) {
      console.log(
        `${name} does not match licenses/ and the installed versions — run \`bun run build:licenses\` and commit the result.`
      )
      return 1
    }
    console.log(`${name} is current — ${count}`)
    return 0
  }
  writeFileSync(payload, rendered)
  console.log(`${name} — ${count}, ${Buffer.byteLength(rendered)} bytes`)
  return 0
}

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (error) {
    printStderr(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
