/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constants } from 'node:fs'
import { chmod, mkdir, open, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Effect, Option } from 'effect'
import { GROUP_READABLE_MODE, fail, fsStep, isMissing } from './instance-releases'

/**
 * The files the agent hands to a supervised app's one-shot unit, and the
 * files that unit hands back: `restore/restore.tar.gz`, `seed/request.json`,
 * `seed/report.json`, `backup/backup.tar.gz`.
 *
 * Those directories are writable by the APP's user — the unit runs as it — and
 * the agent is the more privileged of the two. So an entry found there is never
 * trusted to be what its name says: a symbolic link left in place of the file
 * would make the agent write through it, or read through it and hand back
 * whatever it points at. A file is created only where nothing stands
 * (`O_CREAT|O_EXCL`, which never follows a link), its mode set through the open
 * handle, and a file is read only when it is a regular file opened without
 * following a link.
 */

/**
 * Mode of a hand-over directory: setgid, and writable by the app's group. The
 * unit runs as the app's user, a member of that group, not as the directory's
 * owner.
 */
const WORKSPACE_MODE = 0o2770

/** `WORKSPACE_MODE` without its setgid bit: what a sandbox that refuses setgid allows. */
const WORKSPACE_PERMISSIONS = 0o770

/**
 * Set the workspace to `WORKSPACE_MODE`, whatever the umask and whatever mode
 * an earlier version left it with. A mode that already matches is left alone:
 * on Linux a directory created under a setgid parent inherits the bit, and a
 * `chmod` naming it is exactly what `RestrictSUIDSGID=` refuses with EPERM.
 * When that refusal comes, the mode falls back to 0770: group write is what the
 * unit needs, and the setgid bit, which only steers the group of new files, is
 * lost (Linux clears it on a chmod that does not name it).
 */
const setWorkspaceMode = async (workspace: string) => {
  if (((await stat(workspace)).mode & 0o7777) === WORKSPACE_MODE) return
  await chmod(workspace, WORKSPACE_MODE).catch((cause: unknown) => {
    if ((cause as { readonly code?: string } | null)?.code !== 'EPERM') throw cause
    return chmod(workspace, WORKSPACE_PERMISSIONS)
  })
}

/**
 * Hand `content` to a unit at `path`. The directory is created without a
 * setgid bit in the requested mode (a sandbox refuses that mkdir), then set by
 * `setWorkspaceMode`. Whatever stood at `path` is removed — a link, not its
 * target — and the file is created exclusively, so a link raced in between
 * fails the step instead of being written through.
 */
export const handFileToUnit = (path: string, content: Uint8Array) =>
  fsStep(`write ${path}`, async () => {
    const workspace = dirname(path)
    await mkdir(workspace, { recursive: true, mode: WORKSPACE_PERMISSIONS })
    await setWorkspaceMode(workspace)
    await rm(path, { force: true })
    const handle = await open(path, 'wx', GROUP_READABLE_MODE)
    try {
      await handle.chmod(GROUP_READABLE_MODE)
      await handle.writeFile(content)
    } finally {
      await handle.close()
    }
  })

/** `ELOOP`: the last component of the path is a symbolic link (`O_NOFOLLOW`). */
const isLink = (cause: unknown): boolean =>
  (cause as { readonly code?: string } | null)?.code === 'ELOOP'

/**
 * Read the file a unit left at `path`, or `undefined` when it left none. A
 * link, anything but a regular file, or a file over `maxBytes` fails the step
 * without its content being read.
 */
export const readFileFromUnit = (path: string, maxBytes = Number.POSITIVE_INFINITY) =>
  fsStep(`read ${path}`, async () => {
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(
      (cause: unknown) => {
        if (isMissing(cause)) return undefined
        if (isLink(cause)) throw new Error('it is a symbolic link, not a file the unit wrote')
        throw cause
      }
    )
    if (handle === undefined) return undefined
    try {
      const found = await handle.stat()
      if (!found.isFile()) throw new Error('it is not a regular file')
      if (found.size > maxBytes) throw new Error(`it is larger than ${String(maxBytes)} bytes`)
      return await handle.readFile()
    } finally {
      await handle.close()
    }
  })

/**
 * A JSON file a unit left, parsed; `undefined` when it left none. A file that
 * is not JSON fails without its text in the message: the parser quotes what it
 * stumbled on, and the file is the app's to write.
 */
export const readJsonFromUnit = (path: string, maxBytes: number) =>
  Effect.flatMap(readFileFromUnit(path, maxBytes), (bytes) => {
    if (bytes === undefined) return Effect.void
    return Option.match(
      Option.liftThrowable(() => JSON.parse(bytes.toString('utf8')) as unknown)(),
      {
        onNone: () => fail(`could not read ${path}: it is not JSON`),
        onSome: (parsed) => Effect.succeed(parsed),
      }
    )
  })
