/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: ship the public release notes inside the compiled binary.
 *
 * Reads `CHANGELOG.public.md`, parses it with the one grammar
 * (`src/domain/kernel/markdown/release-notes.ts`), and writes
 * `src/infrastructure/assets/embedded-changelog.generated.json`, which
 * `src/infrastructure/assets/embedded-changelog.ts` loads for `sovrium changelog`.
 *
 * ## The source is the PUBLIC changelog, and only ever that
 *
 * `CHANGELOG.md` at the repository root is the INTERNAL record — it names
 * decision records, internal apps and work that never shipped to users, and it
 * never leaves [internal ref]. A binary is published irrevocably, so this generator
 * refuses to read it by path, whatever it is asked. The one twist: on the public
 * mirror the public file is published UNDER the name `CHANGELOG.md` and
 * `CHANGELOG.public.md` does not exist — which is why the payload is COMMITTED
 * rather than regenerated from a root file at GitHub build time, and why
 * `--source` exists only for `--check` (the mirror's equality assertion hands
 * it the mirrored copy, which lives in the mirror directory, never at the root).
 *
 * ## Fails closed
 *
 * Any line the grammar does not recognise refuses the whole payload, with every
 * refusal listed by line number (see the parser for why nothing is skipped).
 * So does a changelog with fewer than {@link CHANGELOG_MIN_RELEASES} releases:
 * a truncated source would otherwise produce a small, valid, wrong payload.
 *
 * ## Why JSON, and why embedded as a file
 *
 * `scripts/build/generate-css-assets.ts` harvests Tailwind candidates out of
 * every `src/**` `.ts` file, string literals included, so release-note prose
 * emitted as a `.ts` literal would flood the CSS corpus. A `.json` file is
 * outside that scan, and the accessor embeds it with `with { type: 'file' }`.
 * The output is deterministic — no timestamp, 2-space indent, one trailing
 * newline — so `--check` is a byte comparison and a release diff is readable.
 *
 * Regenerate after `CHANGELOG.public.md` changes (the release job does this
 * between "Update CHANGELOG" and "Commit release"):
 *   bun run build:changelog            (writes the payload)
 *   bun run build:changelog --check    (exit 1 when the committed payload is stale)
 *   bun run build:changelog --check --source <md> --payload <json>
 *                                      (compare any pair — the mirror's assertion)
 * (`build:binary` runs `--check` where `CHANGELOG.public.md` exists, and
 * verifies the committed payload where it does not.)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  isEmbeddedChangelogPayload,
  parseReleaseNotes,
  toEmbeddedChangelogPayload,
  type ReleaseNotes,
} from '@/domain/kernel/markdown/release-notes'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { REPO_ROOT } from '../lib/drift/walk'

/** The source and the payload, root-parameterized for tests and the build. */
export const changelogPayloadPaths = (
  root: string
): { readonly source: string; readonly payload: string; readonly internal: string } => ({
  source: join(root, 'CHANGELOG.public.md'),
  payload: join(root, 'src', 'infrastructure', 'assets', 'embedded-changelog.generated.json'),
  internal: join(root, 'CHANGELOG.md'),
})

/**
 * The fewest releases a real payload holds. The public changelog only grows —
 * 66 releases at 0.28.0 — so a count under this is a truncated source or a
 * stub, never a legitimate state. Deliberately a floor rather than the exact
 * count, so it is not a second number to bump at every release.
 */
export const CHANGELOG_MIN_RELEASES = 60

/** Thrown for a source or payload the binary must not be built from. */
export class ChangelogPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChangelogPayloadError'
  }
}

/** The payload for one changelog text, as the exact bytes to commit. */
export const renderChangelogPayload = (
  markdown: string,
  minReleases: number = CHANGELOG_MIN_RELEASES
): string => {
  const result = parseReleaseNotes(markdown)
  if (result._tag === 'Unparseable') {
    const listed = result.errors
      .slice(0, 20)
      .map((error) => `  line ${error.line}: ${error.reason}\n    ${error.text}`)
      .join('\n')
    const more = result.errors.length > 20 ? `\n  … and ${result.errors.length - 20} more` : ''
    throw new ChangelogPayloadError(
      `The public changelog does not parse — ${result.errors.length} refusal(s):\n${listed}${more}\n` +
        'Every line must be a release heading, a `###` heading, a `- ` bullet or the ' +
        'no-changes note. Fix the changelog; the payload is never built around a line it cannot read.'
    )
  }
  if (result.releases.length < minReleases) {
    throw new ChangelogPayloadError(
      `The public changelog holds ${result.releases.length} release(s), under the floor of ` +
        `${minReleases}. It only ever grows, so this is a truncated source, not a changelog.`
    )
  }
  return `${JSON.stringify(toEmbeddedChangelogPayload(result.releases), null, 2)}\n`
}

/**
 * Read and check a COMMITTED payload without its source — the public mirror's
 * build, where `CHANGELOG.public.md` does not exist.
 *
 * Three checks: it decodes as a payload this code can read, it clears the
 * release floor, and it carries an entry for `version` — the binary being built
 * must be able to print its own notes. Returns the releases for the build log.
 */
export const verifyCommittedChangelogPayload = (
  payloadText: string,
  version: string,
  minReleases: number = CHANGELOG_MIN_RELEASES
): readonly ReleaseNotes[] => {
  const decoded: unknown = (() => {
    try {
      return JSON.parse(payloadText)
    } catch (error) {
      throw new ChangelogPayloadError(`The changelog payload is not JSON: ${String(error)}`)
    }
  })()
  if (!isEmbeddedChangelogPayload(decoded)) {
    throw new ChangelogPayloadError(
      'The changelog payload does not have the embedded-changelog shape (format, ' +
        'schemaVersion 1, releases). Regenerate it with `bun run build:changelog`.'
    )
  }
  if (decoded.releases.length < minReleases) {
    throw new ChangelogPayloadError(
      `The changelog payload holds ${decoded.releases.length} release(s), under the floor of ${minReleases}.`
    )
  }
  if (!decoded.releases.some((release) => release.version === version)) {
    throw new ChangelogPayloadError(
      `The changelog payload has no entry for ${version}, the version being built, so ` +
        '`sovrium changelog` would not know its own release. The release job regenerates the ' +
        'payload after updating the changelog; a tag without it was cut by a path that skipped that step.'
    )
  }
  return decoded.releases
}

/** `--flag value`, or undefined. */
const flagValue = (argv: readonly string[], flag: string): string | undefined => {
  const at = argv.indexOf(flag)
  return at === -1 ? undefined : argv[at + 1]
}

/**
 * Resolve what to read and write for one invocation, refusing the two unsafe
 * shapes: a `--source` outside `--check` (a write must come from the one
 * canonical source), and ANY source that is the internal `CHANGELOG.md`.
 */
export const resolveInvocation = (
  argv: readonly string[],
  root: string
): { readonly check: boolean; readonly source: string; readonly payload: string } => {
  const check = argv.includes('--check')
  const defaults = changelogPayloadPaths(root)
  const sourceFlag = flagValue(argv, '--source')
  const payloadFlag = flagValue(argv, '--payload')
  if (!check && (sourceFlag !== undefined || payloadFlag !== undefined)) {
    throw new ChangelogPayloadError(
      '--source/--payload are for `--check` only: the committed payload is only ever written ' +
        'from CHANGELOG.public.md.'
    )
  }
  const source = sourceFlag === undefined ? defaults.source : resolve(sourceFlag)
  if (source === resolve(defaults.internal)) {
    throw new ChangelogPayloadError(
      `Refusing to read ${defaults.internal}: it is the INTERNAL changelog and must never reach a ` +
        'binary. The source is CHANGELOG.public.md.'
    )
  }
  return {
    check,
    source,
    payload: payloadFlag === undefined ? defaults.payload : resolve(payloadFlag),
  }
}

const main = (argv: readonly string[]): number => {
  const { check, source, payload } = resolveInvocation(argv, REPO_ROOT)
  if (!existsSync(source)) {
    throw new ChangelogPayloadError(`No changelog at ${source}.`)
  }
  const rendered = renderChangelogPayload(readFileSync(source, 'utf8'))
  const count = (JSON.parse(rendered) as { readonly releases: readonly unknown[] }).releases.length
  const name = 'embedded-changelog.generated.json'
  if (check) {
    const committed = existsSync(payload) ? readFileSync(payload, 'utf8') : ''
    if (committed !== rendered) {
      console.log(
        `${name} does not match ${source} — run \`bun run build:changelog\` and commit the result.`
      )
      return 1
    }
    console.log(`${name} is current — ${count} release(s)`)
    return 0
  }
  writeFileSync(payload, rendered)
  console.log(`${name} — ${count} release(s), ${Buffer.byteLength(rendered)} bytes`)
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
