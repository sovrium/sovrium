/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Remote template scaffolding for `sovrium init --template <owner>/<repo>`.
 *
 * Bare template names (`crm`, `blog`) keep resolving against the embedded
 * `TEMPLATE_MAP` — offline, deterministic, no network ever. A template ref
 * routes here only when it is remote-SHAPED: `owner/repo`, `gh:owner/repo`,
 * or a full `https://github.com/owner/repo` URL, each with an optional
 * `#ref` (branch / tag / sha). Only github.com is supported.
 *
 * The tree is fetched as a codeload tarball (no git dependency — the same
 * fetch → `Bun.Archive` extraction pattern as `update.ts`, which needs no
 * system `tar` on PATH), then copied with
 * init's additive rules: an existing file is never clobbered (`--force`
 * clobbers `app.yaml` only) and `.git/` never lands. The published
 * `sovrium/<slug>-template` mirrors ship their own `CLAUDE.md`,
 * `[internal ref]`, README, and deploy manifests, so nothing is
 * overwritten here — CLAUDE.md is generated only when the template ships none.
 *
 * There is no checksum for codeload tarballs; TLS to github.com is the
 * integrity boundary (documented trade-off, same as `gh repo clone`).
 * `SOVRIUM_TEMPLATE_HOST` overrides the origin for tests only.
 */

import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { Console, Effect } from 'effect'
import { CLAUDE_MD_BODY } from '@/cli/commands/init-scaffold-content'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { printStderr } from '@/infrastructure/logging/cli-output'

const FETCH_TIMEOUT_MS = 30_000

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/
const REF_RE = /^[\w./-]{1,200}$/

export interface RemoteTemplateRef {
  readonly owner: string
  readonly repo: string
  readonly ref: string | undefined
}

/** A ref is remote-shaped when it can't be a bare embedded-template name. */
export const isRemoteTemplateRef = (input: string): boolean =>
  input.includes('/') || input.startsWith('gh:')

const fail = (message: string): never => {
  printStderr(`Error: ${message}`)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

/** Strip the accepted locator prefixes; reject non-GitHub URLs. */
const stripLocatorPrefix = (locator: string): string => {
  if (locator.startsWith('gh:')) return locator.slice('gh:'.length)
  if (locator.startsWith('https://github.com/')) {
    return locator.slice('https://github.com/'.length)
  }
  if (locator.startsWith('https://') || locator.startsWith('http://')) {
    return fail(
      `unsupported template URL "${locator}" — only https://github.com/<owner>/<repo> is supported`
    )
  }
  return locator
}

const isValidRepo = (repo: string): boolean => REPO_RE.test(repo) && repo !== '.' && repo !== '..'

const isValidRef = (ref: string | undefined): boolean =>
  ref === undefined || (REF_RE.test(ref) && !ref.includes('..'))

/** Validate the split segments + optional ref, exiting 1 on anything hostile. */
const validateRefSegments = (
  input: string,
  segments: readonly string[],
  ref: string | undefined
): RemoteTemplateRef => {
  const [owner, repo] = segments
  if (segments.length !== 2 || !owner || !repo) {
    return fail(
      `invalid remote template "${input}" — expected <owner>/<repo>, gh:<owner>/<repo>, or https://github.com/<owner>/<repo> (with optional #ref)`
    )
  }
  if (!OWNER_RE.test(owner)) return fail(`invalid GitHub owner "${owner}" in template ref`)
  if (!isValidRepo(repo)) return fail(`invalid GitHub repository "${repo}" in template ref`)
  if (!isValidRef(ref)) return fail(`invalid git ref "${ref}" in template ref`)
  return { owner, repo, ref }
}

/**
 * Parse a remote-shaped template ref into `{ owner, repo, ref }`, exiting 1
 * with an actionable message on anything malformed (path traversal, shell
 * metacharacters, non-GitHub hosts).
 */
export const parseRemoteTemplateRef = (input: string): RemoteTemplateRef => {
  const hashIndex = input.indexOf('#')
  const locator = hashIndex === -1 ? input : input.slice(0, hashIndex)
  const ref = hashIndex === -1 ? undefined : input.slice(hashIndex + 1)
  const segments = stripLocatorPrefix(locator)
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .split('/')
  return validateRefSegments(input, segments, ref)
}

/** Tarball origin — overridable ONLY for tests (`SOVRIUM_TEMPLATE_HOST`). */
const tarballOrigin = (): string =>
  process.env['SOVRIUM_TEMPLATE_HOST'] ?? 'https://codeload.github.com'

const downloadTarball = async (refSpec: RemoteTemplateRef, tempDir: string): Promise<string> => {
  const url = `${tarballOrigin()}/${refSpec.owner}/${refSpec.repo}/tar.gz/${refSpec.ref ?? 'HEAD'}`
  const validation = validateOutboundUrl(url)
  if (!validation.ok) {
    return fail(`template URL rejected (${validation.issue.reason}): ${url}`)
  }

  const response = await withFetchTimeout(validation.url, {}, FETCH_TIMEOUT_MS).catch(
    (error: unknown) =>
      fail(
        `could not reach ${new URL(url).host} (${error instanceof Error ? error.message : String(error)}) — check your network or use a bundled template name`
      )
  )
  if (response.status === 404) {
    return fail(
      `repository or ref not found: ${refSpec.owner}/${refSpec.repo}${refSpec.ref ? `#${refSpec.ref}` : ''}`
    )
  }
  if (!response.ok) {
    return fail(`template download failed (HTTP ${response.status}) for ${url}`)
  }

  // `Bun.Archive` un-gzips and untars in-process, so scaffolding no longer needs
  // a `tar` binary on PATH, and the tarball goes straight from the response into
  // `tempDir` without landing on disk first.
  try {
    // eslint-disable-next-line functional/no-expression-statements
    await new Bun.Archive(await response.arrayBuffer()).extract(tempDir)
  } catch (error) {
    return fail(
      `failed to extract the template archive (${error instanceof Error ? error.message : String(error)}) — the download may be truncated or corrupt`
    )
  }

  const entries = await readdir(tempDir, { withFileTypes: true })
  const rootDir = entries.find((entry) => entry.isDirectory())
  if (!rootDir) return fail('template archive contained no directory')
  return join(tempDir, rootDir.name)
}

/** Recursively list files under `dir`, skipping any `.git/` tree. */
const listTreeFiles = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== '.git')
      .map((entry) =>
        entry.isDirectory()
          ? listTreeFiles(join(dir, entry.name))
          : Promise.resolve([join(dir, entry.name)] as const)
      )
  )
  return nested.flat()
}

/** Additive copy (never clobber; `--force` clobbers `app.yaml` only). */
const copyOneFile = async (
  srcPath: string,
  destPath: string,
  clobber: boolean
): Promise<boolean> => {
  if (!clobber && (await Bun.file(destPath).exists())) return false
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(dirname(destPath), { recursive: true })
  // eslint-disable-next-line functional/no-expression-statements
  await Bun.write(destPath, Bun.file(srcPath))
  return true
}

/**
 * Scaffold `targetDir` from a remote GitHub template repository. The caller
 * (`handleInitCommand`) has already ensured the target has no conflicting
 * `app.yaml` and runs the additive support-file scaffolding afterwards.
 */
export const scaffoldFromRemoteTemplate = async (
  templateRef: string,
  targetDir: string,
  forceFlag: boolean
): Promise<void> => {
  if (process.env['SOVRIUM_DISABLE_NETWORK'] === '1') {
    return fail(
      'remote templates require network access (SOVRIUM_DISABLE_NETWORK is set) — use a bundled template name instead'
    )
  }
  const refSpec = parseRemoteTemplateRef(templateRef)

  const tempDir = await mkdtemp(join(tmpdir(), 'sovrium-remote-template-'))
  try {
    const extractedRoot = await downloadTarball(refSpec, tempDir)
    const files = await listTreeFiles(extractedRoot)
    const written = await Promise.all(
      files.map((srcPath) => {
        const relPath = relative(extractedRoot, srcPath)
        const clobber = forceFlag && relPath === 'app.yaml'
        return copyOneFile(srcPath, join(targetDir, relPath), clobber)
      })
    )
    const createdCount = written.filter(Boolean).length

    const hasConfig =
      (await Bun.file(join(targetDir, 'app.yaml')).exists()) ||
      (await Bun.file(join(targetDir, 'app.ts')).exists())
    if (!hasConfig) {
      printStderr(
        `Warning: ${refSpec.owner}/${refSpec.repo} has no app.yaml or app.ts at its root — is it a Sovrium template?`
      )
    }

    // The mirrors ship a project CLAUDE.md of their own; generate one only
    // when the remote template carries none (additive, like everything else).
    if (!(await Bun.file(join(targetDir, 'CLAUDE.md')).exists())) {
      await writeFile(join(targetDir, 'CLAUDE.md'), `# ${refSpec.repo}\n\n${CLAUDE_MD_BODY}`)
    }

    Effect.runSync(
      Console.log(
        `Created ${targetDir}/ from ${refSpec.owner}/${refSpec.repo}${refSpec.ref ? `#${refSpec.ref}` : ''} (${createdCount} file${createdCount === 1 ? '' : 's'})`
      )
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
