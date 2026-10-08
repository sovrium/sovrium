/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The desktop shell's version declarations, read and written in ONE place.
 *
 * The desktop app is two programs and four manifests. `desktop/package.json`
 * feeds the frontend build, `desktop/src-tauri/Cargo.toml` names the Rust crate,
 * `desktop/src-tauri/Cargo.lock` pins that crate for `--locked` builds, and
 * `desktop/src-tauri/tauri.conf.json` decides what version the INSTALLER, the
 * Windows file properties, the macOS `CFBundleShortVersionString` and the
 * updater manifest all report. A release that bumps the root `package.json` and
 * leaves any of them behind ships an installer whose version disagrees with the
 * binary it supervises — and the shell checks that parity at launch
 * ([internal ref] D8, "Two runtimes to keep in step"), so the disagreement is not
 * cosmetic: it is a startup warning on every user's machine.
 *
 * ## The indirection, and why `tauri.conf.json` is checked but never written
 *
 * Tauri 2's `version` field accepts either a semver literal **or a path to a
 * `package.json`**, relative to the config file. `desktop/src-tauri/tauri.conf.json`
 * therefore declares `"version": "../package.json"` and has no number of its own
 * to sync — one fewer declaration that can rot.
 *
 * That makes the field itself the thing worth gating. A well-meaning edit
 * replacing the path with a literal `"0.25.0"` type-checks, builds, and then
 * silently stops tracking the release forever. So {@link readDesktopVersions}
 * asserts the field is EXACTLY {@link TAURI_VERSION_INDIRECTION} and reports a
 * literal as a failure naming what was found.
 *
 * ## Why text rewriting rather than a TOML library
 *
 * `Cargo.toml` and `Cargo.lock` are edited as text with anchored, single-match
 * patterns. A TOML round-trip would reformat the whole file — `Cargo.lock` in
 * particular is cargo's own output and must stay byte-shaped the way cargo
 * writes it, or the next `cargo check --locked` rewrites it back and the release
 * commit carries a spurious diff. Every reader below therefore demands EXACTLY
 * one match: zero means the anchor moved and the writer would silently do
 * nothing, more than one means the file declares the version twice and this
 * module cannot say which is authoritative. Both are failures.
 *
 * Consumed by:
 * - `[internal ref]` (the gate)
 * - `[internal ref]` (the writer, run by both
 *     release paths)
 *   - `scripts/build/generate-desktop-notices.ts`, which rewrites the version to a
 *     placeholder before hashing its inputs, so a release bump does not stale the
 *     desktop notices — the same anchors, so the writer and the hash cannot disagree
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The Rust crate the desktop shell builds, as named in `Cargo.toml`. */
export const DESKTOP_CRATE = 'sovrium-desktop'

/**
 * What `tauri.conf.json`'s `version` field must literally hold.
 *
 * Relative to `desktop/src-tauri/`, so it resolves to `desktop/package.json`.
 */
export const TAURI_VERSION_INDIRECTION = '../package.json'

export const ROOT_PACKAGE_JSON = 'package.json'
export const DESKTOP_PACKAGE_JSON = 'desktop/package.json'
export const DESKTOP_CARGO_TOML = 'desktop/src-tauri/Cargo.toml'
export const DESKTOP_CARGO_LOCK = 'desktop/src-tauri/Cargo.lock'
export const DESKTOP_TAURI_CONF = 'desktop/src-tauri/tauri.conf.json'

/**
 * Every path this module reads, including the ones it does not write.
 *
 * Used by the gate to decide whether the scaffold is ABSENT (none of them
 * exists) or PRESENT (all of them must). A tree with some but not all is a
 * half-landed scaffold and is a hard failure — that middle state is precisely
 * where a gate would otherwise go quiet.
 */
export const DESKTOP_VERSION_FILES: readonly string[] = [
  DESKTOP_PACKAGE_JSON,
  DESKTOP_CARGO_TOML,
  DESKTOP_CARGO_LOCK,
  DESKTOP_TAURI_CONF,
]

/** A semver triple, anchored — no ranges, no pre-release, no two-part versions. */
const SEMVER = /^\d+\.\d+\.\d+$/

/** Outcome of pulling a version (or a pinned literal) out of one file's text. */
export type Extraction =
  { readonly ok: true; readonly version: string } | { readonly ok: false; readonly reason: string }

/** One declaration's name plus what reading it produced. */
export interface Reading {
  readonly source: string
  readonly extraction: Extraction
}

const fail = (reason: string): Extraction => ({ ok: false, reason })

const asSemver = (raw: string, where: string): Extraction =>
  SEMVER.test(raw)
    ? { ok: true, version: raw }
    : fail(`${where} is not an exact X.Y.Z version: "${raw}"`)

/**
 * Require EXACTLY one match, and return its first capture.
 *
 * Zero matches means the anchor moved and both the gate and the writer have
 * gone blind; more than one means the file states the version twice. A writer
 * built on a loose match is the more dangerous half: it would rewrite the wrong
 * occurrence and leave the real one stale.
 */
export const soleMatch = (content: string, pattern: RegExp, where: string): Extraction => {
  const matches = [...content.matchAll(pattern)]
  if (matches.length === 0) {
    return fail(`no ${where} found — the anchor this check keys on has moved or been removed`)
  }
  if (matches.length > 1) {
    return fail(`${matches.length} ${where} entries found — expected exactly 1`)
  }
  const captured = matches[0]?.[1]
  if (captured === undefined) return fail(`${where} matched but captured no version`)
  return asSemver(captured, where)
}

/** `package.json` (root or desktop) -> its `version` field. */
export const extractPackageJsonVersion = (content: string, where: string): Extraction => {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    return fail(`${where} is not valid JSON: ${error instanceof Error ? error.message : error}`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return fail(`${where} did not parse to an object`)
  }
  const value = (parsed as Record<string, unknown>)['version']
  if (typeof value !== 'string') return fail(`${where} has no string \`version\` field`)
  return asSemver(value, `${where} \`version\``)
}

/**
 * The `[package]` table of a `Cargo.toml`, as text.
 *
 * Scoped deliberately: `version = "…"` appears under every `[dependencies.*]`
 * entry too, and a whole-file match would read a dependency pin as the crate's
 * own version. Returns `undefined` when there is no `[package]` table at all.
 */
export const packageTableOf = (content: string): string | undefined => {
  const start = /^\[package\]\s*$/m.exec(content)
  if (start === null) return undefined
  const rest = content.slice(start.index + start[0].length)
  const end = /^\s*\[/m.exec(rest)
  return end === null ? rest : rest.slice(0, end.index)
}

/** `desktop/src-tauri/Cargo.toml` -> `[package] version = "X.Y.Z"`. */
export const extractCargoTomlVersion = (content: string): Extraction => {
  const table = packageTableOf(content)
  if (table === undefined) {
    return fail(`${DESKTOP_CARGO_TOML} has no \`[package]\` table`)
  }
  return soleMatch(
    table,
    /^\s*version\s*=\s*"([^"]*)"/gm,
    `${DESKTOP_CARGO_TOML} \`[package] version\``
  )
}

/**
 * The `[[package]]` block of `Cargo.lock` naming {@link DESKTOP_CRATE}.
 *
 * `Cargo.lock` holds one such block per crate in the graph — several hundred
 * for a Tauri app — so the block is located by its `name` line first and the
 * version read only from inside it.
 */
export const desktopLockBlock = (content: string): string | undefined => {
  const blocks = content.split(/^\[\[package\]\]\s*$/m).slice(1)
  const matching = blocks.filter((block) =>
    new RegExp(`^\\s*name\\s*=\\s*"${DESKTOP_CRATE}"\\s*$`, 'm').test(block)
  )
  return matching.length === 1 ? matching[0] : undefined
}

/** `desktop/src-tauri/Cargo.lock` -> the `sovrium-desktop` entry's version. */
export const extractCargoLockVersion = (content: string): Extraction => {
  const block = desktopLockBlock(content)
  if (block === undefined) {
    return fail(
      `${DESKTOP_CARGO_LOCK} does not hold exactly one \`[[package]]\` block named "${DESKTOP_CRATE}"`
    )
  }
  return soleMatch(
    block,
    /^\s*version\s*=\s*"([^"]*)"/gm,
    `${DESKTOP_CARGO_LOCK} \`${DESKTOP_CRATE}\` version`
  )
}

/**
 * `desktop/src-tauri/tauri.conf.json` -> the indirection pin.
 *
 * Returns the ROOT version's stand-in only in the sense that it must resolve
 * through `desktop/package.json`; there is no number here to compare. A literal
 * version is the failure, because it is the shape that silently stops tracking.
 */
export const extractTauriVersionIndirection = (content: string): Extraction => {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    return fail(
      `${DESKTOP_TAURI_CONF} is not valid JSON: ${error instanceof Error ? error.message : error}`
    )
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return fail(`${DESKTOP_TAURI_CONF} did not parse to an object`)
  }
  const value = (parsed as Record<string, unknown>)['version']
  if (typeof value !== 'string') {
    return fail(
      `${DESKTOP_TAURI_CONF} has no string \`version\` field — it must be ` +
        `"${TAURI_VERSION_INDIRECTION}" so the installer version follows desktop/package.json`
    )
  }
  if (value !== TAURI_VERSION_INDIRECTION) {
    return fail(
      `${DESKTOP_TAURI_CONF} \`version\` is "${value}", not the required indirection ` +
        `"${TAURI_VERSION_INDIRECTION}". A literal here stops tracking the release the moment ` +
        'it is written, and nothing else would notice.'
    )
  }
  return { ok: true, version: TAURI_VERSION_INDIRECTION }
}

/** Is a desktop scaffold present in `root`? True when ANY of its manifests exists. */
export const desktopScaffoldPresence = (
  root: string
): { readonly present: readonly string[]; readonly missing: readonly string[] } => {
  const present: string[] = []
  const missing: string[] = []
  for (const relative of DESKTOP_VERSION_FILES) {
    ;(existsSync(join(root, relative)) ? present : missing).push(relative)
  }
  return { present, missing }
}

/** Read every declaration from a real tree. The root version comes first. */
export const readDesktopVersions = (root: string): readonly Reading[] => {
  const read = (relative: string, extract: (content: string) => Extraction): Reading => {
    const full = join(root, relative)
    if (!existsSync(full)) {
      return { source: relative, extraction: fail(`file not found at ${relative}`) }
    }
    return { source: relative, extraction: extract(readFileSync(full, 'utf8')) }
  }
  return [
    read(ROOT_PACKAGE_JSON, (c) => extractPackageJsonVersion(c, ROOT_PACKAGE_JSON)),
    read(DESKTOP_PACKAGE_JSON, (c) => extractPackageJsonVersion(c, DESKTOP_PACKAGE_JSON)),
    read(DESKTOP_CARGO_TOML, extractCargoTomlVersion),
    read(DESKTOP_CARGO_LOCK, extractCargoLockVersion),
    read(DESKTOP_TAURI_CONF, extractTauriVersionIndirection),
  ]
}

/**
 * The declarations that carry a NUMBER — i.e. everything but the tauri.conf
 * indirection, which is compared against a literal instead.
 */
export const isNumericDeclaration = (source: string): boolean => source !== DESKTOP_TAURI_CONF

// ---------------------------------------------------------------------------
// Writers — text rewrites, each asserting it changed exactly what it meant to
// ---------------------------------------------------------------------------

/** A rewrite that refused, naming the file and why. */
export class DesktopVersionWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesktopVersionWriteError'
  }
}

/**
 * Rewrite a JSON manifest's `version` field, preserving the rest byte for byte.
 *
 * Deliberately NOT a `JSON.parse` -> `JSON.stringify` round-trip: that reflows
 * the whole file and would fight whatever formatter owns it. The pattern is
 * anchored on a top-level two-space-indented `"version":`, which is the shape
 * both `package.json` files carry.
 */
export const rewriteJsonVersion = (content: string, version: string, where: string): string => {
  const pattern = /^(\s*"version"\s*:\s*")([^"]*)(")/m
  const matches = content.match(new RegExp(pattern.source, 'gm')) ?? []
  if (matches.length !== 1) {
    throw new DesktopVersionWriteError(
      `${where}: expected exactly 1 \`"version"\` line to rewrite, found ${matches.length}`
    )
  }
  return content.replace(pattern, `$1${version}$3`)
}

/** Rewrite `[package] version` in a `Cargo.toml`, leaving dependency pins alone. */
export const rewriteCargoTomlVersion = (content: string, version: string): string => {
  const table = packageTableOf(content)
  if (table === undefined) {
    throw new DesktopVersionWriteError(`${DESKTOP_CARGO_TOML}: no \`[package]\` table`)
  }
  const pattern = /^(\s*version\s*=\s*")([^"]*)(")/m
  const matches = table.match(new RegExp(pattern.source, 'gm')) ?? []
  if (matches.length !== 1) {
    throw new DesktopVersionWriteError(
      `${DESKTOP_CARGO_TOML}: expected exactly 1 \`version =\` line in \`[package]\`, found ${matches.length}`
    )
  }
  const rewritten = table.replace(pattern, `$1${version}$3`)
  return content.replace(table, rewritten)
}

/** Rewrite the `sovrium-desktop` entry in a `Cargo.lock`, leaving every other crate alone. */
export const rewriteCargoLockVersion = (content: string, version: string): string => {
  const block = desktopLockBlock(content)
  if (block === undefined) {
    throw new DesktopVersionWriteError(
      `${DESKTOP_CARGO_LOCK}: no single \`[[package]]\` block named "${DESKTOP_CRATE}"`
    )
  }
  const pattern = /^(\s*version\s*=\s*")([^"]*)(")/m
  const matches = block.match(new RegExp(pattern.source, 'gm')) ?? []
  if (matches.length !== 1) {
    throw new DesktopVersionWriteError(
      `${DESKTOP_CARGO_LOCK}: expected exactly 1 \`version =\` line in the "${DESKTOP_CRATE}" ` +
        `block, found ${matches.length}`
    )
  }
  return content.replace(block, block.replace(pattern, `$1${version}$3`))
}
