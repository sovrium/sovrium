/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `tauri` script of this package: the Tauri CLI, with one change to how a
 * macOS bundle carries the engine sidecar.
 *
 * ## Why the CLI is wrapped
 *
 * The app shell and the engine need different macOS entitlements. The engine is
 * a Bun-compiled executable, and JavaScriptCore is a JIT, so it needs the
 * runtime exceptions in `src-tauri/entitlements.plist`. The shell needs none of
 * them, and `src-tauri/shell.entitlements.plist` grants none.
 *
 * Tauri takes ONE entitlements file (`bundle.macOS.entitlements`) and signs
 * every executable it bundles with it, forcing a new signature on each — the
 * external binaries included. Listing the engine under `bundle.externalBin`
 * therefore replaces the signature the build workflows made with the engine's
 * file by one made with the shell's, and the engine runs with its JIT off for
 * want of `allow-jit`, about seven times slower (measured, [internal ref] A3). The only way to give the two binaries different
 * entitlements is to keep the engine out of Tauri's signing pass.
 *
 * So for a macOS `build` or `bundle`, this script appends a configuration
 * overlay that empties `externalBin` and places the staged engine at
 * `Contents/MacOS/sovrium` through `bundle.macOS.files` instead. Tauri copies a
 * file listed there without re-signing it, and the outer signature of the app
 * still seals it as nested code. The path is where the shell looks for the
 * engine (`sidecar::engine_path`, next to the shell's own executable), so
 * nothing else changes. The overlay is added at build time rather than written
 * into `tauri.conf.json` because the staged file name carries the target
 * triple, and because `tauri dev` still needs `externalBin` to copy the engine
 * next to the debug executable.
 *
 * ## The check it adds
 *
 * Since the engine's signature is now the one that ships, a signed build
 * (`APPLE_SIGNING_IDENTITY` set, `-` included) refuses to start unless the
 * staged engine carries EXACTLY `com.apple.security.cs.allow-jit`. A missing
 * key would produce an app that installs, starts, and runs everything about
 * seven times slower than it should. An extra key is refused too: the four
 * others Bun lists were dropped on 2026-10-30 ([internal ref] A3), two of them let
 * code not signed by our team into the engine's process, and a signature made
 * with an older copy of `src-tauri/entitlements.plist` would bring them back
 * without anything else noticing.
 *
 * Every other command, and every non-macOS target, reaches the Tauri CLI
 * unchanged.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const HERE = import.meta.dir
const TAURI_JS = join(HERE, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const SIDECAR_DIR = join(HERE, 'src-tauri')
const JIT_ENTITLEMENT = 'com.apple.security.cs.allow-jit'

/**
 * The one entitlement the engine is signed with ([internal ref] A3). The set is
 * asserted, not a membership: a signature with more keys than this is refused.
 */
const ENGINE_ENTITLEMENTS: readonly string[] = [JIT_ENTITLEMENT]

const fail = (message: string): never => {
  console.error(`desktop/tauri-cli.ts REFUSED: ${message}`)
  process.exit(1)
}

/** The value of `--target`/`-t`, in either the spaced or the `=` spelling. */
const targetFlag = (args: readonly string[]): string | undefined => {
  for (const [index, arg] of args.entries()) {
    if (arg === '--target' || arg === '-t') return args[index + 1]
    if (arg.startsWith('--target=')) return arg.slice('--target='.length)
  }
  return undefined
}

/** The host triple, from the toolchain that will build the shell. */
const hostTriple = (): string => {
  const probe = spawnSync('rustc', ['-vV'], { encoding: 'utf8' })
  const match = /^host:\s*(\S+)$/m.exec(probe.stdout ?? '')
  return match?.[1] ?? fail('could not read the host triple from `rustc -vV`.')
}

/**
 * The entitlement keys a signed file carries, sorted, read from the XML plist
 * codesign prints. An unsigned file, or one signed with no entitlements,
 * yields an empty list.
 */
const entitlementsOf = (path: string): readonly string[] => {
  const probe = spawnSync('codesign', ['-d', '--entitlements', '-', '--xml', path], {
    encoding: 'utf8',
  })
  if (probe.status !== 0) return []
  const keys = [...(probe.stdout ?? '').matchAll(/<key>([^<]+)<\/key>/g)].map((match) =>
    (match[1] ?? '').trim()
  )
  return [...new Set(keys)].sort()
}

/** Why `keys` is not exactly {@link ENGINE_ENTITLEMENTS}, or undefined when it is. */
const engineEntitlementProblem = (keys: readonly string[]): string | undefined => {
  const missing = ENGINE_ENTITLEMENTS.filter((key) => !keys.includes(key))
  const extra = keys.filter((key) => !ENGINE_ENTITLEMENTS.includes(key))
  if (missing.length > 0) {
    return (
      `is not signed with ${missing.join(', ')}. Without it the engine runs with its JIT ` +
      'off, about seven times slower (measured, ADR-036 A3).'
    )
  }
  if (extra.length > 0) {
    return (
      `carries entitlements the engine does not need: ${extra.join(', ')}. ` +
      `The engine is signed with ${ENGINE_ENTITLEMENTS.join(', ')} alone (ADR-036 A3); ` +
      'the others were dropped on 2026-10-30.'
    )
  }
  return undefined
}

const macOverlay = (args: readonly string[]): readonly string[] => {
  const explicit = targetFlag(args)
  if (explicit === undefined && process.platform !== 'darwin') return []
  const triple = explicit ?? hostTriple()
  if (!triple.endsWith('apple-darwin')) return []

  const staged = `sovrium-${triple}`
  const stagedPath = join(SIDECAR_DIR, staged)
  if (!existsSync(stagedPath)) {
    fail(
      `no engine staged at desktop/src-tauri/${staged}. Stage it first with ` +
        '`bun run scripts/build/stage-desktop-sidecar.ts` from the repository root.'
    )
  }

  const signing = (process.env.APPLE_SIGNING_IDENTITY ?? '') !== '' && !args.includes('--no-sign')
  const problem = signing ? engineEntitlementProblem(entitlementsOf(stagedPath)) : undefined
  if (problem !== undefined) {
    fail(
      `desktop/src-tauri/${staged} ${problem} Sign it with ` +
        'desktop/src-tauri/entitlements.plist and the hardened runtime option before ' +
        'building: Tauri no longer signs the engine, so the signature it carries is the ' +
        'one that ships.'
    )
  }

  const overlay = {
    bundle: {
      externalBin: [],
      macOS: { files: { 'MacOS/sovrium': staged } },
    },
  }
  return ['--config', JSON.stringify(overlay)]
}

const args = process.argv.slice(2)
const command = args[0]
const extra = command === 'build' || command === 'bundle' ? macOverlay(args) : []

const run = spawnSync(process.execPath, [TAURI_JS, ...args, ...extra], { stdio: 'inherit' })
process.exit(run.status ?? 1)
