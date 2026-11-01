/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolve } from 'node:path'
import type { ConfigRejectedError } from '@/domain/errors/config-rejected'

/** A reload refused because a `$ref` names a file that does not exist yet. */
export interface MissingRefRefusal {
  /** The files to watch: the root, the chain of `$ref`ed files, the missing one. */
  readonly files: ReadonlyArray<string>
  readonly error: ConfigRejectedError
}

/**
 * Read a load error as a `$ref` to a missing file, or `undefined` for any
 * other error.
 *
 * It is a refused config, not a crash, so it becomes a `ConfigRejectedError`
 * (printed without a stack). The files the load got through — the missing one
 * included — go to the watcher, so creating that file is a save it sees, and
 * the refusal says so: writing the file is all that is left to do.
 */
export const asMissingRefRefusal = async (
  rootPath: string,
  thrown: unknown
): Promise<MissingRefRefusal | undefined> => {
  const { MissingRefFileError } = await import('@/infrastructure/config/ref-resolver')
  if (!(thrown instanceof MissingRefFileError)) return undefined
  const { ConfigRejectedError } = await import('@/domain/errors/config-rejected')
  return {
    files: [resolve(rootPath), ...thrown.files],
    error: new ConfigRejectedError(
      `${thrown.message}\nIt is watched now: the server reloads once it exists.`
    ),
  }
}
