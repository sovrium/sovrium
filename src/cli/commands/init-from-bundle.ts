/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium init --from-bundle <source> <dir>` — open a bundle as a new project.
 *
 * `sovrium bundle` packs a project for a host; this unpacks one for a person
 * who will edit it. `<source>` is an `https:` URL, a `file:` URL or a local
 * path. Like `--from-url` it is a FORK, not a link: fetched once, written as
 * an ordinary project, never re-fetched.
 *
 * The pipeline is [internal ref] A1's, and every step is a refusal point before
 * anything is written to `<dir>`: read the source under the 25 MiB cap and
 * recognise a bundle (`init-from-bundle-source.ts`); inflate, refuse unsafe
 * entries, check the manifest, judge the publisher, check the engine version
 * and decode the config (`init-from-bundle-open.ts`); write atomically
 * (`init-from-bundle-write.ts`).
 *
 * `--inspect` runs every check, writes NO project, keeps the downloaded archive
 * in a temporary directory of its own and prints one JSON object on stdout,
 * the only thing it prints there: the desktop shell shows it in its consent
 * dialog, then imports from that file with `--expect-sha256` pinned to what was
 * inspected, so the bytes approved are the bytes written. `--json` is accepted
 * beside it and changes nothing: `--inspect` is always JSON.
 *
 * `--with-demo-data` creates the project's admin and loads its `seed/` once
 * the project is written (`init-from-bundle-demo.ts`), refused up front when
 * the data directory already holds a database.
 */

import { mkdtemp, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { printDocument, printStderr } from '@/infrastructure/logging/cli-output'
import { validatePostureFlags } from '@/infrastructure/process/security-posture'
import { scaffoldSupportFiles } from './init'
import { demoDataRefusal, loadDemoData } from './init-from-bundle-demo'
import { openBundle, type OpenedBundle } from './init-from-bundle-open'
import { readBundleSource, refuse, type BundleSource, type Step } from './init-from-bundle-source'
import { planProjectFiles, writeBundleProject } from './init-from-bundle-write'
import { getCurrentVersion } from './update'

/** What `index.ts` hands over from the parsed command line. */
export interface InitFromBundleOptions {
  readonly source: string
  readonly targetDir: string | undefined
  readonly inspect?: boolean | undefined
  readonly expectSha256?: string | undefined
  /** `--with-demo-data`: create the admin and load `seed/` once the project is written. */
  readonly withDemoData?: boolean | undefined
  /** The scaffold flags that would decide the same project, each refused beside `--from-bundle`. */
  readonly templateName?: string | undefined
  readonly typescript?: boolean | undefined
  readonly fromUrl?: string | undefined
}

const SHA256 = /^[0-9a-f]{64}$/i

const fail = (reason: string): never => {
  printStderr(`Error: ${reason}`)
  process.exit(1)
}

/** The flag beside `--from-bundle` that would decide the same project, if any. */
const conflictingFlag = (options: InitFromBundleOptions): string | undefined => {
  if (options.fromUrl !== undefined) return '--from-url'
  if (options.templateName !== undefined) return '--template'
  return options.typescript ? '--typescript' : undefined
}

/** Refuse a target that exists and is not an empty directory, before anything is fetched. */
const targetProblem = async (targetDir: string): Promise<string | undefined> => {
  const info = await stat(targetDir).catch(() => undefined)
  if (info === undefined) return undefined
  if (!info.isDirectory()) return `${targetDir} already exists and is not a directory.`
  const held = await readdir(targetDir)
  return held.length === 0
    ? undefined
    : `${targetDir} already exists and is not empty. A bundle opens as a NEW project: pick an empty or new directory.`
}

/** Read, pin and open the source: every check of the pipeline, nothing written. */
const readAndOpen = async (
  options: InitFromBundleOptions
): Promise<Step<{ readonly source: BundleSource; readonly bundle: OpenedBundle }>> => {
  const expected = options.expectSha256
  if (expected !== undefined && !SHA256.test(expected)) {
    return refuse(
      `--expect-sha256 takes a sha256 in hex (64 characters), and "${expected}" is not one.`
    )
  }
  const source = await readBundleSource(options.source)
  if (!source.ok) return source
  const bundle = await openBundle(source.value, await getCurrentVersion())
  if (!bundle.ok) return bundle
  if (expected !== undefined && bundle.value.sha256 !== expected.toLowerCase()) {
    return refuse(
      `The archive's sha256 is ${bundle.value.sha256}, and --expect-sha256 names ${expected.toLowerCase()}. ` +
        'These are not the bytes that were approved, so nothing was written.'
    )
  }
  return { ok: true, value: { source: source.value, bundle: bundle.value } }
}

/** `--inspect`: one JSON object on stdout, the archive kept for the confirmation. */
const inspect = async (options: InitFromBundleOptions): Promise<void> => {
  const opened = await readAndOpen(options)
  if (!opened.ok) {
    process.stdout.write(`${JSON.stringify({ verdict: 'refused', reason: opened.reason })}\n`)
    process.exit(1)
  }
  const { source, bundle } = opened.value
  const file = join(await mkdtemp(join(tmpdir(), 'sovrium-bundle-')), source.fileName)
  await writeFile(file, source.bytes, { mode: 0o600 })
  const report = {
    host: source.host ?? null,
    name: bundle.manifest.app.name,
    size: source.bytes.byteLength,
    sha256: bundle.sha256,
    verdict: bundle.verdict.verdict,
    containsDemoData: bundle.containsDemoData,
    file,
  }
  process.stdout.write(`${JSON.stringify(report)}\n`)
}

/** The verdict line: a verified publisher by key, an unverified one never by the key it claimed. */
const verdictLine = (bundle: OpenedBundle): string =>
  bundle.verdict.verdict === 'verified'
    ? `Verified publisher — bundle signed with key ${bundle.verdict.keyId}`
    : 'Unverified publisher — nobody this Sovrium trusts signed this bundle. It passed every safety check; still, open it only if you know where it came from.'

/** Import the bundle into `targetDir`. */
const importInto = async (options: InitFromBundleOptions, targetDir: string): Promise<void> => {
  const occupied = await targetProblem(targetDir)
  if (occupied !== undefined) fail(occupied)
  const noDemoData = options.withDemoData ? demoDataRefusal(targetDir) : undefined
  if (noDemoData !== undefined) fail(noDemoData)
  const opened = await readAndOpen(options)
  if (!opened.ok) return fail(opened.reason)
  const { source, bundle } = opened.value
  const planned = planProjectFiles(bundle)
  if (!planned.ok) return fail(planned.reason)
  const written = await writeBundleProject({
    targetDir,
    bundle,
    files: planned.value,
    host: source.host,
    finish: (root) => scaffoldSupportFiles(root, true),
  })
  if (!written.ok) return fail(written.reason)
  printDocument([
    [{ text: verdictLine(bundle) }],
    [{ text: `Created Sovrium project ${bundle.manifest.app.name} in ${targetDir}` }],
    [{ text: `Run 'sovrium start' in ${targetDir} to see it running.` }],
  ])
  if (options.withDemoData) printDemoData(targetDir, bundle)
}

/**
 * `--with-demo-data`, once the project is on disk: the outcome lines, then the
 * admin's credentials as ONE JSON line on stdout — the only place the password
 * ever appears. A seed that failed exits 1 after them: the admin exists.
 */
const printDemoData = (targetDir: string, bundle: OpenedBundle): void => {
  const outcome = loadDemoData(targetDir, bundle.config)
  if (!outcome.ok) return fail(outcome.reason)
  printDocument(outcome.lines.map((text) => [{ text }]))
  if (outcome.credentials !== undefined) {
    process.stdout.write(`${JSON.stringify(outcome.credentials)}\n`)
  }
  if (outcome.failed) process.exit(1)
}

export const handleInitFromBundle = async (options: InitFromBundleOptions): Promise<void> => {
  const conflicting = conflictingFlag(options)
  if (conflicting !== undefined) {
    fail(`Cannot combine --from-bundle with ${conflicting}: both decide what the project is.`)
  }
  // The same refusal the server boot gives for a posture flag it cannot read.
  const postureRefusal = validatePostureFlags()
  if (postureRefusal !== undefined) fail(postureRefusal)
  if (options.inspect) return inspect(options)
  return importInto(options, resolve(options.targetDir ?? process.cwd()))
}
