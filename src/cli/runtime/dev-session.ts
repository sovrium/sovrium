/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loginPageOf } from '@/domain/models/app/auth/login-page-service'
import type { Auth } from '@/domain/models/app/auth/auth'

/**
 * The facts of one `sovrium dev` session that hold whatever the config says
 * next: where its data lives, which account it creates, which password that
 * account takes, and the record a second run reads to answer "already
 * serving". Pure apart from the session file, so `sovrium dev` can import it
 * before the render tree reads the environment it is about to set.
 */

/** The dev data directory, relative to the project directory. */
export const DEV_DATA_SEGMENTS = ['.sovrium', 'dev'] as const

/** `<projectDir>/.sovrium/dev` — the data, lock and status of every dev session. */
export const devDataDir = (projectDir: string): string => join(projectDir, ...DEV_DATA_SEGMENTS)

/** The one password every dev session gives its accounts, unless the environment names another. */
export const DEV_ADMIN_PASSWORD = 'sovrium-dev-password'

/**
 * The dev admin's email for an app: `admin@<slug>.local`, where the slug is
 * the app name without an npm-style `@scope/`, lower-cased, every run of
 * characters outside `a-z0-9-` made one `-`. `@acme/crm.app` → `admin@crm-app.local`.
 */
export const devAdminEmail = (appName: string): string => {
  const unscoped = appName.replace(/^@[^/]+\//, '').toLowerCase()
  const slug = unscoped
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `admin@${slug === '' ? 'app' : slug}.local`
}

/** The dev password a session uses, or why it refuses the one it was given. */
export type DevPasswordResolution =
  { readonly password: string; readonly source: 'default' | 'env' } | { readonly refusal: string }

/**
 * The password of the dev accounts: an ambient non-empty `SOVRIUM_DEV_PASSWORD`
 * wins, else {@link DEV_ADMIN_PASSWORD}. One shorter than the app's minimum
 * length is refused — before anything is deleted — naming the variable to change.
 */
export const resolveDevPassword = (
  env: Readonly<Record<string, string | undefined>>,
  minLength: number
): DevPasswordResolution => {
  const ambient = env['SOVRIUM_DEV_PASSWORD'] ?? ''
  if (ambient === '') return { password: DEV_ADMIN_PASSWORD, source: 'default' }
  if (ambient.length < minLength) {
    return {
      refusal: `Error: SOVRIUM_DEV_PASSWORD is shorter than this app's minimum password length (${String(minLength)}). Set a longer one, or unset it to use the default.`,
    }
  }
  return { password: ambient, source: 'env' }
}

/**
 * The page `sovrium dev` opens: the app's sign-in page when the app declares
 * `auth` AND a page at that path (a localized path counts when one of its
 * languages has it), else the app's root.
 */
export const devOpenUrl = (
  app: {
    readonly auth?: Pick<Auth, 'loginPage'> | undefined
    readonly pages?:
      ReadonlyArray<{ readonly path: string | Readonly<Record<string, string>> }> | undefined
  },
  url: string
): string => {
  if (app.auth === undefined) return url
  const loginPage = loginPageOf(app.auth)
  const declared = (app.pages ?? []).some((page) =>
    typeof page.path === 'string'
      ? page.path === loginPage
      : Object.values(page.path).includes(loginPage)
  )
  return declared ? `${url.replace(/\/$/, '')}${loginPage}` : url
}

/** What a live session records for the next `sovrium dev` to repeat. */
export interface DevSessionFile {
  readonly appName: string
  readonly email?: string
  readonly password?: string
  readonly url: string
  readonly signInUrl: string
  readonly startedAt: string
}

const SESSION_FILE_NAME = 'dev-session.json'

/** `<devDir>/dev-session.json`. */
export const devSessionPath = (devDir: string): string => join(devDir, SESSION_FILE_NAME)

/** Write the session record, readable by its owner only — it holds a password. */
export const writeDevSession = async (devDir: string, session: DevSessionFile): Promise<void> => {
  await mkdir(devDir, { recursive: true })
  const path = devSessionPath(devDir)
  await writeFile(path, `${JSON.stringify(session, undefined, 2)}\n`, { mode: 0o600 })
  // `mode` applies only when the file is created; a rewrite keeps the old one.
  await chmod(path, 0o600)
}

const isSessionFile = (value: unknown): value is DevSessionFile =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { appName?: unknown }).appName === 'string' &&
  typeof (value as { url?: unknown }).url === 'string'

/** The session record, or `undefined` when there is none or it cannot be read. */
export const readDevSession = async (devDir: string): Promise<DevSessionFile | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(devSessionPath(devDir), 'utf-8'))
    return isSessionFile(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
