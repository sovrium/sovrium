#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Stage the Sovrium engine binary where the Tauri bundler expects a sidecar.
 *
 * `bundle.externalBin: ["sovrium"]` in `desktop/src-tauri/tauri.conf.json` means
 * Tauri looks for `desktop/src-tauri/sovrium-<target-triple>` — `sovrium-aarch64-apple-darwin`,
 * `sovrium-x86_64-pc-windows-msvc.exe`, and so on. The suffix is not decoration:
 * it is how one source tree bundles a different binary per platform.
 *
 * ## Why this is a script rather than a `cp` in the workflow
 *
 * The triple is not knowable from a shell without asking the toolchain, and the
 * three places that need it — a developer running `desktop:check`, the unsigned
 * PR build, and the signed release job — would each derive it slightly
 * differently. Deriving it once, from `rustc -vV`'s own `host:` line, is the
 * only spelling that cannot disagree with the compiler that will read the file.
 *
 * ## The placeholder, and why it is loud
 *
 * `tauri-build` resolves `externalBin` during `build.rs`, so a missing sidecar
 * fails `cargo check` — not `tauri build`, `cargo check`. That makes the whole
 * Rust side unverifiable on a machine that has not built the engine, which is
 * every fresh clone and every CI job that only wants to know whether the shell
 * COMPILES.
 *
 * `--placeholder` writes a stub so that question can be answered. Three things
 * keep the stub from ever being mistaken for a release artifact: its first
 * bytes are a refusal message rather than a Mach-O/PE header, so executing it
 * does nothing but print why; it is written only when no real binary is already
 * staged; and the script says on stderr, every time, that what it staged cannot
 * run. A silent placeholder is how an installer ships around an empty box.
 *
 * ## Who stages the real one
 *
 * The desktop release job. It fetches the per-platform binary produced by the
 * binary jobs and runs this script with `--from`, before `tauri build`. On
 * macOS the sidecar must additionally be signed with
 * `desktop/src-tauri/entitlements.plist` BEFORE the bundle is signed — a
 * `--deep` signature does not apply entitlements to a nested Mach-O, and
 * JavaScriptCore is a JIT, so an unsigned sidecar is killed by the kernel on
 * launch rather than failing with a message.
 *
 * Usage:
 *   bun run scripts/build/stage-desktop-sidecar.ts --from ./sovrium-darwin-arm64
 *   bun run scripts/build/stage-desktop-sidecar.ts --placeholder
 *   bun run scripts/build/stage-desktop-sidecar.ts --from ./sovrium.exe --triple x86_64-pc-windows-msvc
 *
 * Exit codes: 0 staged (or already present), 1 refused.
 */

import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  openSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { printStderr } from '@/infrastructure/logging/cli-output'

const ROOT = resolve(import.meta.dir, '..', '..')

/** Where `externalBin: ["sovrium"]` makes Tauri look. */
export const SIDECAR_DIR = 'desktop/src-tauri'

/** The base name, without the triple suffix Tauri appends. */
export const SIDECAR_BASE = 'sovrium'

/**
 * What a placeholder's first line says.
 *
 * Exported so the staging check can recognise its own stub and refuse to treat
 * it as a real binary — which is what stops a `--placeholder` run on a CI
 * machine from silently satisfying a later job that needed the real thing.
 */
export const PLACEHOLDER_BANNER =
  '#!/bin/sh\n# SOVRIUM DESKTOP SIDECAR PLACEHOLDER — NOT A BINARY\n'

const PLACEHOLDER_BODY = `${PLACEHOLDER_BANNER}#
# This file exists so that \`cargo check\` and an unsigned local \`tauri build\`
# can resolve \`bundle.externalBin\`. It is NOT the Sovrium engine and cannot
# run one. The release job replaces it with the real per-platform binary via
#   bun run scripts/build/stage-desktop-sidecar.ts --from <binary>
echo "This is a placeholder, not the Sovrium engine. See scripts/build/stage-desktop-sidecar.ts." >&2
exit 1
`

/** The host triple, read from the toolchain that will consume the file. */
export const hostTriple = (): string => {
  const probe = spawnSync('rustc', ['-vV'], { encoding: 'utf8' })
  if (probe.status !== 0 || typeof probe.stdout !== 'string') {
    throw new Error(
      'could not run `rustc -vV` to determine the host target triple. Install the Rust ' +
        'toolchain, or pass --triple explicitly.'
    )
  }
  const match = /^host:\s*(\S+)$/m.exec(probe.stdout)
  if (match?.[1] === undefined) {
    throw new Error('`rustc -vV` printed no `host:` line — cannot determine the target triple.')
  }
  return match[1]
}

/** The staged file name for a triple. Windows keeps the `.exe` Tauri expects. */
export const sidecarName = (triple: string): string =>
  triple.includes('windows') ? `${SIDECAR_BASE}-${triple}.exe` : `${SIDECAR_BASE}-${triple}`

/**
 * True when `path` holds the stub this script writes, rather than a real binary.
 *
 * Reads only the banner's worth of bytes: a real sidecar is ~100 MB, and there
 * is no reason to pull it into memory to answer a question about its first two
 * lines.
 */
export const isPlaceholder = (path: string): boolean => {
  if (!existsSync(path)) return false
  // BYTE length, not string length. The banner carries an em-dash, which is one
  // UTF-16 code unit and three UTF-8 bytes — so `Buffer.alloc(banner.length)`
  // reads two bytes short, the comparison never matches, and every placeholder
  // is mistaken for a real binary. Measured here before it was written down.
  const size = Buffer.byteLength(PLACEHOLDER_BANNER, 'utf8')
  const head = Buffer.alloc(size)
  const handle = openSync(path, 'r')
  try {
    const read = readSync(handle, head, 0, size, 0)
    return read === size && head.toString('utf8') === PLACEHOLDER_BANNER
  } finally {
    closeSync(handle)
  }
}

const flag = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

const main = (args: readonly string[]): number => {
  let triple: string
  try {
    triple = flag(args, '--triple') ?? hostTriple()
  } catch (error) {
    printStderr(`stage-desktop-sidecar REFUSED: ${error instanceof Error ? error.message : error}`)
    return 1
  }

  const target = join(ROOT, SIDECAR_DIR, sidecarName(triple))
  const from = flag(args, '--from')

  if (from !== undefined) {
    const source = resolve(from)
    if (!existsSync(source)) {
      printStderr(`stage-desktop-sidecar REFUSED: no file at ${source}`)
      return 1
    }
    copyFileSync(source, target)
    chmodSync(target, 0o755)
    console.log(
      `stage-desktop-sidecar: staged ${source} as ${sidecarName(triple)} ` +
        `(${statSync(target).size} bytes)`
    )
    return 0
  }

  if (!args.includes('--placeholder')) {
    printStderr(
      'stage-desktop-sidecar REFUSED: pass --from <binary> to stage the real engine, or\n' +
        '  --placeholder to write a non-functional stub so `cargo check` can resolve\n' +
        '  `externalBin`. Neither is the default, because guessing which one was meant is\n' +
        '  the difference between a working installer and an empty box.'
    )
    return 1
  }

  // Never overwrite a real binary with a stub. A CI job that staged the engine
  // and then ran a check step would otherwise undo its own work.
  if (existsSync(target) && !isPlaceholder(target)) {
    console.log(
      `stage-desktop-sidecar: ${sidecarName(triple)} is already staged and is not a ` +
        'placeholder — left untouched.'
    )
    return 0
  }

  writeFileSync(target, PLACEHOLDER_BODY)
  chmodSync(target, 0o755)
  printStderr(
    `stage-desktop-sidecar: wrote a PLACEHOLDER at ${SIDECAR_DIR}/${sidecarName(triple)}.\n` +
      '  It is not the Sovrium engine and cannot run one. A bundle built on top of it\n' +
      '  will install and then do nothing. Stage the real binary with --from before\n' +
      '  producing anything a user could download.'
  )
  return 0
}

if (import.meta.main) {
  process.exit(main(Bun.argv.slice(2)))
}
