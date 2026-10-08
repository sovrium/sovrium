/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Where an installed Chrome, Chromium or Edge lives, per OS ([internal ref] D2,
 * desktop ruling). Sovrium ships no browser: when `RENDERER_CHROME_PATH` and
 * `RENDERER_CDP_URL` are both unset it looks for the user's own, and with none
 * found HTML rendering is off.
 *
 * Bun's own auto-detection is deliberately NOT used: with no `path` it first
 * tries to CONNECT to any Chrome that has remote debugging on — the user's
 * everyday browser, with their profile and their cookies — which is not a
 * sandbox. A detected path is passed explicitly, which forces a fresh spawn.
 *
 * macOS has no WebKit fallback: a WebKit view cannot print a PDF or intercept a
 * request, so it cannot be sandboxed.
 */

type Env = Readonly<Record<string, string | undefined>>

const MAC_APPS = [
  'Google Chrome.app/Contents/MacOS/Google Chrome',
  'Chromium.app/Contents/MacOS/Chromium',
  'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
] as const

const LINUX_BINARIES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/chrome-headless-shell',
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
  '/headless-shell/headless-shell',
] as const

const WINDOWS_BINARIES = [
  ['Google', 'Chrome', 'Application', 'chrome.exe'],
  ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
  ['Chromium', 'Application', 'chrome.exe'],
] as const

/** Every place a browser is looked for on `platform`, in preference order. */
export const chromeCandidates = (platform: NodeJS.Platform, env: Env): readonly string[] => {
  const fromBun = env['BUN_CHROME_PATH'] === undefined ? [] : [env['BUN_CHROME_PATH']]
  if (platform === 'darwin') {
    const home = env['HOME']
    const roots = ['/Applications', ...(home === undefined ? [] : [join(home, 'Applications')])]
    return [...fromBun, ...roots.flatMap((root) => MAC_APPS.map((app) => `${root}/${app}`))]
  }
  if (platform === 'win32') {
    const roots = [env['ProgramFiles'], env['ProgramFiles(x86)'], env['LOCALAPPDATA']].filter(
      (root): root is string => root !== undefined && root !== ''
    )
    return [
      ...fromBun,
      ...roots.flatMap((root) => WINDOWS_BINARIES.map((parts) => [root, ...parts].join('\\'))),
    ]
  }
  return [...fromBun, ...LINUX_BINARIES]
}

/**
 * The first installed browser, or `undefined`. `exists` is injected so the
 * search is testable without a browser on the machine.
 */
export const detectChromePath = (
  platform: NodeJS.Platform,
  env: Env,
  exists: (path: string) => boolean = existsSync
): string | undefined => chromeCandidates(platform, env).find((candidate) => exists(candidate))
