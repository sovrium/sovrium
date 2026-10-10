/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether this machine has a browser of its own, and how to open a page in it.
 *
 * `sovrium login` signs in with one click when the browser that opens the
 * approval page runs on this machine — it returns to a listener on
 * `127.0.0.1`, which only this machine can reach. Where the person's browser is
 * elsewhere, the command uses a code instead. Not having a terminal does not
 * change that: a GUI that runs the CLI has a browser.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

/** The environment variables this module reads. */
type Env = Readonly<Record<string, string | undefined>>

/** An empty value counts as unset, as shells and CI runners clear variables that way. */
const isSet = (env: Env, name: string): boolean => (env[name] ?? '') !== ''

/** A `BROWSER` that names a command to run, rather than `none` or nothing. */
const namesBrowserCommand = (env: Env): boolean =>
  isSet(env, 'BROWSER') && env['BROWSER']?.trim() !== 'none'

/** The markers a container runtime leaves at the filesystem root. */
const CONTAINER_MARKERS = ['/.dockerenv', '/run/.containerenv'] as const

/**
 * Whether no browser on this machine can be expected to open a page:
 *
 * - over SSH (`SSH_CONNECTION`, `SSH_CLIENT`, `SSH_TTY`), always — the person's
 *   browser is on the other end, even when `BROWSER` names a command here;
 * - with `BROWSER=none`;
 * - when `BROWSER` is unset: on Linux without `DISPLAY` or `WAYLAND_DISPLAY`,
 *   in a container (`/.dockerenv`, `/run/.containerenv`, Kubernetes), or in CI.
 *   A `BROWSER` naming a command overrides these three.
 *
 * @param fileExists injected for tests; the real filesystem by default
 */
export const isHeadless = (
  env: Env = process.env,
  platform: string = process.platform,
  fileExists: (path: string) => boolean = existsSync
): boolean => {
  if (isRemoteSession(env) || env['BROWSER']?.trim() === 'none') return true
  if (namesBrowserCommand(env)) return false
  return lacksDisplay(env, platform) || isContainerOrCi(env, fileExists)
}

/** A shell reached over SSH. */
const isRemoteSession = (env: Env): boolean =>
  ['SSH_CONNECTION', 'SSH_CLIENT', 'SSH_TTY'].some((name) => isSet(env, name))

/** Linux with neither an X11 nor a Wayland display. */
const lacksDisplay = (env: Env, platform: string): boolean =>
  platform === 'linux' && !isSet(env, 'DISPLAY') && !isSet(env, 'WAYLAND_DISPLAY')

/** A container (Docker, Podman, Kubernetes) or a CI runner. */
const isContainerOrCi = (env: Env, fileExists: (path: string) => boolean): boolean =>
  CONTAINER_MARKERS.some((marker) => fileExists(marker)) ||
  isSet(env, 'KUBERNETES_SERVICE_HOST') ||
  isSet(env, 'CI')

/**
 * The command line `BROWSER` names for `url`, or `undefined` when it names
 * none. The first entry of a `:`-separated list is used (not on Windows, where
 * `:` belongs to a drive letter); `%s` stands for the page, else the page is
 * the last argument. Words are split on whitespace — no shell runs.
 */
export const browserCommandFor = (
  url: string,
  env: Env = process.env,
  platform: string = process.platform
): readonly string[] | undefined => {
  if (!namesBrowserCommand(env)) return undefined
  const raw = env['BROWSER'] ?? ''
  const [first = ''] = platform === 'win32' ? [raw] : raw.split(':')
  const words = first
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '')
  if (words.length === 0) return undefined
  // A function replacer: a page is inserted as it is, never read for `$&`-style patterns.
  return words.some((word) => word.includes('%s'))
    ? words.map((word) => word.replaceAll('%s', () => url))
    : [...words, url]
}

/**
 * The platform's own opener for `url`. On Windows it is the URL protocol
 * handler, run directly: `cmd /c start` would hand the page to a shell, where
 * an `&` or a `|` in the address the cloud named is a command separator.
 */
export const platformOpenerFor = (url: string, platform: string): readonly string[] =>
  platform === 'darwin'
    ? ['open', url]
    : platform === 'win32'
      ? ['rundll32', 'url.dll,FileProtocolHandler', url]
      : ['xdg-open', url]

/**
 * Best effort: open `url` in the browser `BROWSER` names, else the platform's
 * default. Never throws and never waits — the page is printed either way, so a
 * missing opener is not a failure.
 */
export const openInBrowser = (url: string, env: Env = process.env): void => {
  const [command, ...args] = browserCommandFor(url, env) ?? platformOpenerFor(url, process.platform)
  if (command === undefined) return
  try {
    spawn(command, args, { stdio: 'ignore', detached: true })
      .on('error', () => undefined)
      .unref()
  } catch {
    // The link is printed either way.
  }
}
