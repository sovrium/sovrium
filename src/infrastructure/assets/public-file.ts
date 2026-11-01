/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpath } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { PUBLIC_DIR_SECRET_BLOCKLIST } from '@/infrastructure/server/route-setup/public-dir-blocklist'

/** Whether `target` is `root` or lies beneath it. */
const isWithin = (root: string, target: string): boolean =>
  target === root || target.startsWith(`${root}${sep}`)

/**
 * The real path of the file a root-relative path names inside the public
 * directory, or `undefined` when it is missing or leaves the directory — through
 * `..` or through a symbolic link, since both sides are resolved first.
 */
export const publicFilePath = async (
  publicDir: string,
  path: string
): Promise<string | undefined> => {
  if (!path.startsWith('/') || path.startsWith('//')) return undefined
  const root = await realpath(publicDir).catch(() => undefined)
  if (root === undefined) return undefined
  const target = await realpath(resolve(root, `.${path}`)).catch(() => undefined)
  return target === undefined || target === root || !isWithin(root, target) ? undefined : target
}

/**
 * The text of a file the public route would serve, read for writing into a page:
 * contained as {@link publicFilePath} contains it, and refused by the secret
 * blocklist under the name asked for and under the name a link leads to. Any
 * failure is `undefined`: a file that cannot be read never fails a page.
 */
export const readPublicFileText = async (
  publicDir: string | undefined,
  path: string
): Promise<string | undefined> => {
  if (publicDir === undefined || PUBLIC_DIR_SECRET_BLOCKLIST.test(path)) return undefined
  const target = await publicFilePath(publicDir, path)
  if (target === undefined) return undefined
  const root = await realpath(publicDir)
  if (PUBLIC_DIR_SECRET_BLOCKLIST.test(`/${relative(root, target).split(sep).join('/')}`)) {
    return undefined
  }
  return Bun.file(target)
    .text()
    .catch(() => undefined)
}
